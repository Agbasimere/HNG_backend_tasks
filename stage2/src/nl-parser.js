function normalizeQuery(query) {
  return query.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function includesWord(query, pattern) {
  return new RegExp(`\\b${pattern}\\b`, "i").test(query);
}

function parseAgeThreshold(query) {
  const aboveMatch =
    query.match(/\b(?:above|over|older than|at least)\s+(\d{1,3})\b/i) ??
    query.match(/\b(\d{1,3})\s*(?:and above|\+)\b/i);

  if (aboveMatch) {
    return { min_age: Number(aboveMatch[1]) };
  }

  const belowMatch =
    query.match(/\b(?:below|under|younger than|at most)\s+(\d{1,3})\b/i) ??
    query.match(/\b(\d{1,3})\s*(?:and below)\b/i);

  if (belowMatch) {
    return { max_age: Number(belowMatch[1]) };
  }

  return {};
}

function parseGender(query) {
  const hasMale = /\b(?:male|males|man|men)\b/i.test(query);
  const hasFemale = /\b(?:female|females|woman|women)\b/i.test(query);

  if (hasMale && !hasFemale) {
    return "male";
  }

  if (hasFemale && !hasMale) {
    return "female";
  }

  return null;
}

function parseAgeGroup(query) {
  if (includesWord(query, "child") || includesWord(query, "children")) {
    return "child";
  }

  if (includesWord(query, "teenager") || includesWord(query, "teenagers") || includesWord(query, "teen") || includesWord(query, "teens")) {
    return "teenager";
  }

  if (includesWord(query, "adult") || includesWord(query, "adults")) {
    return "adult";
  }

  if (includesWord(query, "senior") || includesWord(query, "seniors") || includesWord(query, "elderly")) {
    return "senior";
  }

  return null;
}

function parseCountry(query, countryEntries) {
  const normalized = normalizeQuery(query);
  const sorted = [...countryEntries].sort(
    (left, right) => right.country_name.length - left.country_name.length
  );

  for (const entry of sorted) {
    const countryName = normalizeQuery(entry.country_name);
    if (countryName.length > 0 && normalized.includes(countryName)) {
      return entry;
    }

    if (new RegExp(`\\b${entry.country_id.toLowerCase()}\\b`).test(normalized)) {
      return entry;
    }
  }

  return null;
}

export function parseNaturalLanguageQuery(query, countryEntries) {
  const filters = {};
  const normalizedQuery = normalizeQuery(query);

  const gender = parseGender(normalizedQuery);
  if (gender) {
    filters.gender = gender;
  }

  const ageGroup = parseAgeGroup(normalizedQuery);
  if (ageGroup) {
    filters.age_group = ageGroup;
  }

  if (includesWord(normalizedQuery, "young")) {
    filters.min_age = 16;
    filters.max_age = 24;
  }

  Object.assign(filters, parseAgeThreshold(normalizedQuery));

  const country = parseCountry(normalizedQuery, countryEntries);
  if (country) {
    filters.country_id = country.country_id;
  }

  if (Object.keys(filters).length === 0) {
    return {
      ok: false,
      message: "Unable to interpret query"
    };
  }

  return {
    ok: true,
    filters
  };
}
