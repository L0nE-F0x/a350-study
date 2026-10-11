/** Exact factor required by the quantity formatter. Not a display rounding. */
export const FEET_PER_METRE = 3.280839895;

export function metresToFeet(metres: number): number {
  return metres * FEET_PER_METRE;
}
