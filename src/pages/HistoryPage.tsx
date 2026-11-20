import { For, Show } from "solid-js";
import { TbOutlineTrash } from "solid-icons/tb";
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
  return (
    <section class="card">
      <div class="card-title-row">
        <div>
          <h2 class="card-title">Generation History ({props.items.length})</h2>
          <p class="hint" style={{ margin: "0.2rem 0 0" }}>
            Stored locally in IndexedDB — metadata only, no audio blobs.
          </p>
        </div>
        <Show when={props.items.length > 0}>
          <button
            type="button"
            class="btn btn-ghost btn-sm"
            onClick={() => props.onClearAll()}
          >
            Clear All
          </button>
        </Show>
      </div>

      <Show
        when={props.items.length > 0}
        fallback={
          <div class="history-empty">
            No generations yet. Metadata (text, generated file name, and original voice
            path) will appear here after you generate speech.
          </div>
        }
      >
        <div class="history-list">
          <For each={props.items}>
            {(item) => (
              <article class="history-item">
                <div class="history-top">
                  <span class="pill-value">{item.languageLabel}</span>
                  <span class="history-time">{formatTimestamp(item.createdAt)}</span>
                </div>

                <p class="history-text">{item.text}</p>

                <div class="history-tags">
                  <span class="history-tag">{item.precision}</span>
                  <span class="history-tag">temp {item.temperature.toFixed(2)}</span>
                  <Show when={item.voiceFileName}>
                    {(name) => <span class="history-tag">voice: {name()}</span>}
                  </Show>
                </div>

                <div class="history-files">
                  <span>
                    Output: <code>{item.generatedFileName}</code>
                  </span>
                  <Show when={item.voiceFilePath}>
                    {(path) => (
                      <span>
                        Source: <code>{path()}</code>
                      </span>
                    )}
                  </Show>
                </div>

                <div class="history-actions">
                  <button
                    type="button"
                    class="btn btn-secondary btn-sm"
                    onClick={() => props.onReuse(item)}
                  >
                    Reuse in Studio
                  </button>
                  <button
                    type="button"
                    class="btn btn-ghost btn-sm"
                    onClick={() => props.onDelete(item.id)}
                  >
                    <TbOutlineTrash size={13} />
                    <span>Delete</span>
                  </button>
                </div>
              </article>
            )}
          </For>
        </div>
      </Show>
    </section>
  );
}
