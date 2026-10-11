import type { AlternateClaim, Quantity } from "./types.ts";

const FACTS = "cite.airbus.facts-2026-06";
const P900 = "cite.airbus.product.a350-900";
const P1000 = "cite.airbus.product.a350-1000";
const EASA = "cite.easa.tcds.a151";
const E111 = "cite.easa.e111";
const PRESS = "cite.airbus.press.xwb84ep.2025-04-11";
const FG = "cite.flightglobal.flighttest.2018-07-06";
const WIKI = "cite.wikipedia.a350";
const WIKI_GEAR = "cite.wikipedia.undercarriage";
const TYPE_C = "cite.airbus.brochure.a350-1000-airport.2014";

export const LEN900 = 66.8;
export const LEN1000 = 73.78;
export const SPAN = 64.75;
export const STRETCH = LEN1000 - LEN900;
export const PLUG = STRETCH * 0.5;

const list: Quantity[] = [];

function add(q: Quantity): void {
  list.push(q);
}

function sourced(
  id: string,
  displaySI: string,
  si: { value: number; unit: string } | undefined,
  citationIds: string[],
  extra?: Partial<Quantity>,
): void {
  add({
    id,
    grade: "sourced",
    authority: "primary",
    confidence: "high",
    citationIds,
    displaySI,
    si,
    ...extra,
  });
}

sourced("q.len.900", "66.80 m", { value: LEN900, unit: "m" }, [FACTS], { displayImperial: "219 ft 2 in" });
sourced("q.len.1000", "73.78 m", { value: LEN1000, unit: "m" }, [FACTS], { displayImperial: "242 ft 1 in" });
sourced("q.span", "64.75 m", { value: SPAN, unit: "m" }, [FACTS], { displayImperial: "212 ft 5 in" });
sourced("q.height.900", "17.05 m", { value: 17.05, unit: "m" }, [FACTS], { displayImperial: "55 ft 11 in" });
sourced("q.height.1000", "17.08 m", { value: 17.08, unit: "m" }, [FACTS], { displayImperial: "56 ft 0 in" });

const widthAlt: AlternateClaim[] = [
  { display: "5.94 m", citationId: P1000, note: "Product page fuselage width. The loft uses 5.96 m." },
  { display: "234 in", citationId: P1000, note: "Product page imperial fuselage width." },
];
sourced("q.fuseWidth", "5.96 m", { value: 5.96, unit: "m" }, [FACTS, P1000], {
  displayImperial: "19 ft 7 in",
  confidence: "conflict",
  alternates: widthAlt,
});

sourced("q.cabinWidthMax", "5.71 m", { value: 5.71, unit: "m" }, [P1000, FACTS], {
  displayImperial: "225 in",
});
sourced("q.cabinLen.900", "51.04 m", { value: 51.04, unit: "m" }, [P900]);
sourced("q.cabinLen.1000", "58.03 m", { value: 58.03, unit: "m" }, [P1000]);
sourced("q.track.900", "10.60 m", { value: 10.6, unit: "m" }, [P900]);
sourced("q.track.1000", "10.73 m", { value: 10.73, unit: "m" }, [P1000]);
sourced("q.wheelbase.900", "28.67 m", { value: 28.67, unit: "m" }, [P900]);
sourced("q.wheelbase.1000", "32.48 m", { value: 32.48, unit: "m" }, [P1000]);

sourced("q.seats.typical.900", "332 / 352", undefined, [FACTS]);
sourced("q.seats.typical.1000", "375 / 400", undefined, [FACTS]);
sourced("q.seats.max.900", "440", { value: 440, unit: "seat" }, [FACTS]);
sourced("q.seats.max.1000", "480", { value: 480, unit: "seat" }, [FACTS]);
sourced("q.cargo.ld3.900", "11 pallets or 36 LD3", undefined, [FACTS]);
sourced("q.cargo.ld3.1000", "14 pallets or 44 LD3", undefined, [FACTS]);
sourced("q.cargo.m3.900", "172 m³", { value: 172, unit: "m3" }, [FACTS]);
sourced("q.cargo.m3.1000", "208 m³", { value: 208, unit: "m3" }, [FACTS]);
sourced("q.cruiseMach", "Mach 0.85", { value: 0.85, unit: "Mach" }, [FACTS]);
sourced("q.commonality", "95% common part numbers", undefined, [FACTS]);
sourced("q.materials.composite", "53% composites", { value: 53, unit: "%" }, [FACTS]);
sourced("q.materials.advanced", "Over 70% advanced materials", undefined, [FACTS]);
sourced("q.materials.titanium", "14% titanium", { value: 14, unit: "%" }, [P1000], { confidence: "low" });
sourced("q.cabin.altitude", "6,000 ft cabin altitude", undefined, [FACTS]);
sourced("q.cabin.ceiling", "95 in / 2.4 m ceiling", undefined, [FACTS]);
sourced("q.stretch.prose", "7 m longer", undefined, [P1000]);
sourced("q.ulr.range", "9,700 NM / 18,000 km", undefined, [FACTS]);

