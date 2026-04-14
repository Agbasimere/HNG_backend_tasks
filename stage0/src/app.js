import http from "node:http";

const DEFAULT_GENDERIZE_BASE_URL = "https://api.genderize.io";
const PREDICTION_NOT_AVAILABLE_MESSAGE =
  "No prediction available for the provided name";

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
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

export function validateNameQuery(searchParams) {
  const names = searchParams.getAll("name");

  if (names.length === 0) {
    return {
      ok: false,
      statusCode: 400,
      message: "The name query parameter is required"
    };
  }

  // Query strings are text-only, so repeated keys are the closest practical "non-string" case.
  if (names.length > 1) {
    return {
      ok: false,
      statusCode: 422,
      message: "The name query parameter must be a string"
    };
  }

  const [name] = names;

  if (typeof name !== "string") {
    return {
      ok: false,
      statusCode: 422,
      message: "The name query parameter must be a string"
    };
  }

  if (name.trim().length === 0) {
    return {
      ok: false,
      statusCode: 400,
      message: "The name query parameter cannot be empty"
    };
  }

  return {
    ok: true,
    value: name.trim()
  };
}

export function processGenderizePayload(name, payload) {
  const probability = Number(payload?.probability ?? 0);
  const sampleSize = Number(payload?.count ?? 0);
  const gender = payload?.gender ?? null;

  if (gender === null || sampleSize === 0) {
    return {
      ok: false,
      statusCode: 422,
      message: PREDICTION_NOT_AVAILABLE_MESSAGE
    };
  }

  return {
    ok: true,
    data: {
      name,
      gender,
      probability,
      sample_size: sampleSize,
      is_confident: probability >= 0.7 && sampleSize >= 100,
      processed_at: new Date().toISOString()
    }
  };
}

export function createApp({
  fetchImpl = fetch,
  genderizeBaseUrl = DEFAULT_GENDERIZE_BASE_URL
} = {}) {
  return http.createServer(async (request, response) => {
    if (request.method === "OPTIONS") {
      response.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type"
      });
      response.end();
      return;
    }

    const requestUrl = new URL(request.url, "http://localhost");

    if (request.method !== "GET" || requestUrl.pathname !== "/api/classify") {
      sendError(response, 404, "Route not found");
      return;
    }

    const validation = validateNameQuery(requestUrl.searchParams);

    if (!validation.ok) {
      sendError(response, validation.statusCode, validation.message);
      return;
    }

    try {
      const upstreamUrl = new URL("/?name=" + encodeURIComponent(validation.value), genderizeBaseUrl);
      const upstreamResponse = await fetchImpl(upstreamUrl, {
        headers: {
          Accept: "application/json"
        },
        signal: AbortSignal.timeout(4000)
      });

      if (!upstreamResponse.ok) {
        sendError(response, 502, "Failed to fetch prediction from Genderize");
        return;
      }

      const payload = await upstreamResponse.json();
      const processed = processGenderizePayload(validation.value, payload);

      if (!processed.ok) {
        sendError(response, processed.statusCode, processed.message);
        return;
      }

      sendJson(response, 200, {
        status: "success",
        data: processed.data
      });
    } catch (error) {
      const isUpstreamIssue =
        error?.name === "AbortError" ||
        error?.name === "TimeoutError" ||
        error instanceof TypeError;

      if (isUpstreamIssue) {
        sendError(response, 502, "Unable to reach Genderize at the moment");
        return;
      }

      sendError(response, 500, "An unexpected server error occurred");
    }
  });
}
