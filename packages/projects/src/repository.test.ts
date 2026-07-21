import { describe, expect, it } from "vitest";
import { createProject, MemoryProjectRepository } from "./index";

const project = (id: string, updatedAt: string) => createProject({
  id,
  name: id,
  now: updatedAt,
});

describe("MemoryProjectRepository", () => {
  it("stores, lists newest first and uses id as a deterministic tie-break", async () => {
    const repository = new MemoryProjectRepository();
    await repository.put(project("b", "2026-07-21T10:00:00.000Z"));
    await repository.put(project("c", "2026-07-21T11:00:00.000Z"));
    await repository.put(project("a", "2026-07-21T10:00:00.000Z"));
    expect((await repository.list()).map((item) => item.id)).toEqual(["c", "a", "b"]);
  });

  it("returns isolated snapshots and supports delete", async () => {
    const repository = new MemoryProjectRepository();
    const source = project("one", "2026-07-21T10:00:00.000Z");
    await repository.put(source);
    const first = await repository.get("one");
    const second = await repository.get("one");
    expect(first).toEqual(source);
    expect(first).not.toBe(source);
    expect(second).not.toBe(first);
    await repository.delete("one");
    expect(await repository.get("one")).toBeNull();
  });

  it("persists the last project id separately", async () => {
    const repository = new MemoryProjectRepository();
    expect(await repository.getLastProjectId()).toBeNull();
    await repository.setLastProjectId("one");
    expect(await repository.getLastProjectId()).toBe("one");
    await repository.setLastProjectId(null);
    expect(await repository.getLastProjectId()).toBeNull();
  });
});
