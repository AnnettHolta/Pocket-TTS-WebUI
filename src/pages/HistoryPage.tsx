import { createMemo, Show } from "solid-js";
import { TbOutlineTrash } from "solid-icons/tb";
import Table, { type TableColumn } from "../components/table/Table";
import { t } from "../i18n";
import type { GenerationHistoryItem } from "../lib/historyDb";
import "./HistoryPage.css";

export interface HistoryPageProps {
  items: GenerationHistoryItem[];
  onReuse: (item: GenerationHistoryItem) => void;
  onDelete: (id: string) => void;
  onClearAll: () => void;
}

function formatTimestamp(ts: number): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(ts);
}

export default function HistoryPage(props: HistoryPageProps) {
  const columns = createMemo<TableColumn[]>(() => [
    { key: "time", label: t("history.colTime"), class: "history-col-time" },
    { key: "text", label: t("history.colText") },
    { key: "settings", label: t("history.colModel"), class: "history-col-model" },
    { key: "files", label: t("history.colFiles"), class: "history-col-files" },
    {
      key: "actions",
      label: t("history.colActions"),
      align: "right",
      class: "history-col-actions",
    },
  ]);

  return (
    <Table
      title={t("history.title", { count: props.items.length })}
      subtitle={t("history.subtitle")}
      columns={columns()}
      items={props.items}
      pageSizeOptions={[10, 25, 50, 100]}
      defaultPageSize={10}
      emptyMessage={t("history.empty")}
      headerActions={
        <Show when={props.items.length > 0}>
          <button
            type="button"
            class="btn btn-ghost btn-sm"
            onClick={() => props.onClearAll()}
          >
            {t("history.clearAll")}
          </button>
        </Show>
      }
      renderRow={(item) => (
        <>
          <td class="history-cell-time">{formatTimestamp(item.createdAt)}</td>
          <td>
            <div class="history-cell-text" title={item.text}>
              {item.text}
            </div>
          </td>
          <td>
            <div class="history-cell-model">
              <span class="history-model-name">{item.languageLabel}</span>
              <span class="history-model-sub">
                {item.precision} · temp {item.temperature.toFixed(2)}
              </span>
            </div>
          </td>
          <td>
            <div class="history-cell-files">
              <span class="history-file-line" title={item.generatedFileName}>
                {item.generatedFileName}
              </span>
              <Show when={item.voiceFilePath || item.voiceFileName}>
                <span
                  class="history-file-line muted"
                  title={item.voiceFilePath || item.voiceFileName || ""}
                >
                  src: {item.voiceFilePath || item.voiceFileName}
                </span>
              </Show>
            </div>
          </td>
          <td class="align-right">
            <div class="history-cell-actions">
              <button
                type="button"
                class="btn btn-secondary btn-sm"
                onClick={() => props.onReuse(item)}
              >
                {t("history.reuse")}
              </button>
              <button
                type="button"
                class="btn btn-ghost btn-sm"
                aria-label={t("history.delete")}
                onClick={() => props.onDelete(item.id)}
              >
                <TbOutlineTrash size={13} />
              </button>
            </div>
          </td>
        </>
      )}
    />
  );
}
