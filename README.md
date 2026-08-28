# Daily Life Manager

Production-oriented multi-user personal management platform. Milestone 1 establishes the monorepo, API, admin portal,
mobile foundation, local infrastructure, automated checks, and architecture documentation. Product features are not yet
implemented.

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

## Quality commands

- API: `npm run format`, `npm run lint`, `npm test`, `npm run build`, `npm run prisma:generate`
- Admin: `npm run format`, `npm run lint`, `npm run test:ci`, `npm run build`
- Mobile: `dart format .`, `flutter analyze`, `flutter test`
- Entire Node foundation: root `npm run lint`, `npm test`, `npm run build`

## Status

Milestone 1 foundation is implemented. Authentication, user administration, attendance, finance, gold prices, alerts,
notifications, and other product behavior remain intentionally pending. See [the roadmap](docs/roadmap.md).
