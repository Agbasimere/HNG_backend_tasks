const FILTER_KEYS = new Set([
  "gender",
  "age_group",
  "country_id",
  "min_age",
  "max_age",
  "min_gender_probability",
  "min_country_probability",
  "sort_by",
  "order",
  "page",
  "limit"
]);

const SEARCH_KEYS = new Set(["q", "page", "limit"]);
const SORTABLE_FIELDS = new Set(["age", "created_at", "gender_probability"]);
const GENDERS = new Set(["male", "female"]);
const AGE_GROUPS = new Set(["child", "teenager", "adult", "senior"]);

function hasUnknownKeys(searchParams, allowedKeys) {
  for (const key of searchParams.keys()) {
    if (!allowedKeys.has(key)) {
      return true;
    }
  }

  return false;
}

function parsePositiveInteger(value) {
  if (!/^\d+$/.test(value)) {
    return null;
  }

  const parsed = Number(value);
  return parsed >= 0 ? parsed : null;
}

function parseProbability(value) {
  if (!/^\d+(\.\d+)?$/.test(value)) {
    return null;
  }

  const parsed = Number(value);

  if (parsed < 0 || parsed > 1) {
    return null;
  }

  return parsed;
}

export function parseListQuery(searchParams) {
  if (hasUnknownKeys(searchParams, FILTER_KEYS)) {
    return {
      ok: false,
      statusCode: 422,
      message: "Invalid query parameters"
    };
  }

  const filters = {};

  const gender = searchParams.get("gender");
  if (gender !== null) {
    if (gender.trim().length === 0) {
      return { ok: false, statusCode: 400, message: "Invalid query parameters" };
    }

    const normalizedGender = gender.trim().toLowerCase();
    if (!GENDERS.has(normalizedGender)) {
      return { ok: false, statusCode: 422, message: "Invalid query parameters" };
    }

    filters.gender = normalizedGender;
  }

  const ageGroup = searchParams.get("age_group");
  if (ageGroup !== null) {
    if (ageGroup.trim().length === 0) {
      return { ok: false, statusCode: 400, message: "Invalid query parameters" };
    }

    const normalizedAgeGroup = ageGroup.trim().toLowerCase();
    if (!AGE_GROUPS.has(normalizedAgeGroup)) {
      return { ok: false, statusCode: 422, message: "Invalid query parameters" };
    }

    filters.age_group = normalizedAgeGroup;
  }

  const countryId = searchParams.get("country_id");
  if (countryId !== null) {
    if (countryId.trim().length === 0) {
      return { ok: false, statusCode: 400, message: "Invalid query parameters" };
    }

    const normalizedCountryId = countryId.trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(normalizedCountryId)) {
      return { ok: false, statusCode: 422, message: "Invalid query parameters" };
    }

    filters.country_id = normalizedCountryId;
  }

  const minAge = searchParams.get("min_age");
  if (minAge !== null) {
    if (minAge.trim().length === 0) {
      return { ok: false, statusCode: 400, message: "Invalid query parameters" };
    }

    const parsedMinAge = parsePositiveInteger(minAge.trim());
    if (parsedMinAge === null) {
      return { ok: false, statusCode: 422, message: "Invalid query parameters" };
    }

    filters.min_age = parsedMinAge;
  }

  const maxAge = searchParams.get("max_age");
  if (maxAge !== null) {
    if (maxAge.trim().length === 0) {
      return { ok: false, statusCode: 400, message: "Invalid query parameters" };
    }

    const parsedMaxAge = parsePositiveInteger(maxAge.trim());
    if (parsedMaxAge === null) {
      return { ok: false, statusCode: 422, message: "Invalid query parameters" };
    }

    filters.max_age = parsedMaxAge;
  }

  if (
    filters.min_age !== undefined &&
    filters.max_age !== undefined &&
    filters.min_age > filters.max_age
  ) {
    return { ok: false, statusCode: 422, message: "Invalid query parameters" };
  }

  const minGenderProbability = searchParams.get("min_gender_probability");
  if (minGenderProbability !== null) {
    if (minGenderProbability.trim().length === 0) {
      return { ok: false, statusCode: 400, message: "Invalid query parameters" };
    }

    const parsed = parseProbability(minGenderProbability.trim());
    if (parsed === null) {
      return { ok: false, statusCode: 422, message: "Invalid query parameters" };
    }

    filters.min_gender_probability = parsed;
  }

  const minCountryProbability = searchParams.get("min_country_probability");
  if (minCountryProbability !== null) {
    if (minCountryProbability.trim().length === 0) {
      return { ok: false, statusCode: 400, message: "Invalid query parameters" };
    }

    const parsed = parseProbability(minCountryProbability.trim());
    if (parsed === null) {
      return { ok: false, statusCode: 422, message: "Invalid query parameters" };
    }

    filters.min_country_probability = parsed;
  }

  const sortBy = searchParams.get("sort_by");
  const normalizedSortBy = sortBy ? sortBy.trim().toLowerCase() : "created_at";
  if (sortBy !== null && normalizedSortBy.length === 0) {
    return { ok: false, statusCode: 400, message: "Invalid query parameters" };
  }

  if (!SORTABLE_FIELDS.has(normalizedSortBy)) {
    return { ok: false, statusCode: 422, message: "Invalid query parameters" };
  }

  const order = searchParams.get("order");
  const normalizedOrder = order ? order.trim().toLowerCase() : "desc";
  if (order !== null && normalizedOrder.length === 0) {
    return { ok: false, statusCode: 400, message: "Invalid query parameters" };
  }

  if (!new Set(["asc", "desc"]).has(normalizedOrder)) {
    return { ok: false, statusCode: 422, message: "Invalid query parameters" };
  }

  const page = searchParams.get("page");
  const normalizedPage = page ? page.trim() : "1";
  if (page !== null && normalizedPage.length === 0) {
    return { ok: false, statusCode: 400, message: "Invalid query parameters" };
  }

  const parsedPage = parsePositiveInteger(normalizedPage);
  if (parsedPage === null || parsedPage < 1) {
    return { ok: false, statusCode: 422, message: "Invalid query parameters" };
  }

  const limit = searchParams.get("limit");
  const normalizedLimit = limit ? limit.trim() : "10";
  if (limit !== null && normalizedLimit.length === 0) {
    return { ok: false, statusCode: 400, message: "Invalid query parameters" };
  }

  const parsedLimit = parsePositiveInteger(normalizedLimit);
  if (parsedLimit === null || parsedLimit < 1 || parsedLimit > 50) {
    return { ok: false, statusCode: 422, message: "Invalid query parameters" };
  }

  return {
    ok: true,
    value: {
      filters,
      page: parsedPage,
      limit: parsedLimit,
      sort_by: normalizedSortBy,
      order: normalizedOrder
    }
  };
}

