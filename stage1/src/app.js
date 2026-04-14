import fs from "node:fs";
import http from "node:http";
import path from "node:path";

import { createProfileRepository } from "./db.js";
import { uuidv7 } from "./uuidv7.js";

const DEFAULT_DATABASE_FILE = path.resolve(process.cwd(), "data", "profiles.db");

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
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
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  });
  response.end();
}

function normalizeName(name) {
  return name.trim().toLowerCase();
}

function normalizeFilterValue(value) {
  return typeof value === "string" ? value.trim() : "";
}

function classifyAgeGroup(age) {
  if (age <= 12) {
    return "child";
  }

  if (age <= 19) {
    return "teenager";
  }

  if (age <= 59) {
    return "adult";
  }

  return "senior";
}

async function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";

    request.on("data", (chunk) => {
      body += chunk;

      if (body.length > 1024 * 1024) {
        reject(new Error("Request body is too large"));
        request.destroy();
      }
    });

    request.on("end", () => {
      if (body.length === 0) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error("Invalid JSON body"));
      }
    });

    request.on("error", reject);
  });
}

async function fetchExternalJson(fetchImpl, url, externalApi) {
  try {
    const response = await fetchImpl(url, {
      headers: {
        Accept: "application/json"
      },
      signal: AbortSignal.timeout(4000)
    });

    if (!response.ok) {
      throw new Error("Upstream request failed");
    }

    return await response.json();
  } catch {
    throw new Error(`${externalApi} returned an invalid response`);
  }
}

async function buildProfileFromApis(name, fetchImpl, idFactory, now) {
  const encodedName = encodeURIComponent(name);

  const [genderizePayload, agifyPayload, nationalizePayload] = await Promise.all([
    fetchExternalJson(fetchImpl, `https://api.genderize.io?name=${encodedName}`, "Genderize"),
    fetchExternalJson(fetchImpl, `https://api.agify.io?name=${encodedName}`, "Agify"),
    fetchExternalJson(fetchImpl, `https://api.nationalize.io?name=${encodedName}`, "Nationalize")
  ]);

  const genderProbability = Number(genderizePayload?.probability);
  const sampleSize = Number(genderizePayload?.count);
  const age = Number(agifyPayload?.age);
  const countries = Array.isArray(nationalizePayload?.country) ? nationalizePayload.country : [];
  const topCountry = countries.reduce((best, current) => {
    if (!best) {
      return current;
    }

    return Number(current?.probability ?? 0) > Number(best?.probability ?? 0) ? current : best;
  }, null);

  if (
    genderizePayload?.gender === null ||
    genderizePayload?.gender === undefined ||
    genderizePayload?.count === null ||
    genderizePayload?.count === undefined ||
    genderizePayload?.probability === null ||
    genderizePayload?.probability === undefined ||
    sampleSize === 0 ||
    !Number.isFinite(genderProbability)
  ) {
    throw new Error("Genderize returned an invalid response");
  }

  if (
    agifyPayload?.age === null ||
    agifyPayload?.age === undefined ||
    !Number.isFinite(age)
  ) {
    throw new Error("Agify returned an invalid response");
  }

  if (
    !topCountry ||
    !topCountry.country_id ||
    topCountry.probability === null ||
    topCountry.probability === undefined ||
    !Number.isFinite(Number(topCountry.probability))
  ) {
    throw new Error("Nationalize returned an invalid response");
  }

  return {
    id: idFactory(),
    normalized_name: name,
    name,
    gender: String(genderizePayload.gender).toLowerCase(),
    gender_probability: genderProbability,
    sample_size: sampleSize,
    age,
    age_group: classifyAgeGroup(age),
    country_id: String(topCountry.country_id).toUpperCase(),
    country_probability: Number(topCountry.probability),
    created_at: now()
  };
}

function parseProfileId(pathname) {
  const match = pathname.match(/^\/api\/profiles\/([^/]+)$/);
  return match ? decodeURIComponent(match[1]) : null;
}

function buildListFilters(searchParams) {
  const filters = {};

  const gender = normalizeFilterValue(searchParams.get("gender"));
  const countryId = normalizeFilterValue(searchParams.get("country_id"));
  const ageGroup = normalizeFilterValue(searchParams.get("age_group"));

  if (gender) {
    filters.gender = gender.toLowerCase();
  }

  if (countryId) {
    filters.country_id = countryId.toUpperCase();
  }

  if (ageGroup) {
    filters.age_group = ageGroup.toLowerCase();
  }

  return filters;
}

export function createApp({
  fetchImpl = fetch,
  databaseFile = DEFAULT_DATABASE_FILE,
  idFactory = uuidv7,
  now = () => new Date().toISOString()
} = {}) {
  fs.mkdirSync(path.dirname(databaseFile), { recursive: true });
  const repository = createProfileRepository(databaseFile);

  const server = http.createServer(async (request, response) => {
    if (request.method === "OPTIONS") {
      response.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
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
          service: "HNG Stage 1 Profile API",
          endpoints: [
            "POST /api/profiles",
            "GET /api/profiles",
            "GET /api/profiles/{id}",
            "DELETE /api/profiles/{id}"
          ]
        }
      });
      return;
    }

    if (request.method === "POST" && pathname === "/api/profiles") {
      try {
        const body = await readJsonBody(request);
        const { name } = body;

        if (name === undefined) {
          sendError(response, 400, "The name field is required");
          return;
        }

        if (typeof name !== "string") {
          sendError(response, 422, "The name field must be a string");
          return;
        }

        if (name.trim().length === 0) {
          sendError(response, 400, "The name field cannot be empty");
          return;
        }

        const normalizedName = normalizeName(name);
        const existingProfile = repository.getByNormalizedName(normalizedName);

        if (existingProfile) {
          sendJson(response, 200, {
            status: "success",
            message: "Profile already exists",
            data: existingProfile
          });
          return;
        }

        let profileToCreate;

        try {
          profileToCreate = await buildProfileFromApis(normalizedName, fetchImpl, idFactory, now);
        } catch (error) {
          if (error instanceof Error && error.message.endsWith("returned an invalid response")) {
            sendError(response, 502, error.message);
            return;
          }

          sendError(response, 500, "An unexpected server error occurred");
          return;
        }

        try {
          const createdProfile = repository.create(profileToCreate);

          sendJson(response, 201, {
            status: "success",
            data: createdProfile
          });
          return;
        } catch (error) {
          if (
            error instanceof Error &&
            typeof error.message === "string" &&
            error.message.includes("UNIQUE constraint failed: profiles.normalized_name")
          ) {
            const existing = repository.getByNormalizedName(normalizedName);

            sendJson(response, 200, {
              status: "success",
              message: "Profile already exists",
              data: existing
            });
            return;
          }

          throw error;
        }
      } catch (error) {
        if (error instanceof Error && error.message === "Invalid JSON body") {
          sendError(response, 400, "Invalid JSON body");
          return;
        }

        if (error instanceof Error && error.message === "Request body is too large") {
          sendError(response, 400, "Request body is too large");
          return;
        }

        sendError(response, 500, "An unexpected server error occurred");
        return;
      }
    }

    if (request.method === "GET" && pathname === "/api/profiles") {
      const filters = buildListFilters(requestUrl.searchParams);
      const profiles = repository.list(filters);

      sendJson(response, 200, {
        status: "success",
        count: profiles.length,
        data: profiles
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
