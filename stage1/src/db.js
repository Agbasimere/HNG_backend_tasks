import fs from "node:fs";
import path from "node:path";

import Database from "better-sqlite3";

function mapProfile(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    name: row.name,
    gender: row.gender,
    gender_probability: row.gender_probability,
    sample_size: row.sample_size,
    age: row.age,
    age_group: row.age_group,
    country_id: row.country_id,
    country_probability: row.country_probability,
    created_at: row.created_at
  };
}

export function createProfileRepository(databaseFile) {
  fs.mkdirSync(path.dirname(databaseFile), { recursive: true });

  const database = new Database(databaseFile);
  database.pragma("journal_mode = WAL");

  database.exec(`
    CREATE TABLE IF NOT EXISTS profiles (
      id TEXT PRIMARY KEY,
      normalized_name TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      gender TEXT NOT NULL,
      gender_probability REAL NOT NULL,
      sample_size INTEGER NOT NULL,
      age INTEGER NOT NULL,
      age_group TEXT NOT NULL,
      country_id TEXT NOT NULL,
      country_probability REAL NOT NULL,
      created_at TEXT NOT NULL
    );
  `);

  const findById = database.prepare(`
    SELECT
      id,
      name,
      gender,
      gender_probability,
      sample_size,
      age,
      age_group,
      country_id,
      country_probability,
      created_at
    FROM profiles
    WHERE id = ?
  `);

  const findByNormalizedName = database.prepare(`
    SELECT
      id,
      name,
      gender,
      gender_probability,
      sample_size,
      age,
      age_group,
      country_id,
      country_probability,
      created_at
    FROM profiles
    WHERE normalized_name = ?
  `);

  const insertProfile = database.prepare(`
    INSERT INTO profiles (
      id,
      normalized_name,
      name,
      gender,
      gender_probability,
      sample_size,
      age,
      age_group,
      country_id,
      country_probability,
      created_at
    ) VALUES (
      @id,
      @normalized_name,
      @name,
      @gender,
      @gender_probability,
      @sample_size,
      @age,
      @age_group,
      @country_id,
      @country_probability,
      @created_at
    )
  `);

  const deleteProfile = database.prepare("DELETE FROM profiles WHERE id = ?");

  return {
    getById(id) {
      return mapProfile(findById.get(id));
    },

    getByNormalizedName(normalizedName) {
      return mapProfile(findByNormalizedName.get(normalizedName));
    },

    create(profile) {
      insertProfile.run(profile);
      return this.getById(profile.id);
    },

    list(filters = {}) {
      const clauses = [];
      const values = [];

      if (filters.gender) {
        clauses.push("gender = ?");
        values.push(filters.gender);
      }

      if (filters.country_id) {
        clauses.push("country_id = ?");
        values.push(filters.country_id);
      }

      if (filters.age_group) {
        clauses.push("age_group = ?");
        values.push(filters.age_group);
      }

      const whereClause = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
      const rows = database
        .prepare(
          `
            SELECT
              id,
              name,
              gender,
              age,
              age_group,
              country_id
            FROM profiles
            ${whereClause}
            ORDER BY created_at ASC
          `
        )
        .all(...values);

      return rows;
    },

    remove(id) {
      return deleteProfile.run(id).changes > 0;
    },

    close() {
      database.close();
    }
  };
}
