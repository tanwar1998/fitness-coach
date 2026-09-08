"use client";

import { usePathname } from "next/navigation";
import { Footer } from "@/components/Footer";

const FULLSCREEN_ROUTES = ["/pages/ai-coach"];

export function FooterSlot() {
  const pathname = usePathname();
  if (FULLSCREEN_ROUTES.some((route) => pathname === route)) {
    return null;
  }
  return <Footer />;
}
