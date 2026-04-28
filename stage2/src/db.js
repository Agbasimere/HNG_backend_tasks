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
    age: row.age,
    age_group: row.age_group,
    country_id: row.country_id,
    country_name: row.country_name,
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
      name TEXT NOT NULL UNIQUE COLLATE NOCASE,
      gender TEXT NOT NULL,
      gender_probability REAL NOT NULL,
      age INTEGER NOT NULL,
      age_group TEXT NOT NULL,
      country_id TEXT NOT NULL,
      country_name TEXT NOT NULL,
      country_probability REAL NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_profiles_gender ON profiles(gender);
    CREATE INDEX IF NOT EXISTS idx_profiles_age_group ON profiles(age_group);
    CREATE INDEX IF NOT EXISTS idx_profiles_country_id ON profiles(country_id);
    CREATE INDEX IF NOT EXISTS idx_profiles_age ON profiles(age);
    CREATE INDEX IF NOT EXISTS idx_profiles_gender_probability ON profiles(gender_probability);
    CREATE INDEX IF NOT EXISTS idx_profiles_country_probability ON profiles(country_probability);
    CREATE INDEX IF NOT EXISTS idx_profiles_created_at ON profiles(created_at);
  `);

  const insertOrIgnore = database.prepare(`
    INSERT OR IGNORE INTO profiles (
      id,
      name,
      gender,
      gender_probability,
      age,
      age_group,
      country_id,
      country_name,
      country_probability,
      created_at
    ) VALUES (
      @id,
      @name,
      @gender,
      @gender_probability,
      @age,
      @age_group,
      @country_id,
      @country_name,
      @country_probability,
      @created_at
    )
  `);

  const insertManyTx = database.transaction((profiles) => {
    let inserted = 0;

    for (const profile of profiles) {
      inserted += insertOrIgnore.run(profile).changes;
    }

    return inserted;
  });

  return {
    count() {
      return database.prepare("SELECT COUNT(*) AS total FROM profiles").get().total;
    },

    getById(id) {
      return mapProfile(
        database
          .prepare(
            `
              SELECT
                id,
                name,
                gender,
                gender_probability,
                age,
                age_group,
                country_id,
                country_name,
                country_probability,
                created_at
              FROM profiles
              WHERE id = ?
            `
          )
          .get(id)
      );
    },

    remove(id) {
      return database.prepare("DELETE FROM profiles WHERE id = ?").run(id).changes > 0;
    },

    insertMany(profiles) {
      return insertManyTx(profiles);
    },

    list({ filters = {}, sortBy = "created_at", order = "desc", page = 1, limit = 10 }) {
      const whereClauses = [];
      const values = [];

      if (filters.gender) {
        whereClauses.push("gender = ?");
        values.push(filters.gender);
      }

      if (filters.age_group) {
        whereClauses.push("age_group = ?");
        values.push(filters.age_group);
      }

      if (filters.country_id) {
        whereClauses.push("country_id = ?");
        values.push(filters.country_id);
      }

      if (filters.min_age !== undefined) {
        whereClauses.push("age >= ?");
        values.push(filters.min_age);
      }

      if (filters.max_age !== undefined) {
        whereClauses.push("age <= ?");
        values.push(filters.max_age);
      }

      if (filters.min_gender_probability !== undefined) {
        whereClauses.push("gender_probability >= ?");
        values.push(filters.min_gender_probability);
      }

      if (filters.min_country_probability !== undefined) {
        whereClauses.push("country_probability >= ?");
        values.push(filters.min_country_probability);
      }

      const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";
      const total = database
        .prepare(`SELECT COUNT(*) AS total FROM profiles ${whereClause}`)
        .get(...values).total;

      const offset = (page - 1) * limit;
      const rows = database
        .prepare(
          `
            SELECT
              id,
              name,
              gender,
              gender_probability,
              age,
              age_group,
              country_id,
              country_name,
              country_probability,
              created_at
            FROM profiles
            ${whereClause}
            ORDER BY ${sortBy} ${order.toUpperCase()}
            LIMIT ? OFFSET ?
          `
        )
        .all(...values, limit, offset);

      return {
        total,
        data: rows.map(mapProfile)
      };
    },

    distinctCountries() {
      return database
        .prepare(
          `
            SELECT DISTINCT country_id, country_name
            FROM profiles
            ORDER BY country_name ASC
          `
        )
        .all();
    },

    close() {
      database.close();
    }
  };
}
