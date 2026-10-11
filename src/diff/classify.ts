import type { Part } from "../shared/types/index.ts";

export function partsByDiff(parts: Part[]): { common: Part[]; shifted: Part[]; added: Part[] } {
  const common: Part[] = [];
  const shifted: Part[] = [];
  const added: Part[] = [];
  for (const part of parts) {
    if (part.diffTag === "added") added.push(part);
    else if (part.diffTag === "shifted") shifted.push(part);
    else common.push(part);
  }
  return { common, shifted, added };
}
