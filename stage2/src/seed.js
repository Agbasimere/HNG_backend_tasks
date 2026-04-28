import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createProfileRepository } from "./db.js";
import { classifyAgeGroup, getCountryNameFromCode, normalizeFullName } from "./profile-utils.js";
import { uuidv7 } from "./uuidv7.js";

function parseArguments(argv) {
  const args = {};

  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--file") {
      args.file = argv[index + 1];
      index += 1;
      continue;
    }

    if (argv[index] === "--database") {
      args.database = argv[index + 1];
      index += 1;
    }
  }

  return args;
}

function mapSeedProfile(rawProfile) {
  const name = normalizeFullName(
    rawProfile.name ?? rawProfile.full_name ?? rawProfile.fullName ?? ""
  );

  if (!name) {
    throw new Error("Seed profile is missing a valid name");
  }

  const gender = String(rawProfile.gender ?? "").trim().toLowerCase();
  const genderProbability = Number(
    rawProfile.gender_probability ?? rawProfile.genderProbability ?? 0
  );
  const age = Number(rawProfile.age);
  const countryId = String(rawProfile.country_id ?? rawProfile.countryId ?? "")
    .trim()
    .toUpperCase();
  const countryName = String(
    rawProfile.country_name ??
      rawProfile.countryName ??
      getCountryNameFromCode(countryId)
  ).trim();
  const countryProbability = Number(
    rawProfile.country_probability ?? rawProfile.countryProbability ?? 0
  );
  const createdAt = rawProfile.created_at ?? rawProfile.createdAt ?? new Date().toISOString();
  const id = rawProfile.id ?? uuidv7();

  if (!["male", "female"].includes(gender)) {
    throw new Error(`Invalid gender in seed profile for ${name}`);
  }

  if (!Number.isFinite(genderProbability) || genderProbability < 0 || genderProbability > 1) {
    throw new Error(`Invalid gender_probability in seed profile for ${name}`);
  }

  if (!Number.isFinite(age) || age < 0) {
    throw new Error(`Invalid age in seed profile for ${name}`);
  }

  if (!/^[A-Z]{2}$/.test(countryId)) {
    throw new Error(`Invalid country_id in seed profile for ${name}`);
  }

  if (!countryName) {
    throw new Error(`Invalid country_name in seed profile for ${name}`);
  }

  if (!Number.isFinite(countryProbability) || countryProbability < 0 || countryProbability > 1) {
    throw new Error(`Invalid country_probability in seed profile for ${name}`);
  }

  return {
    id,
    name,
    gender,
    gender_probability: genderProbability,
    age,
    age_group: classifyAgeGroup(age),
    country_id: countryId,
    country_name: countryName,
    country_probability: countryProbability,
    created_at: new Date(createdAt).toISOString()
  };
}

export function seedProfiles({ databaseFile, seedFile }) {
  const repository = createProfileRepository(databaseFile);

  try {
    const raw = JSON.parse(fs.readFileSync(seedFile, "utf8"));
    const profiles = Array.isArray(raw) ? raw.map(mapSeedProfile) : raw.profiles.map(mapSeedProfile);
    const inserted = repository.insertMany(profiles);

    return {
      total: profiles.length,
      inserted
    };
  } finally {
    repository.close();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = parseArguments(process.argv.slice(2));
  const databaseFile =
    args.database ?? process.env.DATABASE_FILE ?? path.resolve(process.cwd(), "data", "profiles.db");

  if (!args.file) {
    console.error("Usage: npm run seed -- --file <path-to-json> [--database <path-to-db>]");
    process.exit(1);
  }

  const result = seedProfiles({
    databaseFile,
    seedFile: path.resolve(process.cwd(), args.file)
  });

  console.log(`Seed complete. Inserted ${result.inserted} of ${result.total} profiles.`);
}
