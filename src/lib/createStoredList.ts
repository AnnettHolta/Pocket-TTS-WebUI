import { createSignal, onCleanup } from "solid-js";
import type { StoredPage, StoredPageRequest } from "./historyDb";

export type StoredList<T> = ReturnType<typeof createStoredList<T>>;

export default function createStoredList<T>(
  load: (request: StoredPageRequest) => Promise<StoredPage<T>>,
  onError: (error: unknown) => void,
) {
  const [result, setResult] = createSignal<StoredPage<T> & { pageSize: number }>({
    page: 1,
    pageSize: 10,
    items: [],
    totalItems: 0,
    totalMatches: 0,
  });
  const [search, setSearch] = createSignal("");
  const [loading, setLoading] = createSignal(true);
  let request: StoredPageRequest = { page: 1, pageSize: 10, search: "" };
  let revision = 0;
  let searchTimer: ReturnType<typeof setTimeout> | undefined;

  onCleanup(() => {
    clearTimeout(searchTimer);
    revision++;
  });

  const refresh = async (next = request) => {
    clearTimeout(searchTimer);
    request = next;
    const current = ++revision;
    setLoading(true);
    try {
      const page = await load(next);
      if (current !== revision) return;
      request = { ...next, page: page.page };
      setResult({ ...page, pageSize: next.pageSize });
    } catch (error) {
      if (current === revision) onError(error);
    } finally {
      if (current === revision) setLoading(false);
    }
  };

  return {
    result,
    search,
    loading,
    refresh: () => refresh(),
    changePage: (page: number, pageSize = request.pageSize) => {
      if (loading()) return;
      void refresh({ ...request, page, pageSize });
    },
    changeSearch: (text: string) => {
      setSearch(text);
      if (text.trim() === request.search) return;
      request = { ...request, page: 1, search: text.trim() };
      revision++;
      setLoading(true);
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => void refresh(), 150);
    },
  };
}
