# Local bootstrap and Docker

This repository includes helper files to make a fresh machine able to run the project with minimal steps.

Bootstrap scripts (one-time) — creates `.env`, installs dependencies, runs DB seed and starts the dev server:

- Unix/macOS:
```bash
./scripts/bootstrap.sh
```

- Windows (PowerShell):
```powershell
pwsh ./scripts/bootstrap.ps1
```

Docker Compose (production image)

```bash
docker compose up --build
```

Notes
- The bootstrap scripts prompt for a local MySQL root password and write `DATABASE_URL` to `.env`.
- Production Docker Compose expects `APP_SECRET` and optional `MYSQL_ROOT_PASSWORD` in your environment or in an `.env` file for `docker compose`.
