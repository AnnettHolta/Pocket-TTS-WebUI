import { createMemo, createSignal, For, onCleanup, Show, untrack } from "solid-js";
import {
  TbOutlineCheck,
  TbOutlineChevronDown,
  TbOutlineDownload,
  TbOutlineInfoCircle,
  TbOutlinePlayerPlay,
  TbOutlinePlayerStop,
  TbOutlineTrash,
  TbOutlineWaveSine,
} from "solid-icons/tb";
import GeneralConfirmModal from "../components/GeneralConfirmModal";
import LibraryMenu from "../components/LibraryMenu";
import LibrarySearch from "../components/LibrarySearch";
import Modal from "../components/Modal";
import StoredAudio from "../components/StoredAudio";
import TablePagination from "../components/table/TablePagination";
import { locale, t } from "../i18n";
import createLibraryPreview from "../lib/createLibraryPreview";
import type { StoredList } from "../lib/createStoredList";
import type { GenerationHistoryItem } from "../lib/historyDb";
import "../components/LibraryList.css";
import "./HistoryPage.css";

export interface HistoryPageProps {
  list: StoredList<GenerationHistoryItem>;
  onReuse: (item: GenerationHistoryItem) => void;
  onDelete: (id: string) => void;
  onClearAll: () => void;
}

const PAGE_SIZES = [10, 25, 50, 100];
const dateFormat = createMemo(() => new Intl.DateTimeFormat(locale(), {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
}));

function HistoryRow(props: {
  item: GenerationHistoryItem;
  playing: boolean;
  onPlay: (url: string) => void;
  onReuse: () => void;
  onDetails: () => void;
  onDelete: () => void;
}) {
  let previewUrl: string | undefined;
  onCleanup(() => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  });

  const getPreviewUrl = (audio: Blob) => previewUrl ??= URL.createObjectURL(audio);

  return (
    <li class="library-row history-row">
      <Show when={props.item.audio} fallback={
        <span class="history-no-audio" aria-hidden="true"><TbOutlineWaveSine size={14} /></span>
      }>
        {(audio) => (
          <button
            type="button"
            class="btn btn-secondary library-preview"
            aria-label={t(props.playing ? "history.stop" : "history.play")}
            onClick={() => props.onPlay(getPreviewUrl(audio()))}
          >
            <Show when={props.playing} fallback={<TbOutlinePlayerPlay size={14} />}>
              <TbOutlinePlayerStop size={14} />
            </Show>
          </button>
        )}
      </Show>

      <div class="library-row-info">
        <h3>{props.item.text}</h3>
        <p>
          <time datetime={new Date(props.item.createdAt).toISOString()}>
            {dateFormat().format(props.item.createdAt)}
          </time>
          {" · "}{props.item.languageLabel}
        </p>
      </div>

      <button type="button" class="btn btn-secondary library-action" onClick={props.onReuse}>
        {t("history.reuse")}
      </button>

      <LibraryMenu label={t("history.clipActions")}>
        {(close) => (
          <>
            <button type="button" class="btn btn-ghost" onClick={() => { close(); props.onDetails(); }}>
              <TbOutlineInfoCircle size={15} />
              {t("history.details")}
            </button>
            <Show when={props.item.audio}>
              {(audio) => (
                <a
                  class="btn btn-ghost"
                  href={getPreviewUrl(untrack(audio))}
                  download={props.item.generatedFileName}
                  onClick={close}
                >
                  <TbOutlineDownload size={15} />
                  {t("player.downloadOgg")}
                </a>
              )}
            </Show>
            <button type="button" class="btn btn-ghost library-delete" onClick={() => { close(); props.onDelete(); }}>
              <TbOutlineTrash size={15} />
              {t("history.delete")}
            </button>
          </>
        )}
      </LibraryMenu>
    </li>
  );
}

