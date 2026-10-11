import { FEET_PER_METRE } from "../../shared/units/index.ts";
import { getCitation } from "./citations.ts";
import { QUANTITIES, quantityById } from "./quantities.ts";
import type { BadgeName, Quantity } from "./types.ts";

export type ReadoutBadge = BadgeName | "conflict";

function norm(value: string): string {
  return value.replace(/[\s,]/g, "");
}

function phrase(q: Quantity): string | undefined {
  return q.displaySI ?? q.displayText;
}

export function quantityBadges(q: Quantity): ReadoutBadge[] {
  const badges: ReadoutBadge[] = [];
  if ((q.grade === "sourced" || q.grade === "derived") && q.confidence === "needs-reconfirm") {
    badges.push("unverified");
  } else if (q.grade === "schematic") {
    badges.push("schematic");
  } else if (q.grade === "derived") {
    badges.push("derived");
  } else if (q.authority === "secondary") {
    badges.push("secondary");
  } else {
    badges.push("sourced");
  }
  if (q.confidence === "conflict") badges.push("conflict");
  return badges;
}

export function derivedSI(q: Quantity): number {
  if (!q.formula) throw new Error(`${q.id} has no formula`);
  const inputs = [...(q.inputs ?? [])].sort((a, b) => b.length - a.length);
  let expr = q.formula;
  for (const id of inputs) {
    const value = quantityById(id).si?.value;
    if (value === undefined) throw new Error(`${q.id} input ${id} has no si value`);
    expr = expr.split(id).join(`(${value})`);
  }
  return evalExpr(expr);
}

function evalExpr(input: string): number {
  const s = input.replace(/\s+/g, "");
  if (!/^[0-9eE.+\-*/()]+$/.test(s)) throw new Error(`Formula has an unsupported token: ${input}`);
  let i = 0;
  const parse = (): number => parseAdd();
  const peek = () => s[i] ?? "";
  const parseAdd = (): number => {
    let v = parseMul();
    while (peek() === "+" || peek() === "-") {
      const op = s[i++];
      const r = parseMul();
      v = op === "+" ? v + r : v - r;
    }
    return v;
  };
  const parseMul = (): number => {
    let v = parseUnary();
    while (peek() === "*" || peek() === "/") {
      const op = s[i++];
      const r = parseUnary();
      v = op === "*" ? v * r : v / r;
    }
    return v;
  };
  const parseUnary = (): number => {
    if (peek() === "+") {
      i += 1;
      return parseUnary();
    }
    if (peek() === "-") {
      i += 1;
      return -parseUnary();
    }
    return parsePrimary();
  };
  const parsePrimary = (): number => {
    if (peek() === "(") {
      i += 1;
      const v = parseAdd();
      if (peek() !== ")") throw new Error(`Unclosed parenthesis in ${input}`);
      i += 1;
      return v;
    }
    const start = i;
    if (peek() === ".") i += 1;
    while (/[0-9.]/.test(peek())) i += 1;
    if (peek() === "e" || peek() === "E") {
      i += 1;
      if (peek() === "+" || peek() === "-") i += 1;
      while (/[0-9]/.test(peek())) i += 1;
    }
    if (start === i) throw new Error(`Expected a number in ${input}`);
    const raw = s.slice(start, i);
    const n = Number(raw);
    if (!Number.isFinite(n)) throw new Error(`Bad number ${raw}`);
    return n;
  };
  const value = parse();
  if (i !== s.length) throw new Error(`Trailing input in ${input}`);
  return value;
}

function groupInt(n: number): string {
  const sign = n < 0 ? "-" : "";
  const digits = Math.abs(Math.trunc(n)).toString();
  const parts: string[] = [];
  for (let end = digits.length; end > 0; end -= 3) {
    parts.unshift(digits.slice(Math.max(0, end - 3), end));
  }
  return sign + parts.join(" ");
}

function trimMetres(v: number): string {
  const neg = v < 0;
  const cents = Math.round(Math.abs(v) * 100);
  const whole = Math.trunc(cents / 100);
  const frac = cents % 100;
  const body = groupInt(whole);
  const sign = neg ? "-" : "";
  if (frac === 0) return `${sign}${body}`;
  if (frac % 10 === 0) return `${sign}${body}.${frac / 10}`;
  const fracStr = frac < 10 ? `0${frac}` : String(frac);
  return `${sign}${body}.${fracStr}`;
}

function derivedUnit(id: string): "kg" | "L" | "m" {
  if (id.endsWith(".kg")) return "kg";
  if (id.includes("fuel")) return "L";
  return "m";
}

function formatDerived(q: Quantity, unit: "m" | "ft"): string {
  const value = derivedSI(q);
  const kind = derivedUnit(q.id);
  if (kind === "kg") {
    const cents = Math.round(value * 10);
    const whole = Math.trunc(cents / 10);
    const tenth = Math.abs(cents % 10);
    return tenth === 0 ? `${groupInt(whole)} kg` : `${groupInt(whole)}.${tenth} kg`;
  }
  if (kind === "L") return `${groupInt(Math.round(value))} L`;
  if (unit === "ft") return `converted ${trimMetres(value * FEET_PER_METRE)} ft`;
  return `${trimMetres(value)} m`;
}