interface MassCol {
  taxi: [string, number];
  mtow: [string, number];
  mlw: [string, number];
  mzfw: [string, number];
  fuel: [string, number];
  range: string;
}

const masses: Record<string, MassCol> = {
  "900.regional": {
    taxi: ["250 900 kg", 250900],
    mtow: ["250 000 kg", 250000],
    mlw: ["205 000 kg", 205000],
    mzfw: ["192 000 kg", 192000],
    fuel: ["140 795 L", 140795],
    range: "6,000 NM / 11,100 km",
  },
  "900.basic": {
    taxi: ["268 900 kg", 268900],
    mtow: ["268 000 kg", 268000],
    mlw: ["205 000 kg", 205000],
    mzfw: ["192 000 kg", 192000],
    fuel: ["140 795 L", 140795],
    range: "7,500 NM / 13,900 km",
  },
  "900.hgw": {
    taxi: ["283 900 kg", 283900],
    mtow: ["283 000 kg", 283000],
    mlw: ["207 000 kg", 207000],
    mzfw: ["195 700 kg", 195700],
    fuel: ["166 488 L", 166488],
    range: "8,500 NM / 15,750 km",
  },
  "1000.basic": {
    taxi: ["308 900 kg", 308900],
    mtow: ["308 000 kg", 308000],
    mlw: ["233 000 kg", 233000],
    mzfw: ["220 000 kg", 220000],
    fuel: ["158 791 L", 158791],
    range: "8,100 NM / 15,000 km",
  },
  "1000.hgw": {
    taxi: ["322 900 kg", 322900],
    mtow: ["322 000 kg", 322000],
    mlw: ["236 000 kg", 236000],
    mzfw: ["223 000 kg", 223000],
    fuel: ["168 300 L", 168300],
    range: "9,000 NM* / 16,700 km (EIS 2030)",
  },
};

for (const [key, col] of Object.entries(masses)) {
  const fuelCites = key === "1000.hgw" ? [FACTS] : [FACTS, EASA];
  sourced(`q.mtaxi.${key}`, col.taxi[0], { value: col.taxi[1], unit: "kg" }, [FACTS, EASA]);
  sourced(`q.mtow.${key}`, col.mtow[0], { value: col.mtow[1], unit: "kg" }, [FACTS, EASA]);
  sourced(`q.mlw.${key}`, col.mlw[0], { value: col.mlw[1], unit: "kg" }, [FACTS, EASA]);
  sourced(`q.mzfw.${key}`, col.mzfw[0], { value: col.mzfw[1], unit: "kg" }, [FACTS, EASA]);
  sourced(`q.fuelLitres.${key}`, col.fuel[0], { value: col.fuel[1], unit: "L" }, fuelCites);
  sourced(`q.range.${key}`, col.range, undefined, [FACTS]);
}

const mtow1000 = list.find((q) => q.id === "q.mtow.1000.hgw");
if (mtow1000) {
  mtow1000.confidence = "conflict";
  mtow1000.alternates = [
    {
      display: "324.00 t",
      citationId: P1000,
      note: "Product page MTOW. Canonical remains the brochure and TCDS 322 000 kg.",
    },
  ];
}
const taxi1000 = list.find((q) => q.id === "q.mtaxi.1000.hgw");
if (taxi1000) {
  taxi1000.confidence = "conflict";
  taxi1000.alternates = [
    { display: "324.90 t", citationId: P1000, note: "Product page max taxi weight." },
  ];
}
const range900 = list.find((q) => q.id === "q.range.900.hgw");
if (range900) {
  range900.confidence = "conflict";
  range900.citationIds = [FACTS, P900];
  range900.alternates = [
    {
      display: "8,600 NM",
      citationId: P900,
      note: "Product-page key figures print 8,600 NM with the same 15,750 km. The pair is not one length. Canonical NM stays 8,500.",
    },
  ];
}
const range1000 = list.find((q) => q.id === "q.range.1000.hgw");
if (range1000) {
  range1000.confidence = "conflict";
  range1000.citationIds = [FACTS, P1000];
  range1000.alternates = [
    { display: "9,100 NM", citationId: P1000, note: "Product-page key-figures range. Brochure canonical stays 9,000 NM*." },
    { display: "16,850 km", citationId: P1000, note: "Product-page key-figures kilometres paired with 9,100 NM." },
  ];
}
const fuelBasic1000 = list.find((q) => q.id === "q.fuelLitres.1000.basic");
if (fuelBasic1000) {
  fuelBasic1000.confidence = "conflict";
  fuelBasic1000.alternates = [
    { display: "158 790 L", citationId: FACTS, note: "Airbus brochure rounds the EASA total of 158 791 L." },
  ];
}

