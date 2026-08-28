# Security foundation

Milestone 1 establishes environmental validation, CORS allow-listing, Helmet security headers, strict DTO validation,
non-secret example configuration, and isolated dependency health reporting. It does not claim authentication or RBAC.

Future work must enforce ownership in backend queries (`record.userId === authenticatedUser.id`) and use explicit admin
permissions for cross-user access. Authentication will require modern password hashing, short-lived access tokens,
rotated hashed refresh tokens, revocation, account status checks, rate limits, and auditable state changes.

Money will use integer minor units or database decimals, never floating point. Secrets belong in deployment secret stores,
not Git. Logs must omit passwords, tokens, personal financial data, and device credentials. Push credentials are deferred.
