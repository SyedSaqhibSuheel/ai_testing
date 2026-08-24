# generated-tests-repo

Playwright TypeScript tests for the CallCenter helpdesk portal (`CallCenterUI`),
generated and committed automatically by the **AI Testing Platform**
(`../ai-test-framework/`) after human approval.

This repo is intentionally separate from `CallCenterUI/` and `fidar-server/` -
those are the read-only systems under test and are never modified by the
platform. This repo only ever receives generated `.spec.ts` files under
`tests/generated/`.

Every file here is traceable back to its originating requirement and test
scenarios in the AI Testing Platform's dashboard.

## Setup

```sh
npm install
npx playwright install chromium
```

## Running the generated tests

Not part of Phase 1 (see the platform's plan) - this repo is the hand-off
point for the next phase (CI/CD, deterministic execution). Once that phase
exists:

```sh
PLAYWRIGHT_BASE_URL=http://localhost:5000 npx playwright test
```
