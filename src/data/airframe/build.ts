import type { Assembly } from "../../shared/types/index.ts";
import { build900 } from "./base900.ts";
import { applyDelta } from "./delta1000.ts";

export function buildVariant(id: "a350-900" | "a350-1000"): Assembly {
  const base = build900();
  if (id === "a350-900") return base;
  return applyDelta(base);
}
