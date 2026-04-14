import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { createApp } from "../src/app.js";

function createTempDatabaseFile() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "stage1-"));
  return path.join(directory, "profiles.db");
}

function jsonResponse(payload, ok = true) {
  return {
    ok,
    async json() {
      return payload;
    }
  };
}

function createMockFetch(overrides = {}) {
  const counters = {
    genderize: 0,
    agify: 0,
    nationalize: 0
  };

  const fetchImpl = async (url) => {
    const value = String(url);

    if (value.includes("genderize.io")) {
      counters.genderize += 1;
      return jsonResponse(
        overrides.genderize ?? {
          gender: "female",
          probability: 0.99,
          count: 1234
        },
        overrides.genderizeOk ?? true
      );
    }

    if (value.includes("agify.io")) {
      counters.agify += 1;
      return jsonResponse(
        overrides.agify ?? {
          age: 46,
          count: 5000
        },
        overrides.agifyOk ?? true
      );
    }

    counters.nationalize += 1;
    return jsonResponse(
      overrides.nationalize ?? {
        country: [
          { country_id: "US", probability: 0.2 },
          { country_id: "NG", probability: 0.85 }
        ]
      },
      overrides.nationalizeOk ?? true
    );
  };

  fetchImpl.counters = counters;
  return fetchImpl;
}

async function withServer(options, callback) {
  const server = createApp(options);
  await new Promise((resolve) => server.listen(0, resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    await callback(baseUrl, server);
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
    headers: response.headers,
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

await runTest("POST /api/profiles creates and persists a profile", async () => {
  await withServer(
    {
      databaseFile: createTempDatabaseFile(),
      fetchImpl: createMockFetch(),
      idFactory: () => "018f2f52-0000-7000-8000-000000000001",
      now: () => "2026-04-01T12:00:00.000Z"
    },
    async (baseUrl) => {
      const created = await requestJson(baseUrl, "/api/profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Ella" })
      });

      assert.equal(created.status, 201);
      assert.equal(created.body.status, "success");
      assert.deepEqual(created.body.data, {
        id: "018f2f52-0000-7000-8000-000000000001",
        name: "ella",
        gender: "female",
        gender_probability: 0.99,
        sample_size: 1234,
        age: 46,
        age_group: "adult",
        country_id: "NG",
        country_probability: 0.85,
        created_at: "2026-04-01T12:00:00.000Z"
      });

      const fetched = await requestJson(baseUrl, "/api/profiles/018f2f52-0000-7000-8000-000000000001");

      assert.equal(fetched.status, 200);
      assert.equal(fetched.body.data.name, "ella");
    }
  );
});

await runTest("POST /api/profiles returns existing data for duplicate names", async () => {
  const mockFetch = createMockFetch();

  await withServer(
    {
      databaseFile: createTempDatabaseFile(),
      fetchImpl: mockFetch,
      idFactory: () => "018f2f52-0000-7000-8000-000000000002",
      now: () => "2026-04-01T12:00:00.000Z"
    },
    async (baseUrl) => {
      const first = await requestJson(baseUrl, "/api/profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Ella" })
      });
      const second = await requestJson(baseUrl, "/api/profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "ella" })
      });

      assert.equal(first.status, 201);
      assert.equal(second.status, 200);
      assert.equal(second.body.message, "Profile already exists");
      assert.equal(mockFetch.counters.genderize, 1);
      assert.equal(mockFetch.counters.agify, 1);
      assert.equal(mockFetch.counters.nationalize, 1);
    }
  );
});

await runTest("GET /api/profiles filters records after multiple inserts", async () => {
  const fetchQueue = [
    createMockFetch(),
    createMockFetch({
      genderize: { gender: "male", probability: 0.95, count: 1800 },
      agify: { age: 25, count: 4200 },
      nationalize: {
        country: [{ country_id: "US", probability: 0.91 }]
      }
    })
  ];

  await withServer(
    {
      databaseFile: createTempDatabaseFile(),
      fetchImpl: async (url) => fetchQueue[0](url),
      idFactory: (() => {
        const ids = [
          "018f2f52-0000-7000-8000-000000000005",
          "018f2f52-0000-7000-8000-000000000006"
        ];

        return () => ids.shift();
      })(),
      now: (() => {
        const timestamps = ["2026-04-01T12:00:00.000Z", "2026-04-01T12:00:01.000Z"];
        return () => timestamps.shift();
      })()
    },
    async (baseUrl) => {
      await requestJson(baseUrl, "/api/profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Ella" })
      });

      fetchQueue.shift();

      await requestJson(baseUrl, "/api/profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Emmanuel" })
      });

      const filtered = await requestJson(baseUrl, "/api/profiles?gender=MALE&country_id=us");

      assert.equal(filtered.status, 200);
      assert.equal(filtered.body.count, 1);
      assert.deepEqual(filtered.body.data, [
        {
          id: "018f2f52-0000-7000-8000-000000000006",
          name: "emmanuel",
          gender: "male",
          age: 25,
          age_group: "adult",
          country_id: "US"
        }
      ]);
    }
  );
});

await runTest("DELETE /api/profiles removes a stored profile", async () => {
  await withServer(
    {
      databaseFile: createTempDatabaseFile(),
      fetchImpl: createMockFetch(),
      idFactory: () => "018f2f52-0000-7000-8000-000000000007",
      now: () => "2026-04-01T12:00:00.000Z"
    },
    async (baseUrl) => {
      await requestJson(baseUrl, "/api/profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Ella" })
      });

      const deleted = await requestJson(baseUrl, "/api/profiles/018f2f52-0000-7000-8000-000000000007", {
        method: "DELETE"
      });
      const missing = await requestJson(baseUrl, "/api/profiles/018f2f52-0000-7000-8000-000000000007");

      assert.equal(deleted.status, 204);
      assert.equal(missing.status, 404);
      assert.equal(missing.body.message, "Profile not found");
    }
  );
});

await runTest("POST /api/profiles validates missing and invalid names", async () => {
  await withServer(
    {
      databaseFile: createTempDatabaseFile(),
      fetchImpl: createMockFetch()
    },
    async (baseUrl) => {
      const missing = await requestJson(baseUrl, "/api/profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({})
      });
      const invalidType = await requestJson(baseUrl, "/api/profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: 123 })
      });

      assert.equal(missing.status, 400);
      assert.equal(invalidType.status, 422);
    }
  );
});

await runTest("POST /api/profiles returns 502 when an upstream payload is invalid", async () => {
  await withServer(
    {
      databaseFile: createTempDatabaseFile(),
      fetchImpl: createMockFetch({
        agify: { age: null, count: 10 }
      })
    },
    async (baseUrl) => {
      const invalid = await requestJson(baseUrl, "/api/profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Ella" })
      });
      const allProfiles = await requestJson(baseUrl, "/api/profiles");

      assert.equal(invalid.status, 502);
      assert.equal(invalid.body.message, "Agify returned an invalid response");
      assert.equal(allProfiles.body.count, 0);
    }
  );
});

if (process.exitCode) {
  process.exit(process.exitCode);
}
