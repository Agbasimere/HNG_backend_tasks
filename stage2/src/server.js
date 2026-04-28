import path from "node:path";
import fs from "node:fs";

import { createApp } from "./app.js";
import { createProfileRepository } from "./db.js";
import { seedProfiles } from "./seed.js";

const port = Number(process.env.PORT) || 3002;
const databaseFile = process.env.DATABASE_FILE || path.resolve(process.cwd(), "data", "profiles.db");
const bundledSeedFile = path.resolve(process.cwd(), "data", "seed_profiles.json");

function seedOnStartupIfNeeded() {
  if (!fs.existsSync(bundledSeedFile)) {
    return;
  }

  const repository = createProfileRepository(databaseFile);

  try {
    if (repository.count() > 0) {
      return;
    }
  } finally {
    repository.close();
  }

  const result = seedProfiles({
    databaseFile,
    seedFile: bundledSeedFile
  });

  console.log(`Startup seed complete. Inserted ${result.inserted} of ${result.total} profiles.`);
}

seedOnStartupIfNeeded();
const server = createApp({ databaseFile });

server.listen(port, () => {
  console.log(`Stage 2 API listening on port ${port}`);
});
