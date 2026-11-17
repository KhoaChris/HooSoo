# Security boundaries and release policy

HooSoo is an academic HR application. This document records implemented controls and required deployment work; it does not certify production security or legal compliance.

## Implemented application controls

- Firebase ID tokens are verified with revocation checking (`verifyIdToken(token, true)`). Business requests also require an active organization membership and non-terminated employee. Access decisions use role hierarchy, ownership and assigned scope, including on idempotency replay.
- Structured schemas reject unknown fields and invalid commands. State transitions, current versions, transaction receipts and atomic writes protect approval/assignment flows. API errors expose a reference ID rather than internal stack traces.
- Browser-to-Firestore business access is denied in `firebase/firestore.rules`. The Admin SDK bypasses those rules, so server authorization and service-account IAM remain mandatory.
- API responses use `Cache-Control: no-store`; Helmet, explicit CORS origins, request size limits and rate limits are enabled. Production CORS and absolute frontend API URLs require HTTPS. `/api/health` does not read Firestore; explicit `/api/ready` probes are limited to 12 per minute per process/IP.
- Logging uses structured operational metadata and explicit secret-field redaction. Password-change fields are never stored in Firestore. Password changes require Firebase reauthentication and end the browser session.
- At the user's request, development sign-in logs the ID token only on a loopback host in a development build. Production and remote development hosts do not log it. Treat even a local logged token as a credential.
- Client caches are per account and cleared on sign-out/account change. New service screens reuse existing cache invalidation and add no polling.
- CSV export neutralizes spreadsheet formula prefixes. Certificate links accept HTTPS only, are not fetched by the server, and open with `noopener noreferrer`.

## Data handling

The demonstration uses synthetic records. Only collect data needed by the selected HR workflow. Personal salary and private conversations retain their existing independent visibility rules. Offboarding disables access and preserves business/audit history; it does not silently erase records or remove evidence of approvals. The application has no automatic retention/deletion scheduler. A deploying organization must define retention periods, lawful processing arrangements, authorized export/deletion procedures and a responsible contact before using real employee data.

## Required before a real release

1. Verify deployed deny-client Firestore rules and least-privilege IAM in the actual project. Use workload identity/ADC; never ship service-account keys to the browser.
2. Configure and verify TLS, authorized domains, exact CORS origins, reverse-proxy forwarding and a trusted proxy/rate-limit configuration for the real infrastructure. Multi-instance deployments need shared rate-limit/coordination state.
3. Enable appropriate MFA/SSO and recovery controls, perform account/session revocation exercises, and verify long-lived stream behavior. Next-request revocation enforcement is not a guarantee of instantaneous termination of every existing connection.
4. Verify dependency audit, secret scanning, backup retention and a successful restore. Test load, query costs and transaction limits with representative volumes. Do not increase workspace capacities without a query/pagination design.
5. Conduct independent penetration and authorization review. Unit tests and UI checks alone do not establish security certification.

Report a suspected issue privately to the project maintainer/organization administrator with the route, request reference and redacted reproduction steps. Never include passwords, live tokens or employee data in public issue reports.

## References

- [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html): deny-by-default, permission checks per request, and limitations of tests.
- [Firebase security rules guidance](https://firebase.google.com/docs/firestore/security/insecure-rules): server SDKs bypass Firestore Security Rules.
- [Express production security](https://expressjs.com/en/advanced/best-practice-security/): TLS, headers and dependency maintenance.
