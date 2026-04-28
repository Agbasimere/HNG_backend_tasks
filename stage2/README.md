# Stage 2 Backend Task

This project implements the HNG Stage 2 Intelligence Query Engine assessment for Insighta Labs.

## Features

- `GET /api/profiles` with combined filtering, sorting, and pagination
- `GET /api/profiles/search` for rule-based natural language search
- `GET /api/profiles/:id` to fetch a single profile
- `DELETE /api/profiles/:id` to remove a profile
- SQLite persistence
- UUID v7 identifiers
- UTC ISO 8601 timestamps
- Idempotent seed command for bulk profile imports

## Database Schema

The `profiles` table follows the required Stage 2 structure:

- `id`
- `name`
- `gender`
- `gender_probability`
- `age`
- `age_group`
- `country_id`
- `country_name`
- `country_probability`
- `created_at`

## Supported Query Filters

`GET /api/profiles` supports:

- `gender`
- `age_group`
- `country_id`
- `min_age`
- `max_age`
- `min_gender_probability`
- `min_country_probability`
- `sort_by` = `age | created_at | gender_probability`
- `order` = `asc | desc`
- `page` default `1`
- `limit` default `10`, max `50`

All filters are combinable and results must satisfy every supplied condition.

## Natural Language Parsing Approach

The `/api/profiles/search` endpoint uses a rule-based parser only. No AI or LLM logic is involved.

### Supported Keywords and Mappings

- `male`, `males`, `man`, `men` -> `gender=male`
- `female`, `females`, `woman`, `women` -> `gender=female`
- `child`, `children` -> `age_group=child`
- `teen`, `teens`, `teenager`, `teenagers` -> `age_group=teenager`
- `adult`, `adults` -> `age_group=adult`
- `senior`, `seniors`, `elderly` -> `age_group=senior`
- `young` -> `min_age=16` and `max_age=24`
- `above 30`, `over 30`, `older than 30`, `at least 30` -> `min_age=30`
- `below 30`, `under 30`, `younger than 30`, `at most 30` -> `max_age=30`
- `from angola`, `from nigeria`, `from kenya` -> matched against seeded `country_name` values and converted to `country_id`
- Two-letter country codes are also recognized if they appear clearly in the text

### Parsing Logic

1. Normalize the query to lowercase plain text
2. Detect gender keywords
3. Detect age-group keywords
4. Detect `young`
5. Detect age thresholds like `above 30`
6. Match country names against the distinct countries stored in the database
7. Build filter conditions from the matched rules
8. If nothing meaningful is extracted, return:

```json
{
  "status": "error",
  "message": "Unable to interpret query"
}
```

### Examples

- `young males` -> `gender=male`, `min_age=16`, `max_age=24`
- `females above 30` -> `gender=female`, `min_age=30`
- `people from angola` -> `country_id=AO`
- `adult males from kenya` -> `gender=male`, `age_group=adult`, `country_id=KE`
- `male and female teenagers above 17` -> `age_group=teenager`, `min_age=17`

## Limitations

- The parser does not understand every possible English phrasing
- Number words such as `thirty` are not supported; numeric digits like `30` are required
- It does not resolve conflicting instructions semantically; it simply combines the matched rules
- Country matching depends on countries present in the seeded database
- It does not support OR logic beyond the explicit male/female-neutral behavior shown in the task example
- It does not support fuzzy spelling correction

## Seeding

Run the seed command with the provided JSON file:

```bash
npm run seed -- --file path/to/2026-profiles.json
```

Optional:

```bash
npm run seed -- --file path/to/2026-profiles.json --database path/to/profiles.db
```

Re-running the same seed file will not create duplicate rows because names are unique and inserts use `INSERT OR IGNORE`.

This repository also supports automatic startup seeding when `data/seed_profiles.json` is present and the database is empty. That makes deployment easier on platforms like Railway, because the first boot can populate the database without a separate manual seed step.

## Getting Started

1. Enter the project:

   ```bash
   cd stage2
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Start the API:

   ```bash
   npm start
   ```

The API runs on `http://localhost:3002` by default.

## Environment Variables

- `PORT`: optional server port
- `DATABASE_FILE`: optional SQLite file path

## Running Tests

```bash
npm test
```

## Deployment Note

Render is not accepted for Stage 2. Railway is the easiest fit for this project structure. If you deploy with SQLite on Railway, mount a persistent volume at `/app/data` so the database survives restarts and redeployments.
