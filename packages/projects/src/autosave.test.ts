import { afterEach, describe, expect, it, vi } from "vitest";
import { AutosaveCoordinator, type SaveStatus } from "./index";

afterEach(() => vi.useRealTimers());

describe("AutosaveCoordinator", () => {
  it("debounces and saves only the latest snapshot", async () => {
    vi.useFakeTimers();
    const saved: number[] = [];
    const statuses: SaveStatus[] = [];
    const coordinator = new AutosaveCoordinator<number>({
      delayMs: 150,
      save: async (value) => { saved.push(value); },
      onStatus: (status) => statuses.push(status),
      now: () => "2026-07-21T19:00:00.000Z",
    });
    coordinator.schedule(1);
    coordinator.schedule(2);
    await vi.advanceTimersByTimeAsync(149);
    expect(saved).toEqual([]);
    await vi.advanceTimersByTimeAsync(1);
    expect(saved).toEqual([2]);
    expect(statuses.at(-1)).toEqual({ kind: "saved", savedAt: "2026-07-21T19:00:00.000Z" });
  });

  it("keeps failed work and retries the newest snapshot", async () => {
    vi.useFakeTimers();
    let fail = true;
    const saved: number[] = [];
    const coordinator = new AutosaveCoordinator<number>({
      delayMs: 10,
      save: async (value) => {
        if (fail) throw new Error("disk");
        saved.push(value);
      },
      onStatus: () => undefined,
    });
    coordinator.schedule(1);
    await vi.advanceTimersByTimeAsync(10);
    coordinator.schedule(2);
    fail = false;
    await coordinator.retry();
    expect(saved).toEqual([2]);
  });

  it("flushes pending work and dispose prevents later timers", async () => {
    vi.useFakeTimers();
    const saved: string[] = [];
    const coordinator = new AutosaveCoordinator<string>({
      delayMs: 1000,
      save: async (value) => { saved.push(value); },
      onStatus: () => undefined,
    });
    coordinator.schedule("now");
    await coordinator.flush();
    expect(saved).toEqual(["now"]);
    coordinator.schedule("never");
    coordinator.dispose();
    await vi.runAllTimersAsync();
    expect(saved).toEqual(["now"]);
  });
});
