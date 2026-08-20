import Link from "next/link";
import { Logo } from "@/components/Logo";

const FOOTER_LINKS = [
  { href: "/", label: "Home" },
  { href: "/pages/exercise", label: "Exercises" },
  { href: "/pages/progress", label: "Progress" },
  { href: "/pages/ai-coach", label: "AI Coach" },
  { href: "/pages/disclaimer", label: "Disclaimer" },
];

export function Footer() {
  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-4 py-10 sm:px-6 md:flex-row md:justify-between">
        <Logo />

        <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
          {FOOTER_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="font-medium transition-colors hover:text-primary"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <p className="text-sm text-muted-foreground">
          © {new Date().getFullYear()} FitCoach. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