export default function HistoryPage(props: HistoryPageProps) {
  const [detail, setDetail] = createSignal<GenerationHistoryItem | null>(null);
  const [pendingDeletion, setPendingDeletion] = createSignal<{ id: string } | "all" | null>(null);
  const preview = createLibraryPreview();
  const clearAllPending = () => pendingDeletion() === "all";
  const confirmDeletion = () => {
    const target = pendingDeletion();
    if (!target) return;
    setPendingDeletion(null);
    if (target === "all") {
      preview.stop();
      props.onClearAll();
    } else {
      if (preview.playing() === target.id) preview.stop();
      props.onDelete(target.id);
    }
  };
  const result = props.list.result;
  const showPageSize = () => result().totalMatches > PAGE_SIZES[0] || result().pageSize !== PAGE_SIZES[0];
  const changePage = (page: number, pageSize = result().pageSize) => {
    preview.stop();
    props.list.changePage(page, pageSize);
  };

  return (
    <section class="library-section history-page" aria-labelledby="history-list-title" aria-busy={props.list.loading() ? "true" : undefined}>
      <header class="library-section-heading">
        <div class="library-section-title">
          <h2 id="history-list-title">{t("history.saved")}</h2>
          <span>{result().totalItems}</span>
        </div>
        <div class="history-tools">
          <LibrarySearch label={t("history.search")} value={props.list.search()} onInput={(value) => {
            preview.stop();
            props.list.changeSearch(value);
          }} />
          <Show when={result().totalItems > 0}>
            <LibraryMenu label={t("history.options")}>
              {(close) => (
                <button type="button" class="btn btn-ghost library-delete" onClick={() => { close(); setPendingDeletion("all"); }}>
                  <TbOutlineTrash size={15} />
                  {t("history.clearAll")}
                </button>
              )}
            </LibraryMenu>
          </Show>
        </div>
      </header>

      <Show when={preview.error()}>
        <p class="history-preview-error" role="alert">{t("history.previewError")}</p>
      </Show>
      <Show
        when={result().items.length > 0}
        fallback={<p class="library-empty">{t(props.list.loading() ? "library.loading" : props.list.search().trim() ? "library.noMatches" : "history.empty")}</p>}
      >
        <ul class="library-list">
          <For each={result().items} keyed={(item) => item.id}>
            {(item) => (
              <HistoryRow
                item={item()}
                playing={preview.playing() === item().id}
                onPlay={(url) => void preview.play(item().id, url)}
                onReuse={() => props.onReuse(item())}
                onDetails={() => {
                  preview.stop();
                  setDetail(item());
                }}
                onDelete={() => setPendingDeletion({ id: item().id })}
              />
            )}
          </For>
        </ul>
        <Show when={showPageSize() || props.list.search().trim()}>
          <footer class="history-pagination">
            <TablePagination
              totalItems={result().totalMatches}
              page={result().page}
              pageSize={result().pageSize}
              hideSinglePageControls
              onPageChange={changePage}
            />
            <Show when={showPageSize()}>
              <LibraryMenu label={t("history.pageSize")} trigger={
                <>{t("history.perPage", { count: result().pageSize })}<TbOutlineChevronDown size={13} /></>
              }>
                {(close) => (
                  <For each={PAGE_SIZES}>
                    {(size) => (
                      <button
                        type="button"
                        class="btn btn-ghost history-size-option"
                        aria-pressed={size === result().pageSize ? "true" : "false"}
                        onClick={() => { close(); changePage(1, size); }}
                      >
                        {t("history.perPage", { count: size })}
                        <Show when={size === result().pageSize}><TbOutlineCheck size={14} /></Show>
                      </button>
                    )}
                  </For>
                )}
              </LibraryMenu>
            </Show>
          </footer>
        </Show>
      </Show>

      <Modal open={Boolean(detail())} heading={t("history.details")} onClose={() => setDetail(null)}>
        <Show when={detail()}>
          {(item) => (
            <div class="history-detail">
              <p class="history-detail-text">{item().text}</p>
              <dl>
                <dt>{t("history.colTime")}</dt><dd>{dateFormat().format(item().createdAt)}</dd>
                <dt>{t("history.colModel")}</dt><dd>{item().languageLabel} · {item().precision} · {t("settings.temperature")} {item().temperature.toFixed(2)}</dd>
                <dt>{t("history.colFiles")}</dt>
                <dd>{item().generatedFileName}<Show when={item().voiceFilePath || item().voiceFileName}>{(name) => <div>{name()}</div>}</Show></dd>
              </dl>
              <Show when={item().audio}>
                {(audio) => <StoredAudio audio={audio()} name={item().generatedFileName} />}
              </Show>
            </div>
          )}
        </Show>
      </Modal>

      <GeneralConfirmModal
        open={pendingDeletion() !== null}
        heading={t(clearAllPending() ? "history.clearAll" : "confirm.deleteClip")}
        message={t(clearAllPending() ? "history.clearConfirm" : "confirm.clipMessage")}
        confirmLabel={t(clearAllPending() ? "history.clearAll" : "history.delete")}
        onCancel={() => setPendingDeletion(null)}
        onConfirm={confirmDeletion}
      />
    </section>
  );
}
