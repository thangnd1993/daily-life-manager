# Daily Life Manager API

NestJS foundation with validated configuration, Swagger, Prisma/PostgreSQL lifecycle management, Redis connectivity,
and a dependency-aware health endpoint. Product domains and authentication are intentionally deferred.

Copy `.env.example` to `.env`, start the root Docker Compose stack, then run:

```sh
npm ci
npm run prisma:generate
npm run prisma:deploy
npm run start:dev
```

Quality commands are `npm run format:check`, `npm run lint`, `npm test`, and `npm run build`.
