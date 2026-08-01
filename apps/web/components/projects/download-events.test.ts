import { describe, expect, it, vi } from "vitest";
import {
  PROJECT_BACKUP_EXPORTED_EVENT,
  dispatchProjectBackupExported,
  subscribeProjectBackupExported,
} from "./download-events";

describe("M7.5 project backup download event", () => {
  it("publishes and subscribes to one runtime-only filename event", () => {
    const target = new EventTarget();
    const listener = vi.fn();
    const unsubscribe = subscribeProjectBackupExported(listener, target);
    expect(dispatchProjectBackupExported("project.vlezet.json", target)).toBe(true);
    expect(listener).toHaveBeenCalledWith("project.vlezet.json");
    unsubscribe();
    dispatchProjectBackupExported("second.vlezet.json", target);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("uses a stable event name and fails closed without a target", () => {
    expect(PROJECT_BACKUP_EXPORTED_EVENT).toBe("vlezet:project-backup-exported");
    expect(dispatchProjectBackupExported("project.vlezet.json", null)).toBe(false);
  });
});
