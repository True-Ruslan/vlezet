import { describe, expect, it } from "vitest";
import { createFurnitureCatalogUiStore } from "./furniture-catalog-ui-store";

describe("furniture catalogue runtime state", () => {
  it("preserves filters until explicit reset", () => {
    const store = createFurnitureCatalogUiStore();

    store.getState().setQuery("стол");
    store.getState().setCategory("table");

    expect(store.getState()).toMatchObject({ query: "стол", category: "table" });

    store.getState().resetFilters();

    expect(store.getState()).toMatchObject({ query: "", category: "all" });
  });

  it("updates query and category independently", () => {
    const store = createFurnitureCatalogUiStore();

    store.getState().setQuery("шкаф");
    expect(store.getState()).toMatchObject({ query: "шкаф", category: "all" });

    store.getState().setCategory("storage");
    expect(store.getState()).toMatchObject({ query: "шкаф", category: "storage" });
  });
});
