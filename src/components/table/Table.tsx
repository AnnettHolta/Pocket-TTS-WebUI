import { createEffect, createMemo, createSignal, For, Show } from "solid-js";
import type { JSX } from "@solidjs/web";
import TableItem from "./TableItem";
import TablePagination from "./TablePagination";
import "./Table.css";

export interface TableColumn {
  key: string;
  label: string;
  align?: "left" | "right";
  class?: string;
}

export interface TableProps<T> {
  title: string;
  subtitle?: string;
  columns: TableColumn[];
  items: T[];
  pageSizeOptions?: number[];
  defaultPageSize?: number;
  emptyMessage?: string;
  headerActions?: JSX.Element;
  renderRow: (item: T) => JSX.Element;
}

const DEFAULT_PAGE_SIZES = [10, 25, 50, 100];

export default function Table<T>(props: TableProps<T>) {
  const sizeOptions = () => props.pageSizeOptions ?? DEFAULT_PAGE_SIZES;
  const [pageSize, setPageSize] = createSignal<number>(
    props.defaultPageSize ?? sizeOptions()[0] ?? 10
  );
  const [page, setPage] = createSignal<number>(1);

  const totalPages = createMemo(() =>
    Math.max(1, Math.ceil(props.items.length / pageSize()))
  );

  // Clamp current page if items are removed or pageSize increases.
  createEffect(
    () => totalPages(),
    (maxPage) => {
      if (page() > maxPage) {
        setPage(maxPage);
      }
    }
  );

  const pagedItems = createMemo(() => {
    const start = (page() - 1) * pageSize();
    return props.items.slice(start, start + pageSize());
  });

  const handlePageSizeChange = (nextSize: number) => {
    setPageSize(nextSize);
    setPage(1);
  };

  return (
    <section class="card table-host">
      <div class="table-toolbar">
        <div class="table-toolbar-left">
          <h2 class="table-title">{props.title}</h2>
          <Show when={props.subtitle}>
            {(sub) => <span class="hint">{sub()}</span>}
          </Show>
        </div>

        <div class="table-toolbar-right">
          {props.headerActions}
          <label class="table-size-label" for="table-page-size">
            Rows:
          </label>
          <select
            id="table-page-size"
            class="table-size-select"
            value={String(pageSize())}
            onChange={(e) => handlePageSizeChange(Number(e.currentTarget.value))}
          >
            <For each={sizeOptions()}>
              {(opt) => <option value={String(opt)}>{opt}</option>}
            </For>
          </select>
        </div>
      </div>

      <Show
        when={props.items.length > 0}
        fallback={
          <div class="table-empty">
            {props.emptyMessage ?? "No records found."}
          </div>
        }
      >
        <div class="table-scroll">
          <table class="table-element">
            <thead>
              <tr>
                <For each={props.columns}>
                  {(col) => (
                    <th
                      class={`${col.align === "right" ? "align-right" : ""} ${col.class ?? ""}`.trim()}
                    >
                      {col.label}
                    </th>
                  )}
                </For>
              </tr>
            </thead>
            <tbody>
              <For each={pagedItems()}>
                {(item) => <TableItem>{props.renderRow(item)}</TableItem>}
              </For>
            </tbody>
          </table>
        </div>

        <TablePagination
          totalItems={props.items.length}
          page={page()}
          pageSize={pageSize()}
          onPageChange={setPage}
        />
      </Show>
    </section>
  );
}

