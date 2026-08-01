import { describe, expect, it, vi } from "vitest";
import {
  PROJECT_BACKUP_EXPORTED_EVENT,
  PROJECT_BACKUP_EXPORT_FAILED_EVENT,
  dispatchProjectBackupExported,
  dispatchProjectBackupExportFailed,
  subscribeProjectBackupExported,
  subscribeProjectBackupExportFailed,
} from "./download-events";

describe("M7.5 project backup download events", () => {
  it("publishes and subscribes to one runtime-only filename success event", () => {
    const target = new EventTarget();
    const listener = vi.fn();
    const unsubscribe = subscribeProjectBackupExported(listener, target);
    expect(dispatchProjectBackupExported("project.vlezet.json", target)).toBe(true);
    expect(listener).toHaveBeenCalledWith("project.vlezet.json");
    unsubscribe();
    dispatchProjectBackupExported("second.vlezet.json", target);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("publishes a categorized runtime failure without technical error payloads", () => {
    const target = new EventTarget();
    const listener = vi.fn();
    const unsubscribe = subscribeProjectBackupExportFailed(listener, target);
    expect(dispatchProjectBackupExportFailed("project.vlezet.json", target)).toBe(true);
    expect(listener).toHaveBeenCalledWith("project.vlezet.json");
    unsubscribe();
  });

  it("uses stable event names and fails closed without a target", () => {
    expect(PROJECT_BACKUP_EXPORTED_EVENT).toBe("vlezet:project-backup-exported");
    expect(PROJECT_BACKUP_EXPORT_FAILED_EVENT).toBe("vlezet:project-backup-export-failed");
    expect(dispatchProjectBackupExported("project.vlezet.json", null)).toBe(false);
    expect(dispatchProjectBackupExportFailed("project.vlezet.json", null)).toBe(false);
  });
});
