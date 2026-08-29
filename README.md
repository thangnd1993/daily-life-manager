# Daily Life Manager

Production-oriented multi-user personal management platform. Milestones 1–3 establish the monorepo, infrastructure,
secure account/session APIs, authenticated mobile experience, and protected administrator user management. Personal
management domains are not yet implemented.

Daily attendance lets an authenticated user check in once per server-trusted local calendar date, view the current
state and monthly history, and lets administrators inspect a selected user's read-only history. Mobile timezone is
configured with the `TIMEZONE` Dart define and must be a valid IANA identifier.

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

- API: `npm run format`, `npm run lint`, `npm test`, `npm run build`, `npm run prisma:generate`
- Admin: `npm run format`, `npm run lint`, `npm run test:ci`, `npm run build`
- Mobile: `dart format .`, `flutter analyze`, `flutter test`
- Entire Node foundation: root `npm run lint`, `npm test`, `npm run build`

## Status

Milestones 1–4 are complete. Finance, gold prices, alerts, notifications, and later product behavior remain pending.
