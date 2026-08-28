# Architecture

The monorepo separates independently deployable clients and API while keeping foundation tooling discoverable. Angular
and Flutter communicate only through the documented NestJS API. PostgreSQL is the authoritative store; Redis is reserved
for queues, caching, rate-limit state, and ephemeral coordination.

The API starts with validated environment configuration, secure headers, allow-listed CORS, request validation, a global
`/api` prefix, Swagger, Prisma lifecycle management, and Redis connectivity. `/api/health` checks the process and both
dependencies. BullMQ-compatible Redis options are prepared without creating speculative business queues.

Later domain modules will be vertical NestJS modules. Every user-owned table will include `userId`; services will scope
queries by the authenticated principal, and unique/index constraints will reinforce invariants. Admin cross-user access
will use explicit permissions rather than bypassing ownership implicitly.

Angular uses standalone components, lazy routes, functional HTTP interceptors, and environment-based API endpoints.
Flutter uses a small feature-first source tree, `go_router`, compile-time configuration, and a wrapped HTTP client.
