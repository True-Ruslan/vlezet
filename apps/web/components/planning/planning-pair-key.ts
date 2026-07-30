export function planningPairKey(firstObjectId: string, secondObjectId: string): string {
  return firstObjectId.localeCompare(secondObjectId) <= 0
    ? `${firstObjectId}|${secondObjectId}`
    : `${secondObjectId}|${firstObjectId}`;
}

export function planningPairIds(key: string): readonly [string, string] | null {
  const parts = key.split("|");
  return parts.length === 2 && parts[0] && parts[1]
    ? [parts[0], parts[1]]
    : null;
}
