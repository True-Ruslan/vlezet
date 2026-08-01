export const PROJECT_BACKUP_EXPORTED_EVENT = "vlezet:project-backup-exported";
export const PROJECT_BACKUP_EXPORT_FAILED_EVENT = "vlezet:project-backup-export-failed";

type BackupEventTarget = Pick<EventTarget, "dispatchEvent" | "addEventListener" | "removeEventListener">;

function browserTarget(): BackupEventTarget | null {
  return typeof window === "undefined" ? null : window;
}

function dispatchFilenameEvent(
  eventName: string,
  filename: string,
  target: Pick<EventTarget, "dispatchEvent"> | null,
): boolean {
  if (!filename || !target) return false;
  return target.dispatchEvent(new CustomEvent<string>(eventName, { detail: filename }));
}

function subscribeFilenameEvent(
  eventName: string,
  listener: (filename: string) => void,
  target: Pick<EventTarget, "addEventListener" | "removeEventListener"> | null,
): () => void {
  if (!target) return () => {};
  const onEvent = (event: Event) => listener((event as CustomEvent<string>).detail);
  target.addEventListener(eventName, onEvent);
  return () => target.removeEventListener(eventName, onEvent);
}

export function dispatchProjectBackupExported(
  filename: string,
  target: Pick<EventTarget, "dispatchEvent"> | null = browserTarget(),
): boolean {
  return dispatchFilenameEvent(PROJECT_BACKUP_EXPORTED_EVENT, filename, target);
}

export function dispatchProjectBackupExportFailed(
  filename: string,
  target: Pick<EventTarget, "dispatchEvent"> | null = browserTarget(),
): boolean {
  return dispatchFilenameEvent(PROJECT_BACKUP_EXPORT_FAILED_EVENT, filename, target);
}

export function subscribeProjectBackupExported(
  listener: (filename: string) => void,
  target: Pick<EventTarget, "addEventListener" | "removeEventListener"> | null = browserTarget(),
): () => void {
  return subscribeFilenameEvent(PROJECT_BACKUP_EXPORTED_EVENT, listener, target);
}

export function subscribeProjectBackupExportFailed(
  listener: (filename: string) => void,
  target: Pick<EventTarget, "addEventListener" | "removeEventListener"> | null = browserTarget(),
): () => void {
  return subscribeFilenameEvent(PROJECT_BACKUP_EXPORT_FAILED_EVENT, listener, target);
}
