import path from "node:path";

import { createApp } from "./app.js";

const port = Number(process.env.PORT) || 3001;
const databaseFile = process.env.DATABASE_FILE || path.resolve(process.cwd(), "data", "profiles.db");
const server = createApp({ databaseFile });

server.listen(port, () => {
  console.log(`Stage 1 API listening on port ${port}`);
});
