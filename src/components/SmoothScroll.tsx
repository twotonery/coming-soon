"use client";

import Lenis from "lenis";
import { useEffect } from "react";

// Eases the whole page's scroll. Lenis still moves the real window scroll, so
// scroll listeners (navbar tone, the highlight stack) keep working as before.
// In-page links glide too and land below the navbar (Lenis reads <html>'s
// scroll-padding-top); with reduced motion it steps aside.
export function SmoothScroll() {
  useEffect(() => {
    const lenis = new Lenis({ autoRaf: true, anchors: true, lerp: 0.1 });
    return () => lenis.destroy();
  }, []);
  return null;
}
