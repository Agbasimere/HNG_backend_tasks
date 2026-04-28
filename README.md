# HNG Backend Tasks

This repository contains my HNG backend stage tasks, with each task isolated in its own stage folder at the repository root.

## Structure

```text
HNG_backendtasks/
  stage0/
  stage1/
  stage2/
  ...
```

Each new task lives in its own folder such as `stage0`, `stage1`, and so on. This keeps implementation, documentation, and deployment settings separate per stage.

## Current Stages

- `stage0`: API Integration & Data Processing Assessment
- `stage1`: Data Persistence & API Design Assessment
- `stage2`: Intelligence Query Engine Assessment

## Stage 0

The Stage 0 solution lives in [`stage0`](./stage0) and exposes:

`GET /api/classify?name=<value>`

It integrates with the Genderize API, processes the upstream data, and returns the assessment-required response format.

Live deployment:

`https://hng-stage0-api-228n.onrender.com`

Example request:

`https://hng-stage0-api-228n.onrender.com/api/classify?name=Michael`

## Stage 1

The Stage 1 solution lives in [`stage1`](./stage1) and exposes:

- `POST /api/profiles`
- `GET /api/profiles`
- `GET /api/profiles/{id}`
- `DELETE /api/profiles/{id}`

It integrates with Genderize, Agify, and Nationalize, stores profiles in SQLite, prevents duplicate records by normalized name, and supports case-insensitive filtering.

## Stage 2

The Stage 2 solution lives in [`stage2`](./stage2) and adds:

- combined filtering on `GET /api/profiles`
- sorting and pagination
- rule-based natural language search on `GET /api/profiles/search`
- an idempotent seed flow for the provided 2026 dataset

## Local Development

To run Stage 0 locally:

```bash
cd stage0
npm start
```

To run the Stage 0 tests:

```bash
cd stage0
npm test
```

## Deployment

For deployment platforms like Render, keep the GitHub repository root as `HNG_backendtasks` and set the service Root Directory to the relevant stage folder, for example `stage0`.
