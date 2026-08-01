export const PROJECT_BACKUP_EXPORTED_EVENT = "vlezet:project-backup-exported";

type BackupEventTarget = Pick<EventTarget, "dispatchEvent" | "addEventListener" | "removeEventListener">;

function browserTarget(): BackupEventTarget | null {
  return typeof window === "undefined" ? null : window;
}

export function dispatchProjectBackupExported(
  filename: string,
  target: Pick<EventTarget, "dispatchEvent"> | null = browserTarget(),
): boolean {
  if (!filename || !target) return false;
  return target.dispatchEvent(new CustomEvent<string>(PROJECT_BACKUP_EXPORTED_EVENT, { detail: filename }));
}

export function subscribeProjectBackupExported(
  listener: (filename: string) => void,
  target: Pick<EventTarget, "addEventListener" | "removeEventListener"> | null = browserTarget(),
): () => void {
  if (!target) return () => {};
  const onEvent = (event: Event) => listener((event as CustomEvent<string>).detail);
  target.addEventListener(PROJECT_BACKUP_EXPORTED_EVENT, onEvent);
  return () => target.removeEventListener(PROJECT_BACKUP_EXPORTED_EVENT, onEvent);
}
