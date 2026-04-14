import assert from "node:assert/strict";

import { createApp, processGenderizePayload, validateNameQuery } from "../src/app.js";

function makeMockFetch({ ok = true, status = 200, payload = {} } = {}) {
  return async () => ({
    ok,
    status,
    async json() {
      return payload;
    }
  });
}

async function makeRequest(server, pathname) {
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();

  try {
    return await fetch(`http://127.0.0.1:${port}${pathname}`);
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
  }
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

await runTest("validateNameQuery rejects a missing name", async () => {
  const result = validateNameQuery(new URLSearchParams());

  assert.equal(result.ok, false);
  assert.equal(result.statusCode, 400);
});

await runTest("validateNameQuery rejects duplicate name params as non-string input", async () => {
  const result = validateNameQuery(new URLSearchParams("name=John&name=Jane"));

  assert.equal(result.ok, false);
  assert.equal(result.statusCode, 422);
});

await runTest("processGenderizePayload computes sample_size and confidence", async () => {
  const result = processGenderizePayload("michael", {
    gender: "male",
    probability: 0.99,
    count: 1200
  });

  assert.equal(result.ok, true);
  assert.deepEqual(
    {
      name: result.data.name,
      gender: result.data.gender,
      probability: result.data.probability,
      sample_size: result.data.sample_size,
      is_confident: result.data.is_confident
    },
    {
      name: "michael",
      gender: "male",
      probability: 0.99,
      sample_size: 1200,
      is_confident: true
    }
  );
  assert.match(result.data.processed_at, /^\d{4}-\d{2}-\d{2}T/);
});

await runTest("GET /api/classify returns processed data for a valid upstream response", async () => {
  const server = createApp({
    fetchImpl: makeMockFetch({
      payload: {
        gender: "female",
        probability: 0.91,
        count: 350
      }
    })
  });

  const response = await makeRequest(server, "/api/classify?name=Amara");
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.status, "success");
  assert.equal(body.data.name, "Amara");
  assert.equal(body.data.sample_size, 350);
  assert.equal(body.data.is_confident, true);
  assert.match(body.data.processed_at, /^\d{4}-\d{2}-\d{2}T/);
});

await runTest("GET /api/classify returns 400 for an empty name", async () => {
  const server = createApp();
  const response = await makeRequest(server, "/api/classify?name=   ");
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.equal(body.status, "error");
});

await runTest("GET /api/classify returns 422 when no prediction is available", async () => {
  const server = createApp({
    fetchImpl: makeMockFetch({
      payload: {
        gender: null,
        probability: 0,
        count: 0
      }
    })
  });

  const response = await makeRequest(server, "/api/classify?name=Qxz");
  const body = await response.json();

  assert.equal(response.status, 422);
  assert.equal(body.message, "No prediction available for the provided name");
});

await runTest("GET /api/classify returns 502 when Genderize fails", async () => {
  const server = createApp({
    fetchImpl: makeMockFetch({
      ok: false,
      status: 503
    })
  });

  const response = await makeRequest(server, "/api/classify?name=Chris");
  const body = await response.json();

  assert.equal(response.status, 502);
  assert.equal(body.status, "error");
});

if (process.exitCode) {
  process.exit(process.exitCode);
}
