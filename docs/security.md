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

Future domain work must scope every user-owned backend query by the authenticated user ID and use explicit admin
permissions for cross-user access. Audit logging remains a later authorized milestone.

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
