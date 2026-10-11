import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const srcRoot = path.join(root, "src");
const errors = [];

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) out.push(full);
  }
  return out;
}

function stripComments(src) {
  let out = "";
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    const n = src[i + 1];
    if (c === "/" && n === "/") {
      i += 2;
      while (i < src.length && src[i] !== "\n") i += 1;
      continue;
    }
    if (c === "/" && n === "*") {
      i += 2;
      while (i < src.length && !(src[i] === "*" && src[i + 1] === "/")) i += 1;
      i += 2;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      const q = c;
      out += c;
      i += 1;
      while (i < src.length) {
        if (src[i] === "\\") {
          out += src[i] + (src[i + 1] ?? "");
          i += 2;
          continue;
        }
        out += src[i];
        if (src[i] === q) {
          i += 1;
          break;
        }
        i += 1;
      }
      continue;
    }
    out += c;
    i += 1;
  }
  return out;
}

function importSpecifiers(src) {
  const specs = [];
  const patterns = [
    /\bfrom\s+["']([^"']+)["']/g,
    /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
    /\bimport\s+["']([^"']+)["']/g,
  ];
  for (const re of patterns) {
    for (const match of src.matchAll(re)) specs.push(match[1]);
  }
  return specs;
}

function rel(full) {
  return path.relative(root, full).split(path.sep).join("/");
}

function moduleOf(fileRel) {
  if (fileRel.startsWith("src/test/")) return "test";
  if (fileRel.startsWith("src/shared/")) return "shared";
  if (fileRel.startsWith("src/data/provenance/")) return "provenance";
  if (fileRel.startsWith("src/data/airframe/")) return "airframe";
  if (fileRel.startsWith("src/interaction/explode/")) return "explode";
  if (fileRel.startsWith("src/interaction/overlays/")) return "overlays";
  if (fileRel.startsWith("src/diff/")) return "diff";
  if (fileRel.startsWith("src/scene/")) return "scene";
  if (fileRel.startsWith("src/ui/")) return "ui";
  if (fileRel.startsWith("src/app/") || fileRel === "src/main.tsx") return "app";
  return "other";
}

function resolveLocal(fromRel, spec) {
  const base = path.posix.dirname(fromRel);
  return path.posix.normalize(path.posix.join(base, spec));
}

function isBarrel(resolved) {
  if (/\/index\.tsx?$/.test(resolved)) return true;
  const abs = path.join(root, resolved);
  return (
    fs.existsSync(path.join(abs, "index.ts")) ||
    fs.existsSync(path.join(abs, "index.tsx"))
  );
}

function packageKind(spec) {
  if (spec === "react" || spec.startsWith("react/")) return "react";
  if (spec === "react-dom" || spec.startsWith("react-dom/")) return "react";
  if (spec === "three" || spec.startsWith("three/")) return "three";
  if (spec === "zustand" || spec.startsWith("zustand/")) return "zustand";
  return "package";
}

