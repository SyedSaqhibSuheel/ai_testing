import type { AppContext, ComponentTestIds, ControllerInfo, DtoInfo, RouteInfo } from "./types.js";

const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "to", "of", "in", "on", "for", "is", "are",
  "must", "should", "when", "with", "by", "as", "be", "it", "this", "that",
  "their", "its", "into", "will", "can", "has", "have", "if", "then",
]);

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length > 2 && !STOPWORDS.has(t))
  );
}

function overlapScore(bagA: Set<string>, bagB: Set<string>): number {
  let score = 0;
  for (const tok of bagA) if (bagB.has(tok)) score++;
  return score;
}

function controllerBag(controller: ControllerInfo): Set<string> {
  const text = [
    controller.className,
    ...controller.basePaths,
    ...controller.endpoints.flatMap((e) => [e.path, e.summary ?? "", e.requestBodyType ?? ""]),
  ].join(" ");
  return tokenize(text);
}

function dtoBag(dto: DtoInfo): Set<string> {
  return tokenize([dto.className, ...dto.fields.map((f) => f.name)].join(" "));
}

function componentBag(component: ComponentTestIds): Set<string> {
  return tokenize([component.componentName ?? "", component.file, ...component.testIds].join(" "));
}

function routeBag(route: RouteInfo): Set<string> {
  return tokenize([route.path, route.component ?? ""].join(" "));
}

export interface RelevantContext {
  controllers: ControllerInfo[];
  dtos: DtoInfo[];
  components: ComponentTestIds[];
  routes: RouteInfo[];
}

/**
 * Ranks scanned backend/frontend context against the requirement text by
 * simple keyword overlap, keeping only the top matches so the planner
 * prompt stays small. DTOs referenced by a selected endpoint's request
 * body are always pulled in even if they didn't independently rank, since
 * the planner needs their shape to write a valid request.
 */
export function selectRelevantContext(
  requirement: string,
  context: AppContext,
  limits: { controllers?: number; dtos?: number; components?: number } = {}
): RelevantContext {
  const reqTokens = tokenize(requirement);
  const { controllers: maxControllers = 10, dtos: maxDtos = 8, components: maxComponents = 10 } = limits;

  const rankedControllers = context.backend.controllers
    .map((c) => ({ c, score: overlapScore(reqTokens, controllerBag(c)) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, maxControllers)
    .filter((entry) => entry.score > 0 || context.backend.controllers.length <= maxControllers)
    .map((entry) => entry.c);

  const rankedComponents = context.frontend.components
    .map((c) => ({ c, score: overlapScore(reqTokens, componentBag(c)) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, maxComponents)
    .filter((entry) => entry.score > 0 || context.frontend.components.length <= maxComponents)
    .map((entry) => entry.c);

  const referencedDtoNames = new Set(
    rankedControllers.flatMap((c) => c.endpoints.map((e) => e.requestBodyType)).filter(Boolean) as string[]
  );

  const rankedDtos = context.backend.dtos
    .map((d) => ({
      d,
      score: overlapScore(reqTokens, dtoBag(d)) + (referencedDtoNames.has(d.className) ? 100 : 0),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, maxDtos)
    .filter((entry) => entry.score > 0)
    .map((entry) => entry.d);

  const rankedRoutes = context.frontend.routes
    .map((r) => ({ r, score: overlapScore(reqTokens, routeBag(r)) }))
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.r);

  return {
    controllers: rankedControllers,
    dtos: rankedDtos,
    components: rankedComponents,
    routes: rankedRoutes.length > 0 ? rankedRoutes : context.frontend.routes,
  };
}