sourced("q.mtow.900.xwb75", "255 t", { value: 255000, unit: "kg" }, [EASA]);

sourced("q.engine.900", "Trent XWB-84", undefined, [EASA]);
sourced("q.engine.1000", "Trent XWB-97", undefined, [EASA]);
sourced("q.thrust.900", "374.5 kN (84,200 lbf)", { value: 374.5, unit: "kN" }, [E111, FACTS], {
  confidence: "conflict",
  alternates: [
    { display: "84,000 lbf", citationId: FACTS, note: "Airbus brochure take-off thrust. Canonical is the EASA net figure." },
  ],
});
sourced("q.thrust.1000", "431.5 kN (97,000 lbf)", { value: 431.5, unit: "kN" }, [E111, FACTS]);
sourced("q.thrust.cont.900", "317.6 kN (71,400 lbf)", { value: 317.6, unit: "kN" }, [E111]);
sourced("q.thrust.cont.1000", "369.6 kN (83,100 lbf)", { value: 369.6, unit: "kN" }, [E111]);
sourced("q.note.xwb84ep", "About 1% lower fuel burn, same airframe in this tool.", undefined, [PRESS]);

add({
  id: "q.model.900",
  grade: "sourced",
  authority: "primary",
  confidence: "high",
  citationIds: [EASA],
  displaySI: "A350-941",
});
add({
  id: "q.cert.900",
  grade: "sourced",
  authority: "primary",
  confidence: "high",
  citationIds: [EASA],
  displaySI: "30 September 2014",
});
add({
  id: "q.model.1000",
  grade: "sourced",
  authority: "primary",
  confidence: "high",
  citationIds: [EASA],
  displaySI: "A350-1041",
});
add({
  id: "q.cert.1000",
  grade: "sourced",
  authority: "primary",
  confidence: "high",
  citationIds: [EASA],
  displaySI: "21 November 2017",
});

add({
  id: "q.gear.900",
  grade: "sourced",
  authority: "secondary",
  confidence: "high",
  citationIds: [WIKI_GEAR, FG],
  displaySI: "[1×2]+[2×4]",
  displayText: "10 wheels",
});
add({
  id: "q.gear.1000",
  grade: "sourced",
  authority: "secondary",
  confidence: "high",
  citationIds: [WIKI_GEAR, FG],
  displaySI: "[1×2]+[2×6]",
  displayText: "14 wheels",
});

add({
  id: "q.wingArea.900",
  grade: "sourced",
  authority: "secondary",
  confidence: "high",
  citationIds: [WIKI],
  displaySI: "442 m²",
  si: { value: 442, unit: "m2" },
});
add({
  id: "q.wingArea.1000",
  grade: "sourced",
  authority: "secondary",
  confidence: "high",
  citationIds: [WIKI],
  displaySI: "464.3 m²",
  si: { value: 464.3, unit: "m2" },
});

interface Tank {
  id: string;
  litres: number;
  litresDisplay: string;
  kg?: number;
  kgDisplay?: string;
}

const tanks: Tank[] = [
  { id: "q.fuel.900.basic.wingOne", litres: 29924, litresDisplay: "29 924 L", kg: 23490, kgDisplay: "23 490 kg" },
  { id: "q.fuel.900.basic.centre", litres: 80947, litresDisplay: "80 947 L", kg: 63543, kgDisplay: "63 543 kg" },
  { id: "q.fuel.900.basic.totalL", litres: 140795, litresDisplay: "140 795 L", kg: 110523, kgDisplay: "110 523 kg" },
  { id: "q.fuel.900.hgw.wingOne", litres: 29726, litresDisplay: "29 726 L", kg: 23335, kgDisplay: "23 335 kg" },
  { id: "q.fuel.900.hgw.centre", litres: 107036, litresDisplay: "107 036 L", kg: 84023, kgDisplay: "84 023 kg" },
  { id: "q.fuel.900.hgw.totalL", litres: 166488, litresDisplay: "166 488 L", kg: 130693, kgDisplay: "130 693 kg" },
  { id: "q.fuel.1000.basic.wingOne", litres: 29437, litresDisplay: "29 437 L", kg: 23108, kgDisplay: "23 108 kg" },
  { id: "q.fuel.1000.basic.centre", litres: 99917, litresDisplay: "99 917 L", kg: 78435, kgDisplay: "78 435 kg" },
  { id: "q.fuel.1000.basic.totalL", litres: 158791, litresDisplay: "158 791 L", kg: 124651, kgDisplay: "124 651 kg" },
];

