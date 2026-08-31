# Security foundation

Milestone 1 establishes environmental validation, CORS allow-listing, Helmet security headers, strict DTO validation,
non-secret example configuration, and isolated dependency health reporting.

Milestone 2 adds Argon2id passwords, short-lived signed access tokens, digest-only rotating refresh sessions, revocation,
live status enforcement, validation, rate limits on sensitive endpoints, and explicit role guards. JWT claims contain
only user ID, role, and session ID. Access tokens remain valid only until their short expiry unless the referenced session
is revoked sooner; the strategy checks the session and account on every protected request.

Forgot-password responses are identical whether or not an account exists. Reset tokens are never stored raw, expire,
are single-use, and revoke all sessions. Delivery is an abstraction until a production mail provider is authorized.
Email verification storage exists, but delivery/enforcement is deferred.

Angular deliberately avoids local/session storage; a reload requires a new admin login. Flutter uses platform secure
storage and never SharedPreferences. Client storage reduces accidental exposure but does not replace server-side status,
session, ownership, or role enforcement.

Every user-owned backend query derives ownership from the authenticated user ID, while cross-user access uses explicit
ADMIN guards. Sensitive administrative and account-security mutations now create durable audit records.

Admin user management uses both JWT and role guards. Safe Prisma projections exclude password and token material.
Administrators cannot disable themselves or the final active administrator; deactivation and suspension transactionally
revoke active sessions. There is no hard-delete endpoint or public role mutation.

Attendance check-in trusts server time, validates the IANA timezone, and stores a normalized local date with the actual
UTC timestamp. A database unique constraint prevents concurrent duplicate daily check-ins. User history always scopes by
the authenticated subject; cross-user inspection is isolated behind the ADMIN guard and has no mutation endpoints.

Finance transactions are always scoped by authenticated user ID, while category selection permits only system defaults
or categories owned by that user and enforces matching income/expense type. Default categories are immutable; personal
categories referenced by transactions cannot be deleted. VND amounts are validated decimal strings, stored as `BIGINT`,
and serialized as strings, never floating point. Cross-user finance inspection requires the explicit ADMIN guard and is
read-only. Secrets belong in deployment secret stores, not Git. Logs must omit passwords, tokens, personal financial
data, and device credentials. Push credentials are deferred.

Budgets derive their owner from the authenticated principal and may reference only an accessible expense category.
Updates and deletion scope by both budget ID and owner. Database checks enforce positive amounts and valid calendar
fields, while partial unique indexes prevent duplicate overall or category budgets under concurrent requests. Admin
budget and analytics visibility is isolated behind a read-only ADMIN route.

Gold provider URLs are fixed by server configuration and cannot be supplied by clients. The API key remains backend-only,
provider requests have a bounded timeout, and payloads are normalized through an allowlisted product map with positive
integer validation before persistence. History ranges are restricted to 1, 7, or 30 days, and only ADMIN can trigger an
external refresh. Failed refreshes do not delete or relabel stored data as fresh.

Gold alert mutations derive ownership from the authenticated user and never accept a user ID. Supported products,
threshold combinations, integer VND values, basis points, and cooldown bounds are validated at the API and database
layers. Trigger history is scoped to its owner. Only ADMIN can request global evaluation; job payloads contain no URL or
provider override. Trigger persistence does not send notifications or expose provider credentials.
# Push notification security

Device ownership always comes from JWT identity; the API accepts no `userId`. Tokens are unique, bounded to 20–4096 characters, never returned by list/register responses, and reassigned deterministically on legitimate rotation. Device mutation is owner-scoped. Notification payloads are small, server-generated Gold Alert fields, source triggers and per-device deliveries have database uniqueness constraints, and invalid tokens are deactivated. Firebase Admin credentials remain backend-only and are never logged.

Production uses `FIREBASE_SERVICE_ACCOUNT_JSON` containing the service-account JSON. When absent, unrelated API features still start and pending notifications fail safely without exposing credential/provider details. Never commit service-account JSON, `google-services.json`, or `GoogleService-Info.plist`.

## Production-oriented hardening and audit logging

`AuditLog` is append-only through application behavior: the API exposes an ADMIN-only paginated read endpoint and no
update/delete endpoint. User status changes, password changes, password-reset completion, logout, manual Gold refresh,
and manual Gold evaluation enqueueing are recorded. Critical database mutations write their audit event in the same
transaction. External provider and queue operations record success or failure immediately afterward because they cannot
share a PostgreSQL transaction.

Audit metadata accepts only internal structured values, removes secret-shaped keys, limits keys and values, and falls
back to a truncation marker above 2 KB. User agents and IP addresses are bounded. Passwords, hashes, access/refresh/reset
tokens, push tokens, Authorization headers, API keys, Firebase credentials, and provider error details must never be
stored. Audit records are operational security data and should receive production database access controls and backups.

Access tokens default to 15 minutes and remain coupled to a live, unrevoked refresh session and ACTIVE account. Refresh
tokens are high-entropy, digest-only, rotated atomically, and rejected after reuse. Password changes revoke other
sessions; resets revoke all sessions; disabling an account revokes active sessions. Argon2id uses an explicit memory,
time, and parallelism profile. Authentication errors remain generic where account enumeration matters.

Registration, login, refresh, forgot/reset password, push-device registration, and manual global Gold operations have
endpoint-specific rate limits. The API explicitly limits JSON bodies to 100 KB and globally rejects unknown DTO fields.
Helmet supplies API-safe headers. CORS accepts only explicit HTTP(S) origins, rejects wildcard/empty/malformed values,
and retains a localhost development default. `JWT_ACCESS_SECRET` is required and must contain at least 32 characters;
production secrets belong in a secret manager and never in client bundles or source control.

Push registration no longer permits one authenticated user to claim a token already owned by another account. Device
responses continue to omit token values, and mutations remain owner-scoped. Gold provider URLs remain backend-only,
HTTPS-only configuration with a bounded timeout and allowlisted response normalization.

Residual limitations: rate limits use the current process store and should move to shared Redis before horizontally
scaling; MFA/SSO is intentionally absent; audit-log retention and archival are deployment policy rather than application
features; proxy deployments must configure trusted proxy/IP handling deliberately; and production secret rotation,
database encryption/backups, TLS termination, and perimeter controls remain deployment responsibilities.
