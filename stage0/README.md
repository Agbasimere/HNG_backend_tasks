# Stage 0 Backend Task

This project implements the HNG Stage 0 backend assessment with a single GET endpoint:

`GET /api/classify?name=<value>`

It calls the Genderize API, processes the result, and returns a normalized response with:

- `gender`
- `probability`
- `sample_size`
- `is_confident`
- `processed_at`

## Tech Stack

- Node.js 20+
- Native `http` server
- Native `fetch`
- No external dependencies

## Project Structure

```text
stage0/
  src/
    app.js
    server.js
  test/
    app.test.js
  package.json
  README.md
```

## Getting Started

1. Open the project folder:

   ```bash
   cd stage0
   ```

2. Start the server:

   ```bash
   npm start
   ```

3. The API will run on:

   ```text
   http://localhost:3000
   ```

You can override the port with the `PORT` environment variable.

## Endpoint

### Request

```http
GET /api/classify?name=Michael
```

### Success Response

```json
{
  "status": "success",
  "data": {
    "name": "Michael",
    "gender": "male",
    "probability": 0.99,
    "sample_size": 1234,
    "is_confident": true,
    "processed_at": "2026-04-01T12:00:00.000Z"
  }
}
```

### Error Format

All errors use this structure:

```json
{
  "status": "error",
  "message": "<error message>"
}
```

### Validation Rules

- Missing `name` returns `400 Bad Request`
- Empty `name` returns `400 Bad Request`
- Repeated `name` values such as `?name=John&name=Jane` return `422 Unprocessable Entity`

Note: query strings arrive as text in HTTP. To support the task's non-string validation rule in a meaningful way, repeated `name` keys are treated as array-like input and rejected with `422`.

### Genderize Edge Case

If Genderize responds with `gender: null` or `count: 0`, the API returns:

```json
{
  "status": "error",
  "message": "No prediction available for the provided name"
}
```

This implementation uses `422 Unprocessable Entity` for that case.

## CORS

Every response includes:

```text
Access-Control-Allow-Origin: *
```

## Running Tests

```bash
npm test
```

## Deployment Notes

This app is ready to deploy on platforms such as:

- Render
- Railway
- Fly.io
- Glitch

After deployment, your public endpoint should look like:

```text
https://your-app-url/api/classify?name=Michael
```

## Submission Checklist

- Public GitHub repository
- Clear README
- Live public API base URL