for (const tank of tanks) {
  sourced(tank.id, tank.litresDisplay, { value: tank.litres, unit: "L" }, [EASA, FACTS]);
  if (tank.kg !== undefined && tank.kgDisplay) {
    const kgId = tank.id.endsWith("totalL") ? tank.id.replace(/totalL$/, "totalKg") : `${tank.id}Kg`;
    sourced(kgId, tank.kgDisplay, { value: tank.kg, unit: "kg" }, [EASA]);
  }
}

const fuel1000 = list.find((q) => q.id === "q.fuel.1000.basic.totalL");
if (fuel1000) {
  fuel1000.confidence = "conflict";
  fuel1000.alternates = [
    { display: "158 790 L", citationId: FACTS, note: "Brochure litre rounds the EASA table by 1 L." },
  ];
}

sourced("q.fuel.1000.hgw.totalL", "168 300 L", { value: 168300, unit: "L" }, [FACTS]);

function derived(id: string, formula: string, inputs: string[], displaySI: string): void {
  add({
    id,
    grade: "derived",
    confidence: "high",
    citationIds: [],
    formula,
    inputs,
    displaySI,
  });
}

derived("q.derived.stretch", "q.len.1000 - q.len.900", ["q.len.1000", "q.len.900"], "6.98 m");
derived("q.derived.semiSpan", "q.span / 2", ["q.span"], "32.38 m");
derived("q.derived.halfLen.900", "q.len.900 / 2", ["q.len.900"], "33.40 m");
derived("q.derived.halfLen.1000", "q.len.1000 / 2", ["q.len.1000"], "36.89 m");
derived(
  "q.derived.wheelbaseDelta",
  "q.wheelbase.1000 - q.wheelbase.900",
  ["q.wheelbase.1000", "q.wheelbase.900"],
  "3.81 m",
);
derived("q.derived.trackDelta", "q.track.1000 - q.track.900", ["q.track.1000", "q.track.900"], "0.13 m");
derived("q.derived.heightDelta", "q.height.1000 - q.height.900", ["q.height.1000", "q.height.900"], "0.03 m");
derived(
  "q.derived.cabinDelta",
  "q.cabinLen.1000 - q.cabinLen.900",
  ["q.cabinLen.1000", "q.cabinLen.900"],
  "6.99 m",
);
derived(
  "q.derived.fuel.900.hgw.wings",
  "2 * q.fuel.900.hgw.wingOne",
  ["q.fuel.900.hgw.wingOne"],
  "59 452 L",
);
derived(
  "q.derived.fuel.1000.hgw.kg",
  "q.fuel.1000.hgw.totalL * 0.785",
  ["q.fuel.1000.hgw.totalL"],
  "132 115.5 kg",
);

add({
  id: "q.schematic.plug",
  grade: "schematic",
  confidence: "high",
  citationIds: [],
  si: { value: PLUG, unit: "m" },
  displayText: "Schematic plug",
});
add({
  id: "q.schematic.visualFrame",
  grade: "schematic",
  confidence: "high",
  citationIds: [],
  displayText: "Visual frame",
});
add({
  id: "q.schematic.tank",
  grade: "schematic",
  confidence: "high",
  citationIds: [],
  displayText: "Schematic tank",
});
add({
  id: "q.schematic.fuelSplit",
  grade: "schematic",
  confidence: "high",
  citationIds: [],
  displayText: "Pictured tank split is schematic. The high-gross -1000 litre total has no sourced wing and centre split.",
});
add({
  id: "q.schematic.nacelle",
  grade: "schematic",
  confidence: "high",
  citationIds: [],
  displayText: "Schematic nacelle",
});
add({
  id: "q.schematic.hydraulic",
  grade: "schematic",
  confidence: "high",
  citationIds: [],
  displayText: "Schematic hydraulic run",
});
add({
  id: "q.schematic.electric",
  grade: "schematic",
  confidence: "high",
  citationIds: [],
  displayText: "Schematic electrical run",
});
add({
  id: "q.schematic.bleed",
  grade: "schematic",
  confidence: "high",
  citationIds: [],
  displayText: "Schematic bleed run",
});
add({
  id: "q.schematic.teExtension",
  grade: "schematic",
  confidence: "high",
  citationIds: [],
  displayText: "Schematic trailing edge",
});
add({
  id: "q.schematic.control",
  grade: "schematic",
  confidence: "high",
  citationIds: [],
  displayText: "Schematic control surface",
});

