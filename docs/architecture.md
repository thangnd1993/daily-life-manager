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

## Authentication

Accounts use normalized unique emails, Argon2id password hashes, explicit `USER`/`ADMIN` roles, and
`ACTIVE`/`INACTIVE`/`SUSPENDED` status. Public registration cannot choose a role. Protected requests validate a short-lived
JWT plus its session record and current account status; role checks use an explicit decorator and guard.

Refresh credentials are opaque random values. Only SHA-256 digests are persisted in `AuthSession`, and every refresh
atomically replaces the digest. Logout revokes the current session. Password changes revoke every other session while
keeping the authenticated session; password resets revoke every session.

Password reset tokens are random, digest-only, expiring, and single-use. `PasswordResetDeliveryService` is the provider
boundary; production mail delivery remains deliberately unconfigured and tokens are never logged or returned. Tests use
an isolated capture adapter.

Flutter persists credentials only through platform Keychain/Keystore secure storage. Its client serializes refresh work,
retries a protected request once, and clears auth state on failure. Angular keeps credentials only in memory, trading
reload persistence for reduced XSS exposure, and requires an explicit `ADMIN` guard for its dashboard.
