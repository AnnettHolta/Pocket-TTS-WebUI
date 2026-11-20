import { Show } from "solid-js";
import { TbOutlineTrash } from "solid-icons/tb";
import Table, { type TableColumn } from "../components/table/Table";
import type { GenerationHistoryItem } from "../lib/historyDb";
import "./HistoryPage.css";

export interface HistoryPageProps {
  items: GenerationHistoryItem[];
  onReuse: (item: GenerationHistoryItem) => void;
  onDelete: (id: string) => void;
  onClearAll: () => void;
}

const COLUMNS: TableColumn[] = [
  { key: "time", label: "Time", class: "history-col-time" },
  { key: "text", label: "Text" },
  { key: "settings", label: "Model", class: "history-col-model" },
  { key: "files", label: "Output & Source", class: "history-col-files" },
  { key: "actions", label: "Actions", align: "right", class: "history-col-actions" },
];

function formatTimestamp(ts: number): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(ts);
}

export default function HistoryPage(props: HistoryPageProps) {
  return (
    <Table
      title={`Generation History (${props.items.length})`}
      subtitle="Stored locally in IndexedDB — metadata only, no audio blobs."
      columns={COLUMNS}
      items={props.items}
      pageSizeOptions={[10, 25, 50, 100]}
      defaultPageSize={10}
      emptyMessage="No generations yet. Metadata (text, generated file name, and original voice path) will appear here after you generate speech."
      headerActions={
        <Show when={props.items.length > 0}>
          <button
            type="button"
            class="btn btn-ghost btn-sm"
            onClick={() => props.onClearAll()}
          >
            Clear All
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
                Reuse
              </button>
              <button
                type="button"
                class="btn btn-ghost btn-sm"
                aria-label="Delete"
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