export function formatQuantity(q: Quantity, unit: "m" | "ft"): string {
  if (typeof q !== "object" || q === null || typeof (q as Quantity).grade !== "string") {
    throw new Error("formatQuantity rejects a raw number");
  }
  if (q.confidence === "needs-reconfirm" && (q.grade === "sourced" || q.grade === "derived")) {
    return `Unverified until the product page is re-checked: ${q.displaySI ?? ""}`;
  }
  if (q.grade === "derived") return formatDerived(q, unit);
  if (q.grade === "schematic") {
    if (q.displayText) return q.displayText;
    if (q.si && q.si.unit === "m") {
      const tenths = Math.round(q.si.value * 10) / 10;
      return `~${trimMetres(tenths)} m`;
    }
    return q.displaySI ?? "";
  }
  if (unit === "ft" && q.displayImperial) return q.displayImperial;
  if (unit === "ft" && q.si?.unit === "m" && !q.displayImperial) {
    return `converted ${trimMetres(q.si.value * FEET_PER_METRE)} ft`;
  }
  return q.displaySI ?? q.displayText ?? "";
}

function citationHas(ids: string[], text: string): boolean {
  const needle = norm(text);
  if (!needle) return false;
  return ids.some((id) => norm(getCitation(id).quote).includes(needle));
}

const FUEL_ROWS = [
  ["q.fuel.900.basic.wingOne", "q.fuel.900.basic.wingOneKg", "q.fuel.900.basic.centre", "q.fuel.900.basic.centreKg", "q.fuel.900.basic.totalL", "q.fuel.900.basic.totalKg"],
  ["q.fuel.900.hgw.wingOne", "q.fuel.900.hgw.wingOneKg", "q.fuel.900.hgw.centre", "q.fuel.900.hgw.centreKg", "q.fuel.900.hgw.totalL", "q.fuel.900.hgw.totalKg"],
  ["q.fuel.1000.basic.wingOne", "q.fuel.1000.basic.wingOneKg", "q.fuel.1000.basic.centre", "q.fuel.1000.basic.centreKg", "q.fuel.1000.basic.totalL", "q.fuel.1000.basic.totalKg"],
] as const;

function si(id: string): number {
  const value = quantityById(id).si?.value;
  if (value === undefined) throw new Error(`${id} missing si`);
  return value;
}

export function assertDataPack(): void {
  const ids = new Set<string>();
  for (const q of QUANTITIES) {
    if (ids.has(q.id)) throw new Error(`Duplicate quantity ${q.id}`);
    ids.add(q.id);
    if (q.grade === "schematic" && q.authority === "primary") {
      throw new Error(`${q.id} is schematic with a primary authority`);
    }
    if (q.grade === "sourced" && !q.authority) throw new Error(`${q.id} is sourced without an authority`);
    if (q.grade === "derived") {
      if (!q.formula || !q.inputs?.length) throw new Error(`${q.id} is derived without formula and inputs`);
      derivedSI(q);
    }
    if (q.grade === "sourced" && q.confidence !== "needs-reconfirm") {
      const text = phrase(q);
      if (!text) throw new Error(`${q.id} has no display`);
      if (!q.citationIds.length) throw new Error(`${q.id} has no citation`);
      if (!citationHas(q.citationIds, text)) {
        throw new Error(`${q.id} quote does not contain ${text}`);
      }
      if (q.displayImperial && !citationHas(q.citationIds, q.displayImperial)) {
        throw new Error(`${q.id} quote does not contain ${q.displayImperial}`);
      }
      for (const alt of q.alternates ?? []) {
        if (!citationHas([alt.citationId], alt.display)) {
          throw new Error(`${q.id} alternate ${alt.display} is missing from ${alt.citationId}`);
        }
      }
    }
    if (q.gap && q.si) throw new Error(`${q.id} gap record must not invent an si value`);
  }

  const range = quantityById("q.range.900.hgw");
  const rangeText = range.displaySI ?? "";
  if (!rangeText.includes("8,500 NM") || !rangeText.includes("15,750 km")) {
    throw new Error("Canonical -900 high-gross range is the brochure pair");
  }
  if (rangeText.includes("15,742") || rangeText.includes(String(8500 * 1.852))) {
    throw new Error("Canonical kilometres must not be 8500 * 1.852");
  }
  const alt8600 = range.alternates?.some((a) => a.display.includes("8,600 NM"));
  if (!alt8600) throw new Error("Missing 8,600 NM alternate");

  const hgwRange = quantityById("q.range.1000.hgw").displaySI ?? "";
  if (!hgwRange.includes("EIS 2030") || !hgwRange.includes("9,000 NM*")) {
    throw new Error("High-gross -1000 range must keep the asterisk and EIS 2030");
  }
  if (quantityById("q.mtow.1000.hgw").si?.value !== 322000) {
    throw new Error("Canonical -1000 MTOW stays 322 000 kg");
  }
  if (derivedSI(quantityById("q.derived.fuel.900.hgw.wings")) !== 59452) {
    throw new Error("Both-wings high-gross -900 fuel must be 59452 L");
  }

  for (const [wingL, wingKg, centreL, centreKg, totalL, totalKg] of FUEL_ROWS) {
    const wl = si(wingL);
    const wk = si(wingKg);
    const cl = si(centreL);
    const ck = si(centreKg);
    const tl = si(totalL);
    const tk = si(totalKg);
    if (2 * wl + cl !== tl) throw new Error(`${totalL} litre balance`);
    if (Math.abs(2 * wk + ck - tk) > 2) throw new Error(`${totalKg} kilogram balance`);
    for (const [litres, kg] of [
      [wl, wk],
      [cl, ck],
      [tl, tk],
    ] as const) {
      if (Math.abs(litres * 0.785 - kg) > 2) throw new Error(`Density check failed for ${litres} L`);
    }
  }

  for (const id of ["q.cabinLen.900", "q.track.900", "q.wheelbase.900"]) {
    const q = quantityById(id);
    if (q.confidence !== "high") throw new Error(`${id} must be high once the key-figures quote is stored`);
    if (quantityBadges(q).includes("unverified")) throw new Error(`${id} badge must be sourced`);
  }
}
