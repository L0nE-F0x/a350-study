import { PLUG } from "../provenance/index.ts";
import type { Assembly, Part } from "../../shared/types/index.ts";
import { seal } from "./bbox.ts";
import {
  buildCabin,
  buildCargo,
  buildComposites,
  buildFuel,
  buildGear,
  buildPlugs,
  buildStructure,
  buildSystems,
  buildTeExtensions,
  publishedGear,
} from "./loft.ts";

const DROP = /^(gear\.|cabin\.|cargo\.|structure\.|composites\.|hydraulics\.|electrics\.|bleed\.)/;

function shift(parts: Part[], id: string, dx: number): void {
  const part = parts.find((item) => item.id === id);
  if (!part) throw new Error(`Missing ${id}`);
  part.assembled = {
    position: { x: part.assembled.position.x + dx, y: part.assembled.position.y, z: part.assembled.position.z },
  };
}

export function applyDelta(base: Assembly): Assembly {
  const copy = structuredClone(base);
  const plug = PLUG;
  shift(copy.parts, "fuse.nose", -plug);
  shift(copy.parts, "fuse.body.fwd", -plug);
  shift(copy.parts, "fuse.tail", plug);
  shift(copy.parts, "fuse.body.aft", plug);
  shift(copy.parts, "htail", plug);
  shift(copy.parts, "vtail", plug);
  shift(copy.parts, "flight.rudder", plug);
  shift(copy.parts, "flight.elevator", plug);

  const kept = copy.parts.filter((part) => !DROP.test(part.id) && !part.id.startsWith("fuel."));
  for (const part of kept) {
    part.variantId = "a350-1000";
    if (part.id.startsWith("engine.rating.")) {
      part.quantityIds = ["q.engine.1000", "q.thrust.1000", "q.thrust.cont.1000"];
    } else {
      part.quantityIds = part.quantityIds.map((id) => (id.includes(".900") ? id.replaceAll(".900", ".1000") : id));
    }
  }
  const pub = publishedGear("a350-1000");
  const parts = [
    ...kept,
    ...buildPlugs("a350-1000"),
    ...buildTeExtensions("a350-1000"),
    ...buildGear("a350-1000", pub.track, pub.wheelbase, pub.contactZ),
    ...buildCabin("a350-1000", pub.length),
    ...buildCargo("a350-1000", pub.length),
    ...buildStructure("a350-1000", pub.length),
    ...buildComposites("a350-1000", pub.length),
    ...buildSystems("a350-1000", pub.length),
    ...buildFuel("a350-1000"),
  ];
  return seal("a350-1000", parts);
}