const DOOR3 =
  "FlightGlobal (6 July 2018) reported Door 3 moved aft by one frame on the A350-1000 because the main-gear bay grew. Frame pitch is not in the sources used here, so this model does not apply that shift.";
const TYPEC =
  "A June 2014 preliminary Airbus airport brochure described an optional Type C exit between Door 3 and Door 4 for high-density A350-1000 layouts. It is not in the June 2026 Facts & Figures. It is not drawn.";

add({
  id: "q.note.door3",
  grade: "sourced",
  authority: "secondary",
  confidence: "high",
  citationIds: [FG],
  displaySI: DOOR3,
});
add({
  id: "q.note.typeC",
  grade: "sourced",
  authority: "secondary",
  confidence: "high",
  citationIds: [TYPE_C],
  displaySI: TYPEC,
});

function gap(id: string, displayText: string): void {
  add({
    id,
    grade: "schematic",
    confidence: "low",
    citationIds: [],
    displayText,
    gap: true,
  });
}

gap(
  "q.gap.frameStations",
  "OEM frame stations, frame pitch, and station zero are not in the sources used here. The picture uses a visual frame grid.",
);
gap("q.gap.plugSplit", "How the stretch is split between a forward plug and an aft plug is schematic. The 50/50 cut is a modelling choice.");
gap("q.gap.elevenFrame", "The secondary “11-frame stretch” is not used as a length.");
gap(
  "q.gap.doorCuts",
  "Door cut sizes, sill heights, and longitudinal stations are not drawn from a certified source. Four door pairs are schematic monuments.",
);
gap("q.gap.typeC", "The optional Type C exit is an annotation only. It is not a cut in the mesh.");
gap(
  "q.gap.door3",
  "The one-frame Door 3 move is not applied. A secondary trailing-edge remark is not the mesh chord.",
);
gap(
  "q.gap.fuseHeight",
  "External fuselage height is not in the June 2026 table. The superellipse height is a schematic constant.",
);
gap(
  "q.gap.structureCounts",
  "Stringer count, frame count, spar count, rib pitch, and ply books are not sourced. Laminate boundaries are not drawn.",
);
gap(
  "q.gap.hydraulics",
  "Hydraulic routes are schematic centrelines. System names are not stated, and a system count is not stated.",
);
gap("q.gap.electrics", "Electrical bus layout, cable routes, and LRU lists are not in this model.");
gap("q.gap.bleed", "Bleed-duct and ECS-pack routing, and pack count, are not sourced. The overlay is a schematic centreline.");
gap(
  "q.gap.fuelSplit",
  "Fuel-tank ribs, unusable fuel, and the high-gross -1000 tank split are not allocated.",
);
gap("q.gap.sweep", "Wing sweep is a schematic quarter-chord angle. It is not an OEM callout in the default readout.");
gap("q.gap.wingArea", "Wing area is a secondary target, not a primary figure, and it is not measured from the exposed mesh.");
gap("q.gap.tyre", "Tyre size, oleo length, bogie-beam length, and axle spacing are schematic. Those lengths are not displayed.");
gap("q.gap.nacelle", "Fan diameter, nacelle length, and inlet station are schematic. Both variants share one nacelle shape.");
gap("q.gap.lopa", "Cabin LOPA, galleys, lavatories, and individual seats are not modelled. Zones only.");
gap("q.gap.cargoDoor", "Cargo-door size and sill height are not in this model.");
gap(
  "q.gap.manuals",
  "The Aircraft Characteristics manual, the AMM, and the IPC are not inputs and are not stored in this tool.",
);

export const QUANTITIES: readonly Quantity[] = list;

const byId = new Map<string, Quantity>(list.map((q) => [q.id, q]));

export function quantityById(id: string): Quantity {
  const q = byId.get(id);
  if (!q) throw new Error(`Unknown quantity ${id}`);
  return q;
}

export function gapQuantities(): Quantity[] {
  return list.filter((q) => q.gap === true);
}
