"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * The `uni` cookie is written client-side (university picker, campus
 * switcher) and followed by a soft client navigation. `data-uni` on <html>
 * is only ever set by the root layout's server component, which does NOT
 * re-run on soft navigations in the App Router — so without this, picking
 * a new campus updates the cookie (and therefore the data) but leaves the
 * page's colors stuck on whatever campus was active at the last hard load.
 * This keeps <html data-uni> in sync with the cookie on every route change.
 */
export function UniSync() {
  const pathname = usePathname();

  useEffect(() => {
    const match = document.cookie.match(/(?:^|;\s*)uni=([^;]+)/);
    const uni = match ? decodeURIComponent(match[1]) : null;
    if (uni) {
      document.documentElement.setAttribute("data-uni", uni);
    }
  }, [pathname]);

  return null;
}