export function parseSearchQuery(searchParams) {
  if (hasUnknownKeys(searchParams, SEARCH_KEYS)) {
    return {
      ok: false,
      statusCode: 422,
      message: "Invalid query parameters"
    };
  }

  const q = searchParams.get("q");
  if (q === null || q.trim().length === 0) {
    return {
      ok: false,
      statusCode: 400,
      message: "The q query parameter is required"
    };
  }

  const page = searchParams.get("page");
  const normalizedPage = page ? page.trim() : "1";
  if (page !== null && normalizedPage.length === 0) {
    return { ok: false, statusCode: 400, message: "Invalid query parameters" };
  }

  const parsedPage = parsePositiveInteger(normalizedPage);
  if (parsedPage === null || parsedPage < 1) {
    return { ok: false, statusCode: 422, message: "Invalid query parameters" };
  }

  const limit = searchParams.get("limit");
  const normalizedLimit = limit ? limit.trim() : "10";
  if (limit !== null && normalizedLimit.length === 0) {
    return { ok: false, statusCode: 400, message: "Invalid query parameters" };
  }

  const parsedLimit = parsePositiveInteger(normalizedLimit);
  if (parsedLimit === null || parsedLimit < 1 || parsedLimit > 50) {
    return { ok: false, statusCode: 422, message: "Invalid query parameters" };
  }

  return {
    ok: true,
    value: {
      q: q.trim(),
      page: parsedPage,
      limit: parsedLimit
    }
  };
}
