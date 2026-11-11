import { type Catalog, type Page } from "@hoosoo/shared";
import { useApi } from "./data";
import { catalogPath } from "../services/query-cache";

export function useCatalogs() {
  const departments = useApi<Page<Catalog>>(catalogPath("departments")),
    positions = useApi<Page<Catalog>>(catalogPath("positions"));
  return { departments, positions };
}
