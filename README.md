# agentic-investigation

## Overview

This is a project to investigate the use of agentic AI for investigative journalism.

## Requirements

- Docker (Docker Desktop with the WSL2 backend on Windows)
- Bun
- pnpm
- Git

The pipeline is verified on Windows, macOS, and Linux. See
[Cross-platform notes](#cross-platform-notes-windows-macos-linux) for the
Windows-specific setup details.

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

## Cross-platform notes (Windows, macOS, Linux)

All file-path handling in the ETL pipeline uses `node:path` (and forward-slash
normalization for `glob`), so the same commands work on every OS. A few
environment details matter when running on **native Windows**:

### Line endings must stay LF

The Postgres image builds from a Dockerfile and shell entrypoints under
`postgres/` that run **inside the Linux container**. If they are checked out
with Windows CRLF endings, the container crash-loops with
`env: can't execute 'bash'` (exit 127), because the shebang is read as
`/usr/bin/env bash\r`.

A [`.gitattributes`](.gitattributes) pins `*.sh` and `Dockerfile` to `eol=lf`,
so a fresh clone is correct by default. If you ever hit that error after
changing `git` settings, re-normalize the working tree:

```bash
git add --renormalize .
git checkout -- postgres/
docker compose up -d --build
```

### Always start Postgres with `--build`

```bash
docker compose up -d --build
```

`pgvector` is compiled into the custom image. A stale image built before the
pgvector layer makes `pnpm db:migrate` fail with
`extension "vector" is not available` — rebuilding fixes it.

### Install dependencies on the target OS

Run `pnpm install` on the machine you will actually use. A `node_modules`
directory copied from another OS (e.g. macOS) is missing the Windows binaries
for `tsc` / `drizzle-kit` and fails with `Cannot find module`.

### Performance

The first macOS run took ~8 min; an early native-Windows run took ~30–40 min.
The gap was almost entirely disk I/O, addressed by:

- **Named Docker volume** (configured in
  [`docker-compose.yaml`](docker-compose.yaml)): the Postgres data directory
  lives on the Docker VM's native ext4 filesystem instead of a host bind-mount,
  avoiding the slow Windows 9p/virtiofs bridge on every write.
- **Windows Defender exclusion** (optional but recommended): real-time scanning
  of the ~410K House XML reads adds significant overhead. Exclude the repo and
  corpus folders, e.g. in an **Administrator** PowerShell:

  ```powershell
  Add-MpPreference -ExclusionPath "C:\path\to\agentic-investigation"
  ```

### Verified run (native Windows)

Full corpus ETL, native Windows 11 (no WSL), Bun runtime, Docker Desktop
(WSL2 backend), laptop on AC power:

| Metric | Value |
|--------|-------|
| Total pipeline time | **10m 34s** |
| Records ingested | 1,732,740 (senate 1,486,239 · congress_press 137,716 · house 108,559) |
| House XML files parsed | ~410K (0 parse errors) |
| Path errors | 0 |
| Stored `file_path` format | POSIX `/data/...` (identical to macOS/Linux) |

For reference, the same pipeline took ~8 min on macOS and ~30–40 min on an
early native-Windows attempt (host bind-mount + Defender scanning the corpus).
The named volume and Defender exclusion close most of that gap.