function checkFile(full) {
  const fileRel = rel(full);
  const raw = fs.readFileSync(full, "utf8");
  if (raw.includes("dangerouslySetInnerHTML")) {
    errors.push(`${fileRel}: dangerouslySetInnerHTML is forbidden`);
  }
  if (fileRel.startsWith("src/ui/") && raw.includes("toFixed(")) {
    errors.push(`${fileRel}: toFixed( is forbidden under src/ui`);
  }
  if (fileRel.startsWith("src/scene/") && raw.includes("buildVariant")) {
    errors.push(`${fileRel}: scene must not call buildVariant`);
  }
  if (raw.includes("geometry.addGroup") || raw.includes(".addGroup(")) {
    errors.push(`${fileRel}: geometry.addGroup is forbidden`);
  }

  const owner = moduleOf(fileRel);
  if (owner === "test") return;

  const specs = importSpecifiers(stripComments(raw));
  for (const spec of specs) {
    if (spec.endsWith(".css")) {
      if (owner === "ui" || owner === "app") continue;
      errors.push(`${fileRel}: css import is not allowed from ${owner} (${spec})`);
      continue;
    }
    if (!spec.startsWith(".")) {
      const kind = packageKind(spec);
      const allowed = {
        shared: [],
        provenance: [],
        airframe: [],
        explode: [],
        overlays: [],
        diff: [],
        scene: ["three"],
        ui: ["react"],
        app: ["react", "zustand"],
        other: [],
      }[owner];
      if (!allowed.includes(kind)) {
        errors.push(`${fileRel}: ${owner} must not import ${spec}`);
      }
      continue;
    }

    const resolved = resolveLocal(fileRel, spec);
    const imported = moduleOf(resolved.endsWith(".ts") || resolved.endsWith(".tsx") ? resolved : `${resolved}.ts`);
    const importedMod = moduleOf(
      fs.existsSync(path.join(root, `${resolved}.ts`))
        ? `${resolved}.ts`
        : fs.existsSync(path.join(root, `${resolved}.tsx`))
          ? `${resolved}.tsx`
          : resolved,
    );
    const targetMod = importedMod === "other" ? imported : importedMod;
    const sameDir = path.posix.dirname(fileRel) === path.posix.dirname(
      resolved.endsWith(".ts") || resolved.endsWith(".tsx") ? resolved : `${resolved}.ts`,
    );
    const barrel = isBarrel(resolved);

    if (owner === "shared") {
      if (targetMod !== "shared") errors.push(`${fileRel}: shared must not import ${spec}`);
      continue;
    }
    if (sameDir && targetMod === owner) continue;

    if (owner === "provenance") {
      if (targetMod !== "shared" || !barrel) {
        errors.push(`${fileRel}: provenance may import only the shared barrels (${spec})`);
      }
      continue;
    }
    if (owner === "airframe") {
      const provenanceBarrel = targetMod === "provenance" && barrel;
      const sharedBarrel = targetMod === "shared" && barrel;
      if (!provenanceBarrel && !sharedBarrel) {
        errors.push(`${fileRel}: airframe may import only shared and provenance barrels (${spec})`);
      }
      continue;
    }
    if (owner === "explode" || owner === "overlays") {
      if (targetMod !== "shared" || !barrel) {
        errors.push(`${fileRel}: ${owner} may import only shared barrels (${spec})`);
      }
      continue;
    }
    if (owner === "diff") {
      const sharedBarrel = targetMod === "shared" && barrel;
      const airframeBarrel = targetMod === "airframe" && barrel;
      if (!sharedBarrel && !airframeBarrel) {
        errors.push(`${fileRel}: diff may import only shared and the airframe barrel (${spec})`);
      }
      if (airframeBarrel && !/buildVariant/.test(raw)) {
        errors.push(`${fileRel}: airframe barrel import must be buildVariant only`);
      }
      continue;
    }
    if (owner === "scene") {
      if (targetMod !== "shared" || !barrel) {
        errors.push(`${fileRel}: scene may import only shared barrels and three (${spec})`);
      }
      continue;
    }
    if (owner === "ui") {
      const sharedBarrel = targetMod === "shared" && barrel;
      const provenanceBarrel = targetMod === "provenance" && barrel;
      const assertInternal = resolved.includes("provenance/assert");
      if (assertInternal || (!sharedBarrel && !provenanceBarrel)) {
        errors.push(`${fileRel}: ui may import shared, react, and the provenance barrel only (${spec})`);
      }
      continue;
    }
    if (owner === "app") {
      if (!barrel) {
        errors.push(`${fileRel}: app may import only barrels (${spec})`);
      }
      continue;
    }
    errors.push(`${fileRel}: unclassified import ${spec}`);
  }
}

if (!fs.existsSync(srcRoot)) {
  console.error("src/ is missing");
  process.exit(1);
}

for (const file of walk(srcRoot)) checkFile(file);

if (errors.length) {
  console.error(`boundary check failed (${errors.length})`);
  for (const error of errors) console.error(`  ${error}`);
  process.exit(1);
}

console.log("boundary check ok");
