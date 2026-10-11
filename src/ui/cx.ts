export function cx(names: Array<string | false | null | undefined>): string {
  let out = "";
  for (const name of names) {
    if (!name) continue;
    out = out.length > 0 ? `${out} ${name}` : name;
  }
  return out;
}
