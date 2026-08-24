# ai-test-framework

An **AI Testing Platform** for the **fidar-server** (Spring Boot) and
**CallCenterUI** (React) repos that live alongside this directory. Neither
repo is ever modified - they're strictly the system under test.

Phase 1 (this build) covers everything up to, but not including, running the
generated tests: a human enters a requirement, AI agents analyze it into
scenarios, explore the live app to ground those scenarios into a concrete
plan, generate real Playwright TypeScript tests from the approved plan, and
(after approval) commit them to git - all visible and controllable from one
dashboard, with a configurable Manual / Semi-Automatic / Fully-Automatic
approval mode. The next phase picks up from the committed tests: CI/CD,
deterministic execution, pass/fail, and failure healing.

## How it works

```
Human
  |  types a requirement in plain English
  v
Requirement  (stored: status, submitter, timestamps)
  |  POST /requirements/:id/analyze
  v
AI Testing Intelligence Layer  (server/agents/intelligenceAgent.ts)
  |  one LLM call: requirement -> functional requirements, user roles,
  |  validation rules, risk areas, + draft scenarios (positive/negative/edge)
  v
Scenarios  (status: ai_proposed)  <-- GATE G1: human approve/reject/edit/regenerate
  |  POST /requirements/:id/plan
  v
Playwright Planner  (server/agents/exploreApp.ts + groundScenarios.ts)
  |  1. Explores the LIVE running app via a real Playwright MCP browser
  |     session (bounded agentic loop, catalogs pages/testids/flows, cross-
  |     references against the static code scan of both repos)
  |  2. Grounds each approved scenario into a concrete plan: real routes,
  |     real data-testid locators, real backend endpoints, pass criteria
  v
Scenarios  (status: grounded_pending_review)  <-- GATE G2: human approve
  |  POST /requirements/:id/generate
  v
Playwright Generator  (server/agents/generatorAgent.ts)
  |  one LLM call: grounded scenarios -> one real .spec.ts file (grouped by
  |  requirement, one test() per scenario). Validated before a human ever
  |  sees it: TypeScript syntax check + a locator-hallucination check that
  |  rejects any getByTestId() not actually confirmed by the scan/exploration
  v
Test file  (status: syntax_valid)  <-- GATE G3: human approve
  |  POST /git/commit
  v
Git commit  (server/git/managedRepo.ts, via simple-git)  <-- GATE G4
  |  writes the file into ../generated-tests-repo (a separate git repo) and
  |  commits it - fidar-server/ and CallCenterUI/ are never touched
  v
Ready for CI/CD  <-- Phase 2 starts here (not built yet)
```

Every gate (G1-G4) is a real status transition in SQLite with an audit-log
row (`approval_audit_log`: who/what/when/why). **Approval mode** (Settings
page) controls how many of those gates need a human click:

| Mode | G1 scenario intent | G2 grounded plan | G3 generated code | G4 commit |
|---|---|---|---|---|
| Manual | human | human | human | human |
| Semi-Automatic | human | human | auto (if valid) | auto |
| Fully-Automatic | auto | auto | auto (if valid) | auto |

A failed agent run **never** auto-advances, in any mode.

**The three agents**, their live status, and full history (input/output/
errors/retries) are visible on the **Agent Activity** page and pushed to the
dashboard in real time via Server-Sent Events (`GET /api/agent-runs/stream`) -
every write to the `agent_runs` table broadcasts immediately, so a requirement
page shows "Exploring application" / "Building test plan" / etc. live without
polling.

