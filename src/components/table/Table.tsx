import { createEffect, createMemo, createSignal, For, Show, untrack } from "solid-js";
import type { Accessor } from "solid-js";
import type { JSX } from "@solidjs/web";
import { t } from "../../i18n";
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
  heading: string;
  subtitle?: string;
  columns: TableColumn[];
  items: T[];
  pageSizeOptions?: number[];
  defaultPageSize?: number;
  emptyMessage?: string;
  headerActions?: JSX.Element;
  pagination?: {
    page: number;
    pageSize: number;
    totalItems: number;
    loading: boolean;
    onChange: (page: number, pageSize: number) => void;
  };
  rowKey?: (item: T) => unknown;
  renderRow: (item: Accessor<T>) => JSX.Element;
}

const DEFAULT_PAGE_SIZES = [10, 25, 50, 100];

export default function Table<T>(props: TableProps<T>) {
  const sizeOptions = () => props.pageSizeOptions ?? DEFAULT_PAGE_SIZES;
  const [localSize, setPageSize] = createSignal<number>(
    props.defaultPageSize ?? sizeOptions()[0] ?? 10
  );
  const [localPage, setPage] = createSignal<number>(1);
  const pageSize = () => props.pagination?.pageSize ?? localSize();
  const page = () => props.pagination?.page ?? localPage();
  const itemCount = () => props.pagination?.totalItems ?? props.items.length;

  const totalPages = createMemo(() =>
    Math.max(1, Math.ceil(itemCount() / pageSize()))
  );

  // Clamp current page if items are removed or pageSize increases.
  createEffect(
    () => totalPages(),
    (maxPage) => {
      if (untrack(localPage) > maxPage) {
        setPage(maxPage);
      }
    }
  );

  const pagedItems = createMemo(() => {
    if (props.pagination) return props.items;
    const start = (page() - 1) * pageSize();
    return props.items.slice(start, start + pageSize());
  });

  const handlePageSizeChange = (nextSize: number) => {
    if (props.pagination) {
      props.pagination.onChange(1, nextSize);
      return;
    }
    setPageSize(nextSize);
    setPage(1);
  };

  return (
    <section class="card table-host" aria-busy={props.pagination?.loading ? "true" : undefined}>
      <div class="table-toolbar">
        <div class="table-toolbar-left">
          <h2 class="table-title">{props.heading}</h2>
          <Show when={props.subtitle}>
            {(sub) => <span class="hint">{sub()}</span>}
          </Show>
        </div>

        <div class="table-toolbar-right">
          {props.headerActions}
          <label class="table-size-label" for="table-page-size">
            {t("table.rows")}
          </label>
          <select
            id="table-page-size"
            class="table-size-select"
            value={String(pageSize())}
            disabled={props.pagination?.loading}
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
            {props.emptyMessage ?? t("table.empty")}
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
              <For each={pagedItems()} keyed={(item) => props.rowKey ? props.rowKey(item) : item}>
                {(item) => <TableItem>{props.renderRow(item)}</TableItem>}
              </For>
            </tbody>
          </table>
        </div>

        <TablePagination
          totalItems={itemCount()}
          page={page()}
          pageSize={pageSize()}
          onPageChange={(next) => {
            if (props.pagination) props.pagination.onChange(next, pageSize());
            else setPage(next);
          }}
        />
      </Show>
    </section>
  );
}

