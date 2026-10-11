import type { Assembly } from "../../shared/types/index.ts";
import { seal } from "./bbox.ts";
import {
  buildCabin,
  buildCargo,
  buildComposites,
  buildControls,
  buildEmpennage,
  buildEngines,
  buildFuel,
  buildFuselage,
  buildGear,
  buildStructure,
  buildSystems,
  buildWings,
  publishedGear,
} from "./loft.ts";

export function build900(): Assembly {
  const pub = publishedGear("a350-900");
  return seal("a350-900", [
    ...buildFuselage("a350-900", pub.length),
    ...buildWings("a350-900"),
    ...buildEmpennage("a350-900"),
    ...buildGear("a350-900", pub.track, pub.wheelbase, pub.contactZ),
    ...buildEngines("a350-900"),
    ...buildCabin("a350-900", pub.length),
    ...buildCargo("a350-900", pub.length),
    ...buildStructure("a350-900", pub.length),
    ...buildComposites("a350-900", pub.length),
    ...buildSystems("a350-900", pub.length),
    ...buildFuel("a350-900"),
    ...buildControls("a350-900"),
  ]);
}