**Reused from the underlying `src/` library** (built earlier, still used):
the LLM provider abstraction (Anthropic/OpenAI/Gemini/mock), the static
scanners for both repos (Java controllers, DTOs, React routes/testids, the
Express BFF's own API surface), and the pinned local Playwright MCP client.

## Setup

```sh
cd ai-test-framework
npm install
cp .env.example .env
```

Install the browser Playwright MCP needs (one-time, ~180MB):

```sh
node_modules/.bin/playwright-mcp install-browser chrome-for-testing
```

Apply the database migration (creates `data/platform.db`):

```sh
npm run db:migrate
```

Edit `.env`:

- Leave `LLM_PROVIDER=mock` to try the whole pipeline offline (no API key
  needed, see **Testing locally** below).
- Set `LLM_PROVIDER=gemini` + `GEMINI_API_KEY=...` for a genuinely free real
  model (no billing/credit card needed) - get a key at
  https://aistudio.google.com/apikey. `anthropic`/`openai` also work if you
  have those keys, but both require billing to be enabled.
- Start `CallCenterUI` (`npm run dev`, port 5000, or point `APP_BASE_URL` at
  a staging deployment) before running the Planner against a live app.

## Running it

```sh
npm run server:start   # Express API on http://localhost:4701
npm run web:dev        # React dashboard on http://localhost:5175 (proxies /api to the server)
```

(or `npm run dev` to run both together via `concurrently`.)

Open **http://localhost:5175**. From there:

1. **Requirements** - submit a plain-English requirement.
2. On the requirement's page: **Analyze** -> review/edit/approve/reject/
   regenerate the draft scenarios.
3. **Run Planner** -> review/approve the grounded plan.
4. **Generate Tests** -> review the code, approve.
5. **Commit to Git**.

The **Dashboard**, **Scenarios**, **Generated Tests**, **Git**, and **Agent
Activity** pages give cross-requirement views of the same data. **Settings**
controls the approval mode and shows (never edits) which provider keys are
configured.

## Testing locally

**1. Offline, free, no running apps needed** - proves the whole pipeline's
plumbing (DB, API, agents, real Playwright MCP browser spawn, UI, git
commits) without spending any API quota:

```sh
# in .env: LLM_PROVIDER=mock
npm run build
npm run server:start   # terminal 1
npm run web:dev        # terminal 2
```

Submit any requirement and click through Analyze -> approve scenarios ->
Run Planner -> approve plan -> Generate Tests -> approve -> Commit to Git.
The mock provider gives deterministic (not realistic) content, but every
step is real: a real browser actually navigates during Planner runs, a real
`.spec.ts` file is really written and syntax-checked, a real `git commit`
happens in `../generated-tests-repo`.

**2. With a real model** - switch `.env` to `LLM_PROVIDER=gemini` (or
`anthropic`/`openai`) with a real key, restart the server, repeat the same
click-through. This is what actually judges plan/code quality.

**3. Regression tests** for the static scanners (Java/DTO/React/Express),
run against the real `fidar-server`/`CallCenterUI` source, no mocks:

```sh
npm run test
```

**4. API-level smoke test**, useful when iterating on the backend without
opening the UI:

```sh
curl -s -X POST http://localhost:4701/api/requirements \
  -H "Content-Type: application/json" \
  -d '{"rawText":"...", "submittedBy":"you@example.com"}'
# -> take the returned id
curl -s -X POST http://localhost:4701/api/requirements/<id>/analyze
curl -s http://localhost:4701/api/requirements/<id>   # poll for scenarios
curl -s -X POST http://localhost:4701/api/scenarios/<scenarioId>/approve \
  -H "Content-Type: application/json" -d '{"actor":"you@example.com"}'
curl -s -X POST http://localhost:4701/api/requirements/<id>/plan
curl -s -X POST http://localhost:4701/api/requirements/<id>/generate
curl -s http://localhost:4701/api/dashboard/summary
```

**5. Fully-Automatic mode**, to check the whole pipeline end to end with zero
manual clicks (useful after changing gate logic):

```sh
curl -s -X PATCH http://localhost:4701/api/settings \
  -H "Content-Type: application/json" -d '{"approvalMode":"fully_automatic"}'
```
then just call `/analyze`, `/plan`, `/generate` in sequence - scenarios and
test files auto-approve and it auto-commits.

Reset with `{"approvalMode":"manual"}` afterwards.

### Legacy CLI + single-page dashboard

The original CLI (`context`/`plan`/`run-plan`/`all`) and its vanilla-JS
dashboard (`npm run dashboard`, port 4700) still work - they run one
requirement through an ephemeral agentic browser session to a live PASS/FAIL
verdict directly, with no persistence/approval workflow. Useful for a quick
one-off check; the platform above is the actual product.

```sh
npm run context                          # scan both repos, print a summary
npm run all -- "requirement text"        # plan + run in one step, live PASS/FAIL
npm run dashboard                        # view legacy runs at http://localhost:4700
```

## Notes

- The frontend/backend scan is cached in `.cache/context.json`, keyed by a
  content hash of both source trees - it rescans automatically when either
  repo changes.
- `npm run db:generate` regenerates the SQL migration after changing
  `server/db/schema.ts`.
- `../generated-tests-repo/` is a separate git repository this platform
  commits generated tests into - never `fidar-server/` or `CallCenterUI/`'s
  own history. It's pushed to `git@github.com:FidarOrg/ai_testing.git`.
- Never point `APP_AUTH_TOKEN`/`APP_LOGIN_*` or any `.env` value at
  fidar-server's local secrets/properties files - supply your own test
  credential. Secrets never appear in the Settings UI, only whether they're
  configured.
