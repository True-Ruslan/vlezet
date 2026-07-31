export type CanvasEntityKind = "room" | "wall" | "opening" | "object";

export type CanvasEntityIdentity = Readonly<{
  kind: CanvasEntityKind;
  id: string;
}>;

const PREFIX = "canvas-entity:";
const KINDS: ReadonlySet<string> = new Set<CanvasEntityKind>(["room", "wall", "opening", "object"]);

export function canvasEntityName(kind: CanvasEntityKind, id: string): string {
  return `${PREFIX}${kind}:${encodeURIComponent(id)}`;
}

export function parseCanvasEntityName(name: string): CanvasEntityIdentity | null {
  if (!name.startsWith(PREFIX)) return null;
  const separator = name.indexOf(":", PREFIX.length);
  if (separator < 0) return null;
  const kind = name.slice(PREFIX.length, separator);
  if (!KINDS.has(kind)) return null;
  const encodedId = name.slice(separator + 1);
  if (!encodedId) return null;
  try {
    return { kind: kind as CanvasEntityKind, id: decodeURIComponent(encodedId) };
  } catch {
    return null;
  }
}
