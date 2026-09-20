"use client";

import Link from "next/link";
import { Logo } from "@/components/Logo";

const CURRENT_YEAR = new Date().getFullYear();

const FOOTER_LINKS = [
  { href: "/", label: "Home" },
  { href: "/pages/exercise", label: "Exercises" },
  { href: "/pages/progress", label: "Progress" },
  { href: "/pages/ai-coach", label: "AI Coach" },
  { href: "/pages/sitemap", label: "Site Map" },
  { href: "/pages/disclaimer", label: "Disclaimer" },
];

export function Footer() {
  return (
    <footer className="border-t-2 border-foreground/15 bg-background">
      <div className="perforation mx-auto" />
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-4 py-10 sm:px-6 md:flex-row md:justify-between">
        <Logo />

        <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
          {FOOTER_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="font-semibold transition-colors hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <p className="serial text-sm text-muted-foreground">
          © {CURRENT_YEAR} FitPulse · S/N 01
        </p>
      </div>
    </footer>
  );
}