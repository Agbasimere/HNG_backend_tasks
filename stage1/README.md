# Stage 1 Backend Task

This project implements the HNG Stage 1 backend assessment with persistent profile storage and four API endpoints.

## Features

- `POST /api/profiles` creates a profile from three external APIs and stores it
- Duplicate names return the existing stored profile instead of creating a new record
- `GET /api/profiles/:id` returns a single stored profile
- `GET /api/profiles` returns all stored profiles with optional filtering
- `DELETE /api/profiles/:id` removes a stored profile
- All timestamps use UTC ISO 8601
- All profile IDs are UUID v7
- SQLite is used for persistence

## External APIs

- Genderize: `https://api.genderize.io?name={name}`
- Agify: `https://api.agify.io?name={name}`
- Nationalize: `https://api.nationalize.io?name={name}`

## Classification Rules

- `0-12` -> `child`
- `13-19` -> `teenager`
- `20-59` -> `adult`
- `60+` -> `senior`
- Nationality is chosen from the country with the highest probability returned by Nationalize

## Project Structure

```text
stage1/
  data/
  src/
    app.js
    db.js
    server.js
    uuidv7.js
  test/
    app.test.js
  package.json
```

## Getting Started

1. Enter the project:

   ```bash
   cd stage1
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Start the API:

   ```bash
   npm start
   ```

The API runs on `http://localhost:3001` by default.

## Environment Variables

- `PORT`: optional server port
- `DATABASE_FILE`: optional SQLite file path

## Endpoints

### Create Profile

```http
POST /api/profiles
Content-Type: application/json

{
  "name": "ella"
}
```

Success:

```json
{
  "status": "success",
  "data": {
    "id": "018f2f52-0000-7000-8000-000000000001",
    "name": "ella",
    "gender": "female",
    "gender_probability": 0.99,
    "sample_size": 1234,
    "age": 46,
    "age_group": "adult",
    "country_id": "NG",
    "country_probability": 0.85,
    "created_at": "2026-04-01T12:00:00.000Z"
  }
}
```

Duplicate name:

```json
{
  "status": "success",
  "message": "Profile already exists",
  "data": {
    "id": "018f2f52-0000-7000-8000-000000000001",
    "name": "ella",
    "gender": "female",
    "gender_probability": 0.99,
    "sample_size": 1234,
    "age": 46,
    "age_group": "adult",
    "country_id": "NG",
    "country_probability": 0.85,
    "created_at": "2026-04-01T12:00:00.000Z"
  }
}
```

### Get Single Profile

```http
GET /api/profiles/{id}
```

### Get All Profiles

```http
GET /api/profiles
GET /api/profiles?gender=male&country_id=NG
GET /api/profiles?age_group=adult
```

### Delete Profile

```http
DELETE /api/profiles/{id}
```

Returns `204 No Content` on success.

## Error Format

All errors follow this structure:

```json
{
  "status": "error",
  "message": "<error message>"
}
```

Upstream validation failures return:

```json
{
  "status": "error",
  "message": "Genderize returned an invalid response"
}
```

The same format is used for `Agify` and `Nationalize`.

## CORS

Every response includes:

```text
Access-Control-Allow-Origin: *
```

## Running Tests

```bash
npm test
```

## Deployment Note

Render is not accepted for Stage 1. Railway is the easiest next option for this project structure because it can run the Node app directly from the `stage1` folder.

If you deploy to Railway with SQLite, attach a persistent Volume and mount it to:

```text
/app/data
```

That mount path matches this app's default database location and ensures stored profiles survive redeployments and restarts.
