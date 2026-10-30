"use client";

import { useEffect } from "react";

// Marks every [data-reveal] element data-shown the first time it comes on
// screen; globals.css does the moving. One observer for the page, so the
// sections themselves can stay server components.
export function Reveals() {
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          e.target.setAttribute("data-shown", "");
          io.unobserve(e.target);
        }
      },
      // a little way up from the bottom edge, but not so far that the
      // footer's last row could never cross it
      { rootMargin: "0px 0px -40px 0px" },
    );
    document.querySelectorAll("[data-reveal]").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
  return null;
}
