# Daily Life Manager

Production-oriented multi-user personal management platform with secure accounts, administrator user management,
daily attendance, and personal finance foundations across the API, Admin portal, and Flutter app.

Daily attendance lets an authenticated user check in once per server-trusted local calendar date, view the current
state and monthly history, and lets administrators inspect a selected user's read-only history. Mobile timezone is
configured with the `TIMEZONE` Dart define and must be a valid IANA identifier.

Personal finance supports system and personal income/expense categories, VND transaction CRUD, monthly history, and
income/expense/net summaries. Money is accepted and returned as positive decimal strings and stored as PostgreSQL
`BIGINT`; clients must not convert it to floating point. Administrators can inspect a selected user's finance data but
cannot mutate it.

Monthly overall and expense-category budgets add integer-safe spent, remaining, usage, and exceeded calculations.
Finance analytics provide a selected-month category breakdown and a fixed six-month income/expense trend without
forecasting or long-range reporting.

Gold prices use a backend provider abstraction with a PHA adapter for a small normalized set of Vietnamese retail
products (SJC, DOJI, and PNJ), stored as integer VND per lượng. Set `GOLD_PROVIDER_API_KEY` to enable ADMIN manual
refreshes. Latest/history endpoints continue serving stored snapshots when the provider is unavailable; prices are
informational and may be delayed.

Authenticated users can configure owned SJC, DOJI, and PNJ alerts for buy/sell prices above or below an integer VND
threshold, or for percentage movement stored as integer basis points. A BullMQ job refreshes prices and evaluates enabled
rules every 15 minutes. Matching edges are persisted as trigger records; push notification delivery is deferred to
Milestone 9.

## Stack

- NestJS, TypeScript, Prisma, PostgreSQL
- Redis and BullMQ-ready queue infrastructure
- Angular, RxJS, SCSS
- Flutter for iOS and Android
- Docker Compose and GitHub Actions

## Repository structure

- `apps/api`: NestJS API, Swagger, Prisma, health checks, configuration
- `apps/admin-web`: Angular admin shell, routing, HTTP and environment foundations
- `apps/mobile`: Flutter routing, configuration, API client and home screen
- `docs`: architecture, security model and milestone roadmap
- `infrastructure`: infrastructure documentation; local services live in root `docker-compose.yml`

## Prerequisites and setup

Use Node.js 20 LTS, npm, Docker Desktop with Compose, and current stable Flutter with iOS/Android platform tooling.

1. Copy `apps/api/.env.example` to `apps/api/.env`.
2. Start dependencies with `docker compose up -d`.
3. Run `npm ci` in `apps/api` and `apps/admin-web`.
4. In `apps/api`, run `npm run prisma:generate` and `npm run prisma:deploy`.
5. Start the API with `npm run start:dev` and admin portal with `npm start`.
6. In `apps/mobile`, run `flutter pub get` then `flutter run --dart-define=API_URL=http://localhost:3000/api`.

The API defaults to `http://localhost:3000/api`; Swagger is at `/api/docs`. PostgreSQL uses port 5432 and Redis 6379.
All local credentials in Compose are development-only. Environment variables are documented in `.env.example`.

Authentication requires a random `JWT_ACCESS_SECRET` of at least 32 characters. Access TTL, refresh-session TTL, and
password-reset TTL are configurable. Bootstrap the first administrator idempotently with `ADMIN_EMAIL`,
`ADMIN_PASSWORD`, and `ADMIN_DISPLAY_NAME`, then run `npm run prisma:seed` in `apps/api`. No default administrator exists.

The auth API provides registration, login, refresh rotation, logout, current profile, password change, and password
reset request/consumption under `/api/auth`. Public registration always creates `USER`; only the environment-driven seed
can bootstrap `ADMIN` during this milestone.

Authenticated administrators manage accounts under `/api/admin/users` and the Admin portal Users screens. Role is
read-only; status changes are guarded and disabling an account revokes its sessions.

## Quality commands

- API: `npm run format`, `npm run lint`, `npm test`, `npm run test:cov:ci`, `npm run build`, `npm run prisma:generate`
- Admin: `npm run format`, `npm run lint`, `npm run test:ci`, `npm run build`
- Mobile: `dart format .`, `flutter analyze`, `flutter test`
- Entire Node foundation: root `npm run lint`, `npm test`, `npm run build`

The API integration suite uses a migrated PostgreSQL database and disables BullMQ workers with `NODE_ENV=test`. Always
point `DATABASE_URL` at a disposable test-only database before running `npm run test:e2e -- --runInBand`; the suite
deletes its own test records between journeys. GitHub Actions provides an ephemeral database, runs migrations, and then
runs both API unit and e2e suites. External Gold and Firebase calls remain mocked or disabled.

## Status

Milestones 1–8 are complete. Notification delivery and later product behavior remain pending.
