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

Money will use integer minor units or database decimals, never floating point. Secrets belong in deployment secret stores,
not Git. Logs must omit passwords, tokens, personal financial data, and device credentials. Push credentials are deferred.
