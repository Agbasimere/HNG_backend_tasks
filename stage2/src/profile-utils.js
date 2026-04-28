const REGION_NAMES = new Intl.DisplayNames(["en"], { type: "region" });

export function normalizeFullName(name) {
  return name.trim().replace(/\s+/g, " ");
}

export function classifyAgeGroup(age) {
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

export function getCountryNameFromCode(countryId) {
  try {
    return REGION_NAMES.of(countryId.toUpperCase()) ?? countryId.toUpperCase();
  } catch {
    return countryId.toUpperCase();
  }
}
