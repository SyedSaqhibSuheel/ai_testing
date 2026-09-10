import type { RelevantContext } from "../context/selectRelevantContext.js";

function formatContext(context: RelevantContext): string {
  const endpoints = context.controllers
    .flatMap((c) =>
      c.endpoints.map(
        (e) =>
          `- ${e.httpMethod} ${e.path}${e.requestBodyType ? ` (body: ${e.requestBodyType})` : ""}${
            e.summary ? ` — ${e.summary}` : ""
          } [${c.className}]`
      )
    )
    .join("\n");

  const dtos = context.dtos
    .map((d) => `- ${d.className}: { ${d.fields.map((f) => `${f.name}: ${f.type}`).join(", ")} }`)
    .join("\n");

  const routes = context.routes.map((r) => `- ${r.path}${r.component ? ` -> ${r.component}` : ""}`).join("\n");

  const components = context.components
    .map((c) => `- ${c.componentName ?? c.file}: testids [${c.testIds.join(", ")}]`)
    .join("\n");

  return [
    "## Backend endpoints",
    endpoints || "(none matched)",
    "",
    "## Backend DTOs",
    dtos || "(none matched)",
    "",
    "## Frontend routes",
    routes || "(none matched)",
    "",
    "## Frontend components and their data-testid locators",
    components || "(none matched)",
  ].join("\n");
}

export function buildPlannerSystemPrompt(): string {
  return [
    "MOCK_TASK: plan",
    "You are a senior QA engineer for a banking helpdesk web application (a React frontend backed by a Spring Boot API).",
    "Given a plain-English business requirement and the relevant scanned backend endpoints/DTOs and frontend routes/data-testid locators below, produce a JSON test plan.",
    "",
    "Rules:",
    "- Every step that targets a UI element MUST use one of the exact data-testid values listed, via `targetTestId`. Never invent a testid that isn't listed.",
    "- Every step that targets a route MUST use one of the exact route paths listed, via `targetRoute`.",
    "- Every expected backend call MUST use one of the exact method+path pairs listed.",
    "- Prefer 2-4 scenarios: at least one happy path and at least one negative/edge case implied by the requirement.",
    "- passCriteria must be concrete and checkable from the UI or network log, and must be traceable back to the requirement text - do not invent business rules that aren't implied by the requirement.",
    "- Output ONLY a single JSON object matching this shape (no markdown fences, no commentary):",
    "",
    JSON.stringify(
      {
        requirement: "string",
        generatedAt: "ISO-8601 string",
        scenarios: [
          {
            id: "string",
            title: "string",
            requirementRef: "string - quote or paraphrase of the relevant part of the requirement",
            preconditions: ["string"],
            steps: [
              {
                index: 0,
                action: "string - plain English action",
                targetTestId: "string (optional)",
                targetRoute: "string (optional)",
                inputValue: "string (optional)",
                notes: "string (optional)",
              },
            ],
            expectedBackendCalls: [{ method: "GET|POST|PUT|DELETE|PATCH", path: "string", expectedStatus: 200 }],
            expectedUiOutcomes: ["string"],
            passCriteria: ["string"],
          },
        ],
      },
      null,
      2
    ),
  ].join("\n");
}

export function buildPlannerUserPrompt(requirement: string, context: RelevantContext): string {
  return [`REQUIREMENT: ${requirement}`, "", formatContext(context)].join("\n");
}
