# HNG Backend Tasks

This repository contains my HNG backend stage tasks, organized by stage folders.

## Structure

```text
HNG_backendtasks/
  stage0/
```

## Current Stages

- `stage0`: API Integration & Data Processing Assessment

## Stage 0

The Stage 0 solution lives in [`stage0`](./stage0) and exposes:

`GET /api/classify?name=<value>`

It integrates with the Genderize API, processes the upstream data, and returns the assessment-required response format.

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

For deployment platforms like Render, use the `stage0` folder as the service root directory.
