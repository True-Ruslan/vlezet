import { createStore, type StoreApi } from "zustand/vanilla";
import type { FurnitureCategoryFilter } from "./furniture-catalog-model";

export type FurnitureCatalogUiState = {
  query: string;
  category: FurnitureCategoryFilter;
  setQuery: (query: string) => void;
  setCategory: (category: FurnitureCategoryFilter) => void;
  resetFilters: () => void;
};

export function createFurnitureCatalogUiStore(): StoreApi<FurnitureCatalogUiState> {
  return createStore<FurnitureCatalogUiState>((set) => ({
    query: "",
    category: "all",
    setQuery: (query) => set({ query }),
    setCategory: (category) => set({ category }),
    resetFilters: () => set({ query: "", category: "all" }),
  }));
}

export const furnitureCatalogUiStore = createFurnitureCatalogUiStore();
