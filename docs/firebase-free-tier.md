# Firestore free-tier investigation and optimization

Date: 2026-11-11, Asia/Ho_Chi_Minh. Runtime project: `hoosoo-37881`, Spark. No billing changes or runtime emulator fallback.

## Measured incident

Cloud Monitoring, retrieved with the already authorized project operator, reported 49,165 query document reads, 282 lookups and 3 not-found reads during the current quota period, versus 127 document writes (74 creates, 52 updates, 1 no-op update). The busiest observed one-minute interval had 3,264 query document reads. Raw metric series: `output/firebase/cloud-usage-investigation.json`.

These project totals include application use, earlier cloud verification and Console access; they cannot be attributed solely to the user's few clicks. Historical per-route document counters were not available. The code did show avoidable amplification: every original GET and transaction loaded all 13 collections, every mutation refreshed every active API query in every tab, and each tab opened a separate organization listener. Growing audit/receipt history multiplied the cost of otherwise small operations. Google metrics are usage estimates, not an exact billing ledger; empty queries also have a minimum read charge.

## Implemented changes

- `/me` reads the current membership, employee and company settings only. Other reads load declared dependencies, use the current membership document, and filter personal/team attendance, leave and balances in Firestore. Leave detail uses its document ID; employee history filters by target ID. Unauthorized and malformed requests are rejected before expensive business reads.
- Mutations use operation-specific transaction plans. Profile edits, attendance, leave decisions and balance adjustments read identified documents; catalog/employee integrity checks retain the bounded queries needed for uniqueness and references. Audit/ledger appends do not scan their histories. Idempotency checks read one receipt. Account provisioning uses only its employee/membership and job/receipt dependencies.
- The organization lock, permission checks, commit-before-response, overlap/manager/last-Admin checks and atomic leave balances remain. A replay with no document changes performs no writes or version bump. Receipt-only writes do not trigger a UI refresh.
- One organization snapshot listener serves all browser connections in an API process. Each transaction also updates per-collection versions. Events expose only versions and collection names. New streams validate access; membership/employee changes trigger access revalidation. Business API authorization still reads current access on every request. Streams reconnect before token expiry or after 55 minutes; heartbeat messages do not query Firestore.
- Clients refresh only API queries affected by the changed collections. Mutation responses and live signals are coalesced for 150 ms, duplicate versions are ignored, and pre-commit reads are cancelled before refetching. There is no periodic business-data polling. The [navigation cache](navigation-cache-review.md) keeps ordinary queries fresh for five minutes; session checks retain their shorter interval and token/connection recovery still revalidates.
- The backend now shares completed business reads through a bounded cache while the existing organization listener is healthy. Current authorization and transactional reads bypass retained data. Commit/live changes invalidate the affected collections; listener loss clears/disables retained results. All writes commit to Firestore and outages do not fall back to synthetic data. See the subsequent [backend read optimization](backend-read-optimization.md) for current behavior and larger-history measurements. Quota errors retain their explicit message and cooldown; listener-only failures back off that channel separately.
- Backend request logs now include Firestore read/write/query/transaction-attempt estimates. Admin-only `GET /api/v1/system/usage` returns counters since this API process started, by source and route, without passwords or tokens. These include attempted transaction work and minimum empty-query reads; they are not Google's daily billable quota totals.

## Reproducible verification

37 unit tests and 19 Auth + Express + Firestore integration tests passed, with lint, TypeScript and production builds. The integration suite runs in isolated `demo-hoosoo/hoosoo-tests` services and stops them afterward; the running local app keeps its cloud configuration.

The benchmark adds 1,000 audit and 1,000 receipt records to the isolated fixture. Loading the former whole-organization snapshot requires 2,066 reads. Actual new SDK document-read estimates were:

| Operation | Reads | Writes |
| --- | ---: | ---: |
| Read current session (`GET /me`) | 3 | 0 |
| Save own profile | 4 | 4 |
| Replay that same saved request | 4 | 0 |
| Create a department | 7 | 4 |
| Read organization chart | 16 | 0 |

Ten cycles of simultaneous session/chart reads for Admin, HR, Manager and Employee produced 80 HTTP requests and 230–261 document reads in repeated runs. The exact coalescing count depends on timing. Unit tests also verify eight subscribers share one listener, ten simulated idle minutes generate no additional database reads, department changes do not refetch session/leave queries, mutation plus live notification produces one refetch, and sign-out cancels scheduled refreshes.

Evidence: `output/firebase/quota-optimization-benchmark.json`. Re-run with:

```sh
npm test
npx firebase emulators:exec --only auth,firestore --project demo-hoosoo --config firebase/firebase.json 'npm run test:integration'
```

After cloud quota recovery, inspect counters while exercising normal UI actions:

```sh
npm run api:request -- Admin GET /system/usage
```

The measurement endpoint itself requires two fresh permission/profile reads. Do not poll it frequently. Compare its `startedAt` and route counters, and use Firebase/Google Cloud Usage for actual project totals.

## Boundaries

Code optimization does not replenish consumed quota. After the repair, real cloud GET /me and GET /organization/tree briefly returned HTTP 200 (the latter included the existing Customer Care department), but the browser and a later independent API request again returned FIRESTORE_QUOTA_EXCEEDED. There has been no successful post-optimization cloud write verification. The upstream error did not identify the precise quota dimension, so the temporary 200 responses are not evidence of full recovery or proof of a guaranteed recovery time. The benchmark is a real Firebase emulator measurement, not a cloud billing measurement or an unlimited-usage guarantee.

Organization size remains bounded at 100 employees. Administrative whole-company reports and broad audit searches can still read many relevant records; long-running/larger deployments need cursor-based report/history pagination and reviewed retention. No records were automatically purged. Manual document edits in Console require app refresh unless the organization revision is also advanced. Multiple API processes each have one listener.

References: [Firestore usage monitoring](https://firebase.google.com/docs/firestore/monitor-usage), [document/query/listener billing](https://firebase.google.com/docs/firestore/pricing), [free quota and reset](https://firebase.google.com/docs/firestore/quotas).
