import type { Metadata } from "next";
import fs from "node:fs/promises";
import path from "node:path";

export const metadata: Metadata = {
  title: "Site Map — FitPulse",
  description:
    "Blueprint diagrams and architecture of the FitPulse application.",
};

const DIAGRAMS_DIR = path.join(process.cwd(), "diagrams");

function displayName(fileName: string): string {
  return fileName
    .replace(/\.html$/i, "")
    .replace(/[-_]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ");
}

async function listDiagramFiles(): Promise<string[]> {
  try {
    const entries = await fs.readdir(DIAGRAMS_DIR, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && /\.html$/i.test(entry.name))
      .map((entry) => entry.name)
      .sort((a, b) => a.localeCompare(b));
  } catch {
    return [];
  }
}

export default async function SitemapPage() {
  const files = await listDiagramFiles();

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
      <div className="text-center">
        <p className="stamp text-primary">FitPulse · Blueprint · Site map</p>
        <h1 className="mt-3 font-display text-5xl font-black uppercase tracking-tight sm:text-6xl">
          Site Map
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
          An index of the architecture and workflow diagrams for this project.
          Each entry opens its own standalone blueprint.
        </p>
      </div>

      {files.length === 0 ? (
        <div className="plate-stock mt-10 p-6 text-center sm:p-8">
          <p className="serial text-muted-foreground">
            No diagrams found in the diagrams directory.
          </p>
        </div>
      ) : (
        <div className="mt-10 flex flex-col gap-2">
          {files.map((fileName, index) => (
            <a
              key={fileName}
              href={`/diagrams/${encodeURIComponent(fileName)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="group border border-foreground/20 bg-card px-5 py-4 transition-colors hover:border-primary sm:px-6"
            >
              <div className="flex items-start gap-4">
                <span className="serial mt-0.5 w-6 shrink-0 text-right text-[11px] text-muted-foreground">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="font-display text-lg font-black uppercase tracking-tight group-hover:text-primary">
                    {displayName(fileName)}
                  </h2>
                  <p className="serial mt-1 truncate text-[11px] text-muted-foreground">
                    /diagrams/{fileName}
                  </p>
                </div>
                <span className="mt-1 hidden shrink-0 font-display text-sm font-bold uppercase tracking-wide text-primary sm:inline">
                  Open
                  <span className="ml-1 inline-block transition-transform group-hover:translate-x-1">
                    →
                  </span>
                </span>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}