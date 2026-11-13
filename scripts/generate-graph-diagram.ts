/**
 * Regenerate the coach graph diagrams from the COMPILED LangGraph graph.
 *
 * The source of truth is `buildCoachGraphV2()` + LangGraph's
 * `CompiledGraph.getGraph().drawMermaid()`. Never hand-edit the blocks between
 * the markers — the script overwrites them.
 *
 *   npm run graph:diagram          # update README + docs
 *   npm run graph:diagram:check    # fail if either copy is stale (CI)
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { buildCoachGraphV2 } from "../src/lib/server/ai/graph-v2";

const ROOT = process.cwd();
const START = "<!-- coach-graph-v2:start -->";
const END = "<!-- coach-graph-v2:end -->";
const GENERATED_NOTE =
  "<!-- Generated from the compiled graph by `npm run graph:diagram`. Do not edit by hand. -->";

const README = "README.md";
const DOCS = join("docs", "coach-graph-v2.md");

function renderMermaid(): string {
  const compiled = buildCoachGraphV2();
  return compiled
    .getGraph()
    .drawMermaid({ withStyles: false })
    .trimEnd();
}

function block(mermaid: string): string {
  return [
    START,
    GENERATED_NOTE,
    "",
    "```mermaid",
    mermaid,
    "```",
    END,
  ].join("\n");
}

function replaceBlock(source: string, generated: string, path: string): string {
  const start = source.indexOf(START);
  const end = source.indexOf(END);
  if (start === -1 || end === -1 || end < start) {
    throw new Error(
      `Missing ${START} / ${END} markers in ${path}. Add the generated block once, then re-run.`,
    );
  }
  const eol = source.includes("\r\n") ? "\r\n" : "\n";
  const next = generated.replace(/\n/g, eol);
  return source.slice(0, start) + next + source.slice(end + END.length);
}

function renderDocs(generated: string): string {
  return [
    "# Coach graph v2",
    "",
    "The diagram below is generated from the compiled LangGraph graph, not drawn",
    "by hand. Regenerate it with `npm run graph:diagram`; CI can run",
    "`npm run graph:diagram:check` to reject a stale copy.",
    "",
    "`log_or_edit_workout` intentionally passes through `confirm_workout_action`",
    "before the guardrail: the graph pauses on `interrupt()` until the user",
    "confirms the write. Conditional-edge labels are not emitted by",
    "LangGraph's `drawMermaid()`, so the branches appear as dotted edges.",
    "",
    generated,
    "",
  ].join("\n");
}

async function main(): Promise<void> {
  const check = process.argv.includes("--check");
  const generated = block(renderMermaid());

  const stale: string[] = [];
  const updated: string[] = [];

  const readmePath = join(ROOT, README);
  const readme = await readFile(readmePath, "utf8");
  const nextReadme = replaceBlock(readme, generated, README);
  if (nextReadme !== readme) {
    if (check) stale.push(README);
    else {
      await writeFile(readmePath, nextReadme, "utf8");
      updated.push(README);
    }
  }

  const docsPath = join(ROOT, DOCS);
  const nextDocs = renderDocs(generated);
  const currentDocs = await readFile(docsPath, "utf8").catch(() => "");
  if (currentDocs !== nextDocs) {
    if (check) stale.push(DOCS);
    else {
      await mkdir(join(ROOT, "docs"), { recursive: true });
      await writeFile(docsPath, nextDocs, "utf8");
      updated.push(DOCS);
    }
  }

  if (check) {
    if (stale.length > 0) {
      console.error(
        `Stale graph diagram in: ${stale.join(", ")}. Run \`npm run graph:diagram\`.`,
      );
      process.exitCode = 1;
      return;
    }
    console.info("Graph diagram is up to date.");
    return;
  }

  console.info(
    updated.length > 0
      ? `Updated graph diagram in: ${updated.join(", ")}.`
      : "Graph diagram was already up to date.",
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
