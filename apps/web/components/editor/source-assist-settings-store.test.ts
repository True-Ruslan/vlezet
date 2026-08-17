import { describe, expect, it } from "vitest";
import { createSourceAssistSettingsStore } from "./source-assist-settings-store";

describe("M8.4 source assist runtime settings", () => {
  it("defaults source assistance to Off", () => {
    const store = createSourceAssistSettingsStore();
    expect(store.getState().enabled).toBe(false);
  });

  it("sets and toggles source assistance deterministically", () => {
    const store = createSourceAssistSettingsStore();

    store.getState().setEnabled(true);
    expect(store.getState().enabled).toBe(true);

    store.getState().toggle();
    expect(store.getState().enabled).toBe(false);

    store.getState().toggle();
    expect(store.getState().enabled).toBe(true);

    store.getState().setEnabled(false);
    expect(store.getState().enabled).toBe(false);
  });
});
