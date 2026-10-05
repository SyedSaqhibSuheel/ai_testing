/**
 * Every LLM prompt that used to hardcode "CallCenterUI"/"banking helpdesk web
 * app" now gets its framing from this instead, sourced from the active
 * Application's own name/description (see server/config/activeApplication.ts)
 * - so the same prompts work for whatever application is actually configured,
 * not just the one this platform originally shipped with.
 */
export function describeApp(name?: string, description?: string): string {
  if (!name) return "the target web application";
  return description ? `"${name}" (${description})` : `"${name}"`;
}
