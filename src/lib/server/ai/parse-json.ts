/**
 * Extract the first complete, balanced JSON value from a model reply.
 * Models are instructed to return JSON-only, but they sometimes wrap the
 * payload in code fences or trailing prose, so we tolerate that instead of
 * failing the whole request. Returns null when no JSON value can be found.
 */
export function extractJson<T>(raw: string): T | null {
  const clean = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();

  try {
    return JSON.parse(clean) as T;
  } catch {
    // Fall through to the scan below.
  }

  for (const open of ["{", "["] as const) {
    const close = open === "{" ? "}" : "]";
    const start = clean.indexOf(open);
    if (start === -1) continue;

    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let i = start; i < clean.length; i++) {
      const ch = clean[i];
      if (inString) {
        if (escaped) escaped = false;
        else if (ch === "\\") escaped = true;
        else if (ch === '"') inString = false;
        continue;
      }
      if (ch === '"') {
        inString = true;
        continue;
      }
      if (ch === open) {
        depth++;
      } else if (ch === close) {
        depth--;
        if (depth === 0) {
          try {
            return JSON.parse(clean.slice(start, i + 1)) as T;
          } catch {
            break;
          }
        }
      }
    }
  }

  return null;
}