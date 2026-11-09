# Cathay Cargo Offload Demo

This is a **frontend-only hackathon demo**. It uses fictional, in-memory fixtures and deterministic rules to illustrate a cargo offload review workflow. It does not connect to airline systems, run a trained ML model, or make bookings or cargo moves.

## Run locally

Requirements: Node.js 20.19+ or 22.12+, and npm.

```powershell
npm install
npm run dev
```

Use the URL shown by Vite. Other available checks:

```powershell
npm test
npm run lint
npm run build
```

## What the demo contains

- **Overview:** separates predicted cargo risk from simulated confirmed offload and recovery records.
- **Predictions:** applies a deterministic capacity and weather heuristic to a small set of hard-coded flights. Percent values are illustrative risk scores, not calibrated probabilities.
- **Prevention Plan:** compares sample alternatives for unconfirmed risk.
- **Recovery Plans:** compares sample options for confirmed cases and records a human review decision in local browser storage.
- **Shipments and Analytics:** show illustrative customer impact estimates and a four-flight evaluation sample. The analytics screen flags that the sample is too small for performance claims.

Navigation and scenario controls are local UI state. A saved review decision stays in the current browser only; it is not sent to an operations system.

## Data boundaries

The dashboard fixtures and formulas live in `src/domain.ts`. The generated dataset in the repository's `data/synthetic_cargo` and `data/synthetic_cargo_csv` directories is a **separate artifact** used by the Python generator and validator; the dashboard does not load or join those files. Both are fictional, and their identifier schemes are not interchangeable.

The Python dataset is documented in [`../../data/synthetic_cargo/README.md`](../../data/synthetic_cargo/README.md) from the repository root. Its validator can be run with `python scripts/validate_synthetic_cargo.py` from the repository root.

## Demo limitations

- No backend, authentication, live data feed, model training, or production deployment configuration is included.
- Risk, confidence, cost, feasibility, and recovery estimates are synthetic inputs or transparent demo heuristics. They are not operational commitments or measured savings.
- Recovery comparisons do not prove global optimality and cannot verify live capacity, cargo compatibility, connection acceptance, handling, or delivery commitments.
- The demo should not be used to make real dispatch, loading, customer, or recovery decisions.

## Backend API connection

The Settings workspace includes an optional read-only integration panel for `GET /api/v1/prevention-plans`. Configure the API origin with `VITE_API_BASE_URL` in a local `.env` file (for example, `VITE_API_BASE_URL=http://localhost:8000`). If omitted, the frontend requests the endpoint from the same origin. Restart Vite after changing the variable. Do not place credentials or secrets in frontend environment variables.

The adapter validates the backend's camelCase response fields and translates them into UI view models. The panel shows request, empty, error, and stale-data states; it displays the last successful response if a later refresh fails. The endpoint currently provides no source-data timestamp, so the panel labels only its own fetch time. The integration is read-only and remains separate from synthetic dashboard data.

## Recovery-solutions API foundation

The three operational queue screens request their queue from the shared `GET /api/v1/recovery-solutions` contract using `VITE_API_BASE_URL`. Disruption Alerts, Predicted Offload, and Pending Pool use API records for their operational queues and review flows, without substituting fixture records. Pending Pool evaluates replacement candidates against active priority targets and records audited pool decisions; candidate evaluation and review do not allocate or reserve cargo. The typed client in `src/recoveryApi.ts` covers list, detail, route options, option detail, replacement candidates, and review decisions. Queue-list responses share pagination normalization and consume `workflowControl`; the screens expose request, empty, stale, authorization, gate, validation, conflict, network, and server states.

The decision client validates required client-side fields and maps server errors into typed categories, including `401/403` authorization, `409` conflict, `422` validation, and `423` workflow gating. The server remains authoritative: do not use these client checks as authorization or as proof that a review passed current priority constraints. No cargo assignment, route booking, or offload confirmation is performed by this client.
