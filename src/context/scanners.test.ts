import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { scanControllers } from "./javaScanner.js";
import { scanDtos } from "./dtoScanner.js";
import { scanFrontend } from "./frontendScanner.js";
import { scanExpressRoutes } from "./expressScanner.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKEND_SRC = path.resolve(__dirname, "../../../../fidar-server/src/main/java");
const FRONTEND_SRC = path.resolve(__dirname, "../../../../CallCenterUI/client/src");
const FRONTEND_SERVER_SRC = path.resolve(__dirname, "../../../../CallCenterUI/server");

test("javaScanner extracts UserController's createUser endpoint correctly", () => {
  const controllers = scanControllers(BACKEND_SRC);
  const userController = controllers.find((c) => c.className === "UserController");
  assert.ok(userController, "UserController should be found");

  const createUser = userController!.endpoints.find((e) => e.path.endsWith("/users") && e.httpMethod === "POST");
  assert.ok(createUser, "POST .../users endpoint should be found");
  assert.equal(createUser!.path, "/admin/realms/{realmName}/users");
  assert.deepEqual(createUser!.pathVars, ["realmName"]);
  assert.equal(createUser!.requestBodyType, "CreateUserRequest");
});

test("dtoScanner extracts CreateUserRequest's flat field shape", () => {
  const dtos = scanDtos(BACKEND_SRC);
  const dto = dtos.find((d) => d.className === "CreateUserRequest");
  assert.ok(dto, "CreateUserRequest DTO should be found");

  const fieldNames = dto!.fields.map((f) => f.name);
  assert.deepEqual(fieldNames, [
    "realm", "username", "email", "firstName", "lastName", "password", "roles", "attributes",
  ]);
  assert.equal(dto!.fields.find((f) => f.name === "roles")?.type, "List<String>");
});

test("frontendScanner extracts data-testid attributes from CustomerSearch and AuthorizationModal", () => {
  const { components } = scanFrontend(FRONTEND_SRC);
  const search = components.find((c) => c.file.endsWith("CustomerSearch.tsx"));
  assert.ok(search, "CustomerSearch.tsx should be scanned");
  assert.ok(search!.testIds.includes("input-customer-search"));
  assert.ok(search!.testIds.includes("button-clear-search"));

  const modal = components.find((c) => c.file.endsWith("AuthorizationModal.tsx"));
  assert.ok(modal, "AuthorizationModal.tsx should be scanned");
  assert.deepEqual(modal!.testIds, ["text-modal-title", "text-modal-customer-id", "button-close-modal"]);
});

test("expressScanner finds CallCenterUI's real /api/customers route (the browser-visible API, distinct from the Java backend)", () => {
  const controllers = scanExpressRoutes(FRONTEND_SERVER_SRC);
  const allEndpoints = controllers.flatMap((c) => c.endpoints);
  assert.ok(
    allEndpoints.some((e) => e.httpMethod === "GET" && e.path === "/api/customers"),
    "GET /api/customers should be found in CallCenterUI/server/routes.ts"
  );
});
