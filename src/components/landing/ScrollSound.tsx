"use client";

import { useEffect } from "react";
import { mountScrollBrush } from "./sounds";

// The sound of a finger brushed across paper while the page scrolls (sounds.ts).
export function ScrollSound() {
  useEffect(() => mountScrollBrush(), []);
  return null;
}
