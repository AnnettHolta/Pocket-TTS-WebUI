import { createMemo, For, Show } from "solid-js";
import { TbOutlineChevronLeft, TbOutlineChevronRight } from "solid-icons/tb";
import { t } from "../../i18n";
import "./TablePagination.css";

export interface TablePaginationProps {
  totalItems: number;
  page: number;
  pageSize: number;
  hideSinglePageControls?: boolean;
  onPageChange: (page: number) => void;
}

export default function TablePagination(props: TablePaginationProps) {
  const totalPages = createMemo(() =>
    Math.max(1, Math.ceil(props.totalItems / props.pageSize))
  );

  const rangeStart = createMemo(() =>
    props.totalItems === 0 ? 0 : (props.page - 1) * props.pageSize + 1
  );

  const rangeEnd = createMemo(() =>
    Math.min(props.totalItems, props.page * props.pageSize)
  );

  const pageNumbers = createMemo(() => {
    const total = totalPages();
    const current = props.page;
    const pages: number[] = [];
    const start = Math.max(1, current - 2);
    const end = Math.min(total, current + 2);
    for (let p = start; p <= end; p++) {
      pages.push(p);
    }
    return pages;
  });

  return (
    <div class="table-pagination">
      <span class="table-pagination-info">
        {t("table.showing", {
          start: rangeStart(),
          end: rangeEnd(),
          total: props.totalItems,
        })}
      </span>

      <Show when={!props.hideSinglePageControls || totalPages() > 1}>
        <div class="table-pagination-controls">
          <button
            type="button"
            class="table-page-btn"
            disabled={props.page <= 1}
            aria-label="Previous page"
            onClick={() => props.onPageChange(props.page - 1)}
          >
            <TbOutlineChevronLeft size={13} />
          </button>

          <For each={pageNumbers()}>
            {(p) => (
              <button
                type="button"
                class={`table-page-btn ${p === props.page ? "active" : ""}`}
                aria-current={p === props.page ? "page" : undefined}
                onClick={() => props.onPageChange(p)}
              >
                {p}
              </button>
            )}
          </For>

          <button
            type="button"
            class="table-page-btn"
            disabled={props.page >= totalPages()}
            aria-label="Next page"
            onClick={() => props.onPageChange(props.page + 1)}
          >
            <TbOutlineChevronRight size={13} />
          </button>
        </div>
      </Show>
    </div>
  );
}

