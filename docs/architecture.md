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

## Admin user management

`AdminUsersModule` exposes authenticated, explicit `ADMIN`-only list, detail, and status-update operations. Lists use
server-side pagination, search, filters, and allow-listed deterministic sorting. Detail projections return safe account
fields and active-session counts only. Role remains read-only. The Angular Users list and detail routes consume these
operations with debounced filters and guarded lazy routes.

## Daily attendance

Attendance belongs to a user and is uniquely constrained by user and normalized local date. The API derives that date
from server time using a validated IANA timezone; clients cannot submit arbitrary attendance dates. User endpoints expose
today, check-in, and monthly history, while the explicit ADMIN route provides read-only selected-user inspection.

## Personal finance core

`FinanceModule` owns system/personal categories and user transactions. Categories are typed as income or expense;
transactions must reference a visible category of the same type. Every transaction query includes the authenticated
`userId`, a UTC month range, deterministic ordering, and pagination. PostgreSQL `BIGINT` stores VND amounts and the API
serializes all monetary values as decimal strings. Monthly summaries aggregate in PostgreSQL. The explicit ADMIN route
reuses the same owner-scoped queries for read-only selected-user inspection.

`FinanceBudget` represents either an overall monthly expense budget or a category-specific budget. PostgreSQL partial
unique indexes enforce one budget for each valid scope despite nullable category semantics. Usage aggregates only
monthly expense transactions. Analytics reuse monthly totals and add category grouping plus an oldest-to-current fixed
six-month trend; money remains `BIGINT` until string serialization.

## Gold prices

`GoldPriceProvider` separates normalized domain prices from the configured PHA response. The adapter accepts only the
supported product map and positive integer VND/lượng buy/sell values. `GoldPriceSnapshot` stores price changes with a
content fingerprint, preventing repeated writes when a refresh returns unchanged values. Authenticated clients read
stored latest/history data; an explicit ADMIN endpoint performs the external refresh.

### Gold alert evaluation

`GoldAlert` stores user-owned absolute-price or percentage rules. Percentage thresholds use integer basis points and
compare the selected buy/sell side with the newest snapshot at or before 24 hours before the latest price. Evaluation is
bounded to those two snapshots. `wasMatching` provides edge triggering and `lastTriggeredAt` enforces the durable
cooldown.

BullMQ registers one deterministic 15-minute scheduler. Each job attempts a provider refresh, falls back to stored
snapshots when refresh fails, evaluates enabled rules, and transactionally persists `GoldAlertTrigger` with its alert
state update. Triggers are durable inputs for Milestone 9; this worker performs no notification delivery.
# Push notifications (Milestone 9)

Gold Alert evaluation commits `GoldAlertTrigger` first. It then idempotently creates one `Notification` and enqueues a deterministic BullMQ delivery job. The worker creates one `NotificationDelivery` per active `PushDevice`, calls the FCM adapter, and aggregates `SENT`, `PARTIAL`, or `FAILED`. No active devices is a deterministic `FAILED` outcome. Transient provider failures use four bounded exponential-backoff attempts; permanent invalid-token failures deactivate only that device.

The Flutter project currently has no Android/iOS host projects. Its Dart push boundary, auth lifecycle, registration, token refresh, logout deactivation, permission denial, and Gold Alert tap routing are implemented and unit-testable. Real Firebase initialization belongs in a platform-backed `PushProvider` after native host projects are intentionally added.
