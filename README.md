# agentic-investigation

## Overview

This is a project to investigate the use of agentic AI for investigative journalism.

## Requirements

- Docker
- Bun

## Project Structure

- `data/`: Raw data from the GAIN corpus
- `postgres/`: PostgreSQL database
- `src/`: Source code
- `docs/`: Documentation

## How to run

### Create a PostgreSQL database

The custom Postgres image includes [pgvector](https://github.com/pgvector/pgvector) for embedding search.

```bash
docker compose up -d --build
```

### Setup environment variables

```bash
cp .env.example .env
```

### Setup other project dependencies

```bash
pnpm i
```

### Generate the database schema

```bash
pnpm db:generate
```

### Run the etl pipeline

```bash
pnpm etl
```
