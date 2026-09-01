# Production deployment

## Architecture and support boundary

The production package exposes only the nginx-based `admin-web` service. nginx serves the Angular SPA and proxies `/api`
to the NestJS container. The API uses internal-network PostgreSQL and Redis services and hosts the current BullMQ workers.
PostgreSQL and Redis have no host ports in `compose.prod.yml`.

Use one API container for now. BullMQ's deterministic scheduler ID prevents duplicate repeat schedules, but horizontal API and
worker scaling has not been verified as an operational mode. TLS should terminate at an external load balancer or a hardened
edge reverse proxy in front of this stack; the included nginx configuration intentionally serves plain HTTP.

## Prerequisites and configuration

Install Docker Engine with Compose v2. Copy `.env.production.example` to the ignored `.env.production` file and replace every
`CHANGE_ME` value. The database password in `DATABASE_URL` must be URL-encoded. Then validate the effective configuration:

```powershell
docker compose --env-file .env.production -f compose.prod.yml config --quiet
```

Keep secrets out of Git, images, Angular/Flutter bundles, and command output. Inject them using the host environment, an ignored
environment file with restricted permissions, Docker secrets adapted by the hosting environment, or a platform secret manager.
The Angular production bundle contains only the relative `/api` URL.

`JWT_ACCESS_SECRET`, the database credentials, `GOLD_PROVIDER_API_KEY`, and `FIREBASE_SERVICE_ACCOUNT_JSON` are runtime-only.
Firebase accepts the existing compact, single-line service-account JSON setting. Mounting a secret file and exporting its
contents before Compose starts is also acceptable; never commit the JSON. An empty Firebase setting keeps push delivery safely
disabled. The Gold provider retains its HTTPS allowlist and timeout controls.

`CORS_ORIGINS` remains an explicit comma-separated allowlist for mobile or other legitimate clients. Browser Admin traffic is
same-origin through nginx. nginx is the only proxy inside this package, so `TRUST_PROXY_HOPS=1` trusts exactly that hop for audit
and rate-limit client IP handling. Use `0` when the API is reached directly, or adjust the bounded value only after documenting
the complete proxy chain.

## Build, migrate, and start

Build reproducibly and run the one-shot migration before rolling out the API:

```powershell
docker compose --env-file .env.production -f compose.prod.yml build
docker compose --env-file .env.production -f compose.prod.yml run --rm migrate migrate deploy
docker compose --env-file .env.production -f compose.prod.yml up -d
docker compose --env-file .env.production -f compose.prod.yml ps -a
```

Normal `up` also enforces the order PostgreSQL healthy → migration success and Redis healthy → API healthy → Admin. Production
uses `prisma migrate deploy`; it never creates migrations. A failed migration prevents the API from starting.

Check `http://HOST:ADMIN_PORT/`, `http://HOST:ADMIN_PORT/api/health`, and the current Swagger policy at
`http://HOST:ADMIN_PORT/api/docs`. The API health response requires both PostgreSQL and Redis. View stdout/stderr logs with:

```powershell
docker compose --env-file .env.production -f compose.prod.yml logs -f api admin-web
```

## Operations

Use `docker compose ... restart api admin-web` for a routine application restart and `docker compose ... down` to stop without
deleting named volumes. Never add `--volumes` in production. Nest handles SIGTERM/SIGINT, stops HTTP, closes BullMQ workers and
queues, closes Redis clients, and disconnects Prisma. Redis append-only persistence protects queued work across ordinary
restarts; PostgreSQL data lives in its named volume.

Back up PostgreSQL before every upgrade and on a schedule appropriate to the recovery objective. A typical logical backup is:

```powershell
docker compose --env-file .env.production -f compose.prod.yml exec -T postgres pg_dump -U daily_life_manager -d daily_life_manager -Fc > daily-life-manager.dump
```

Restore only into a deliberately selected empty/recovery database with `pg_restore`; test restores regularly and protect backup
files as secrets. Substitute the configured database/user names rather than assuming the example values.

For an upgrade: back up the database, fetch/build the new images, run the one-shot migration, update services, check health, and
perform login plus a representative API smoke test. Roll back an application image only when the deployed database migrations
remain compatible. Prisma has no automatic down-migration; restore from a verified backup when an incompatible schema rollback
is genuinely required.

Monitor container health, restart counts, API errors, BullMQ failures, disk capacity, PostgreSQL backups, and Redis persistence.
Real production still requires an operator-managed host, firewall, TLS, secret injection, backup retention, and monitoring. This
milestone does not provision cloud infrastructure, domains, certificates, production databases, Firebase projects, or mobile
store releases.
