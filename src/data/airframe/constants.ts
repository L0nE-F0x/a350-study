export const SCHEMATIC = {
  fuselageHeightM: 6.09,
  fuselageCenterZ: 1.6,
  noseConeM: 8,
  tailConeM: 10,
  plugFractionForward: 0.5,
  superellipseN: 2.4,
  bodyStationSpacingM: 1.5,
  radialSegments: 64,
  visualFrameSpacingM: 2,
  stringerCount: 12,
  wingRootChordM: 10.5,
  wingTipChordM: 3.15,
  wingQuarterChordSweepDeg: 31.9,
  teExtensionRootM: 0.69,
  mainGearXM: 2.0,
  gearContactZ900: -5,
  axlePitchM: 1.5,
  wheelRadiusM: 0.6,
  wheelLateralGapM: 1.2,
  engineYM: 12,
  // Intake leads the swept leading edge at y = ±engineYM. The pylon then meets the wing.
  engineXM: 7,
  engineZM: -1.16,
  finTipZ: 12.05,
} as const;

export const NACELLE = { lengthM: 5.5, radiusM: 1.6 } as const;

export const WING_BOX = {
  minX: -2.5,
  maxX: 3.5,
  minY: -2.9,
  maxY: 2.9,
  minZ: -0.4,
  maxZ: 0.5,
} as const;
