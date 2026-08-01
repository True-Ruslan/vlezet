const STORAGE_PREFIX = "vlezet.ui.first-project-guide.v1.";
const DISMISSED_PAYLOAD = '{"dismissed":true}';

export function firstProjectGuideStorageKey(projectId: string): string {
  return `${STORAGE_PREFIX}${projectId}`;
}

function browserStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readFirstProjectGuideDismissed(
  projectId: string,
  storage: Pick<Storage, "getItem"> | null = browserStorage(),
): boolean {
  if (!projectId || !storage) return false;
  try {
    const raw = storage.getItem(firstProjectGuideStorageKey(projectId));
    if (!raw) return false;
    const parsed: unknown = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null &&
      "dismissed" in parsed && (parsed as { dismissed?: unknown }).dismissed === true;
  } catch {
    return false;
  }
}

export function writeFirstProjectGuideDismissed(
  projectId: string,
  storage: Pick<Storage, "setItem"> | null = browserStorage(),
): boolean {
  if (!projectId || !storage) return false;
  try {
    storage.setItem(firstProjectGuideStorageKey(projectId), DISMISSED_PAYLOAD);
    return true;
  } catch {
    return false;
  }
}
