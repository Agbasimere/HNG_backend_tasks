import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { createApp } from "../src/app.js";
import { createProfileRepository } from "../src/db.js";
import { seedProfiles } from "../src/seed.js";

function createTempDirectory() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "stage2-"));
}

function createTempDatabaseFile() {
  return path.join(createTempDirectory(), "profiles.db");
}

function sampleProfiles() {
  return [
    {
      id: "019d8e72-b3dc-7e44-9589-2858abc0f9f5",
      name: "emmanuel",
      gender: "male",
      gender_probability: 0.99,
      age: 34,
      age_group: "adult",
      country_id: "NG",
      country_name: "Nigeria",
      country_probability: 0.85,
      created_at: "2026-04-01T12:00:00.000Z"
    },
    {
      id: "019d8e72-b3dc-7e44-9589-2858abc0f9f6",
      name: "amina",
      gender: "female",
      gender_probability: 0.96,
      age: 22,
      age_group: "adult",
      country_id: "NG",
      country_name: "Nigeria",
      country_probability: 0.91,
      created_at: "2026-04-02T12:00:00.000Z"
    },
    {
      id: "019d8e72-b3dc-7e44-9589-2858abc0f9f7",
      name: "femi",
      gender: "male",
      gender_probability: 0.88,
      age: 19,
      age_group: "teenager",
      country_id: "KE",
      country_name: "Kenya",
      country_probability: 0.73,
      created_at: "2026-04-03T12:00:00.000Z"
    },
    {
      id: "019d8e72-b3dc-7e44-9589-2858abc0f9f8",
      name: "joana",
      gender: "female",
      gender_probability: 0.93,
      age: 17,
      age_group: "teenager",
      country_id: "AO",
      country_name: "Angola",
      country_probability: 0.79,
      created_at: "2026-04-04T12:00:00.000Z"
    }
  ];
}

async function withServer(databaseFile, callback) {
  const repository = createProfileRepository(databaseFile);
  repository.insertMany(sampleProfiles());
  repository.close();

  const server = createApp({ databaseFile });
  await new Promise((resolve) => server.listen(0, resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    await callback(baseUrl);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
    server.closeRepository();
  }
}

async function requestJson(baseUrl, pathname, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, options);
  const text = await response.text();

  return {
    status: response.status,
    body: text ? JSON.parse(text) : null
  };
}

async function runTest(name, fn) {
  try {
    await fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    console.error(error);
    process.exitCode = 1;
  }
}

await runTest("GET /api/profiles combines filters, sorting, and pagination", async () => {
  await withServer(createTempDatabaseFile(), async (baseUrl) => {
    const response = await requestJson(
      baseUrl,
      "/api/profiles?gender=male&min_age=18&sort_by=age&order=desc&page=1&limit=1"
    );

    assert.equal(response.status, 200);
    assert.equal(response.body.status, "success");
    assert.equal(response.body.page, 1);
    assert.equal(response.body.limit, 1);
    assert.equal(response.body.total, 2);
    assert.equal(response.body.data[0].name, "emmanuel");
  });
});

await runTest("GET /api/profiles rejects invalid query parameters", async () => {
  await withServer(createTempDatabaseFile(), async (baseUrl) => {
    const response = await requestJson(baseUrl, "/api/profiles?sort_by=name");

    assert.equal(response.status, 422);
    assert.equal(response.body.message, "Invalid query parameters");
  });
});

await runTest("GET /api/profiles/search parses young males from nigeria", async () => {
  await withServer(createTempDatabaseFile(), async (baseUrl) => {
    const response = await requestJson(
      baseUrl,
      "/api/profiles/search?q=young%20males%20from%20nigeria"
    );

    assert.equal(response.status, 200);
    assert.equal(response.body.total, 0);
  });
});

await runTest("GET /api/profiles/search parses adult males from kenya", async () => {
  await withServer(createTempDatabaseFile(), async (baseUrl) => {
    const response = await requestJson(
      baseUrl,
      "/api/profiles/search?q=adult%20males%20from%20kenya"
    );

    assert.equal(response.status, 200);
    assert.equal(response.body.total, 0);
  });
});

await runTest("GET /api/profiles/search parses people from angola", async () => {
  await withServer(createTempDatabaseFile(), async (baseUrl) => {
    const response = await requestJson(
      baseUrl,
      "/api/profiles/search?q=people%20from%20angola"
    );

    assert.equal(response.status, 200);
    assert.equal(response.body.total, 1);
    assert.equal(response.body.data[0].country_id, "AO");
  });
});

await runTest("GET /api/profiles/search handles mixed male and female teenager query", async () => {
  await withServer(createTempDatabaseFile(), async (baseUrl) => {
    const response = await requestJson(
      baseUrl,
      "/api/profiles/search?q=male%20and%20female%20teenagers%20above%2017"
    );

    assert.equal(response.status, 200);
    assert.equal(response.body.total, 2);
    assert.deepEqual(
      response.body.data.map((profile) => profile.name).sort(),
      ["femi", "joana"]
    );
  });
});

await runTest("GET /api/profiles/search rejects uninterpretable text", async () => {
  await withServer(createTempDatabaseFile(), async (baseUrl) => {
    const response = await requestJson(baseUrl, "/api/profiles/search?q=show%20me%20something");

    assert.equal(response.status, 422);
    assert.equal(response.body.message, "Unable to interpret query");
  });
});

await runTest("GET /api/profiles/{id} returns a profile and DELETE removes it", async () => {
  await withServer(createTempDatabaseFile(), async (baseUrl) => {
    const fetched = await requestJson(
      baseUrl,
      "/api/profiles/019d8e72-b3dc-7e44-9589-2858abc0f9f5"
    );
    const deleted = await fetch(
      `${baseUrl}/api/profiles/019d8e72-b3dc-7e44-9589-2858abc0f9f5`,
      { method: "DELETE" }
    );
    const missing = await requestJson(
      baseUrl,
      "/api/profiles/019d8e72-b3dc-7e44-9589-2858abc0f9f5"
    );

    assert.equal(fetched.status, 200);
    assert.equal(deleted.status, 204);
    assert.equal(missing.status, 404);
  });
});

await runTest("seed command is idempotent for duplicate names", async () => {
  const directory = createTempDirectory();
  const databaseFile = path.join(directory, "profiles.db");
  const seedFile = path.join(directory, "profiles.json");

  fs.writeFileSync(
    seedFile,
    JSON.stringify(
      sampleProfiles().map((profile) => ({
        ...profile,
        name: profile.name
      })),
      null,
      2
    )
  );

  const firstRun = seedProfiles({ databaseFile, seedFile });
  const secondRun = seedProfiles({ databaseFile, seedFile });
  const repository = createProfileRepository(databaseFile);
  const result = repository.list({ page: 1, limit: 10, sortBy: "created_at", order: "desc" });
  repository.close();

  assert.equal(firstRun.inserted, 4);
  assert.equal(secondRun.inserted, 0);
  assert.equal(result.total, 4);
});

if (process.exitCode) {
  process.exit(process.exitCode);
}
