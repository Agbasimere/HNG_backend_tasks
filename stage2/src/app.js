import fs from "node:fs";
import http from "node:http";
import path from "node:path";

import { createProfileRepository } from "./db.js";
import { parseNaturalLanguageQuery } from "./nl-parser.js";
import { parseListQuery, parseSearchQuery } from "./query.js";

const DEFAULT_DATABASE_FILE = path.resolve(process.cwd(), "data", "profiles.db");

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json; charset=utf-8"
  });
  response.end(JSON.stringify(payload));
}

function sendError(response, statusCode, message) {
  sendJson(response, statusCode, {
    status: "error",
    message
  });
}

function sendNoContent(response) {
  response.writeHead(204, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  });
  response.end();
}

function parseProfileId(pathname) {
  const match = pathname.match(/^\/api\/profiles\/([^/]+)$/);
  return match ? decodeURIComponent(match[1]) : null;
}

export function createApp({ databaseFile = DEFAULT_DATABASE_FILE } = {}) {
  fs.mkdirSync(path.dirname(databaseFile), { recursive: true });
  const repository = createProfileRepository(databaseFile);

  const server = http.createServer((request, response) => {
    if (request.method === "OPTIONS") {
      response.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type"
      });
      response.end();
      return;
    }

    const requestUrl = new URL(request.url, "http://localhost");
    const { pathname } = requestUrl;

    if (request.method === "GET" && pathname === "/") {
      sendJson(response, 200, {
        status: "success",
        data: {
          service: "HNG Stage 2 Intelligence Query Engine",
          endpoints: [
            "GET /api/profiles",
            "GET /api/profiles/search",
            "GET /api/profiles/{id}",
            "DELETE /api/profiles/{id}"
          ]
        }
      });
      return;
    }

    if (request.method === "GET" && pathname === "/api/profiles") {
      const parsed = parseListQuery(requestUrl.searchParams);

      if (!parsed.ok) {
        sendError(response, parsed.statusCode, parsed.message);
        return;
      }

      const result = repository.list({
        filters: parsed.value.filters,
        sortBy: parsed.value.sort_by,
        order: parsed.value.order,
        page: parsed.value.page,
        limit: parsed.value.limit
      });

      sendJson(response, 200, {
        status: "success",
        page: parsed.value.page,
        limit: parsed.value.limit,
        total: result.total,
        data: result.data
      });
      return;
    }

    if (request.method === "GET" && pathname === "/api/profiles/search") {
      const parsed = parseSearchQuery(requestUrl.searchParams);

      if (!parsed.ok) {
        sendError(response, parsed.statusCode, parsed.message);
        return;
      }

      const interpreted = parseNaturalLanguageQuery(parsed.value.q, repository.distinctCountries());

      if (!interpreted.ok) {
        sendError(response, 422, interpreted.message);
        return;
      }

      const result = repository.list({
        filters: interpreted.filters,
        sortBy: "created_at",
        order: "desc",
        page: parsed.value.page,
        limit: parsed.value.limit
      });

      sendJson(response, 200, {
        status: "success",
        page: parsed.value.page,
        limit: parsed.value.limit,
        total: result.total,
        data: result.data
      });
      return;
    }

    const profileId = parseProfileId(pathname);

    if (request.method === "GET" && profileId) {
      const profile = repository.getById(profileId);

      if (!profile) {
        sendError(response, 404, "Profile not found");
        return;
      }

      sendJson(response, 200, {
        status: "success",
        data: profile
      });
      return;
    }

    if (request.method === "DELETE" && profileId) {
      const deleted = repository.remove(profileId);

      if (!deleted) {
        sendError(response, 404, "Profile not found");
        return;
      }

      sendNoContent(response);
      return;
    }

    sendError(response, 404, "Route not found");
  });

  server.closeRepository = () => repository.close();
  return server;
}
