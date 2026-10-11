export { NACELLE, SCHEMATIC, WING_BOX } from "./constants.ts";
export { buildVariant } from "./build.ts";
export {
  constantSectionWidth,
  estimateDrawCalls,
  estimateTriangles,
  measure,
  tipX,
  worldBBox,
} from "./bbox.ts";
export { analyticWingAreaM2, chordAtY, teExtensionAreaM2 } from "./loft.ts";
