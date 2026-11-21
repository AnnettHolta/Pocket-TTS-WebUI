export type PrecisionMode = "mixed" | "int8";

export interface GenerationHistoryItem {
  id: string;
  createdAt: number;
  text: string;
  languageId: string;
  languageLabel: string;
  precision: PrecisionMode;
  temperature: number;
  voiceFileName: string | null;
  voiceFilePath: string | null;
  voiceTranscript?: string | null;
  voiceSha256?: string | null;
  generatedFileName: string;
  audio?: Blob;
}

export interface VoiceTranscriptRecord {
  sha256: string;
  fileName: string;
  filePath: string | null;
  transcript: string;
  updatedAt: number;
  audio?: Blob;
}

const DB_NAME = "pocket-tts-webui";
const DB_VERSION = 4;
const HISTORY_STORE = "history";
const VOICE_TRANSCRIPT_STORE = "voiceTranscripts";
const AUDIO_STORE = "audio";
type HistoryMetadata = Omit<GenerationHistoryItem, "audio"> & { hasAudio?: boolean };
type VoiceMetadata = Omit<VoiceTranscriptRecord, "audio"> & { savedAt?: number };

export interface StoredPageRequest {
  page: number;
  pageSize: number;
  search: string;
}

export interface StoredPage<T> {
  page: number;
  items: T[];
  totalItems: number;
  totalMatches: number;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(HISTORY_STORE)) {
        const historyStore = db.createObjectStore(HISTORY_STORE, { keyPath: "id" });
        historyStore.createIndex("createdAt", "createdAt", { unique: false });
      }
      const transaction = request.transaction!;
      const voices = db.objectStoreNames.contains(VOICE_TRANSCRIPT_STORE)
        ? transaction.objectStore(VOICE_TRANSCRIPT_STORE)
        : db.createObjectStore(VOICE_TRANSCRIPT_STORE, { keyPath: "sha256" });
      if (!voices.indexNames.contains("savedAt")) {
        voices.createIndex("savedAt", "savedAt", { unique: false });
      }

      if (!db.objectStoreNames.contains(AUDIO_STORE)) {
        const audio = db.createObjectStore(AUDIO_STORE);
        moveEmbeddedAudio<GenerationHistoryItem>(
          transaction.objectStore(HISTORY_STORE),
          audio,
          (item) => ({ ...item, hasAudio: true }),
        );
        moveEmbeddedAudio<VoiceTranscriptRecord>(
          voices,
          audio,
          (voice) => ({ ...voice, savedAt: voice.updatedAt }),
        );
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Failed to open IndexedDB"));
  });
}

function moveEmbeddedAudio<T extends { audio?: Blob }>(
  store: IDBObjectStore,
  audioStore: IDBObjectStore,
  mark: (metadata: Omit<T, "audio">) => object,
) {
  const request = store.openCursor();
  request.onsuccess = () => {
    const cursor = request.result;
    if (!cursor) return;
    const { audio, ...metadata } = cursor.value as T;
    if (audio) {
      audioStore.put(audio, [store.name, cursor.primaryKey]);
      cursor.update(mark(metadata));
    }
    cursor.continue();
  };
}

async function withStores<T>(
  stores: string[],
  mode: IDBTransactionMode,
  run: (transaction: IDBTransaction) => Promise<T>,
): Promise<T> {
  const db = await openDb();
  try {
    const transaction = db.transaction(stores, mode);
    const finished = new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onabort = () =>
        reject(transaction.error ?? new Error("Browser storage operation failed."));
    });
    const [, value] = await Promise.all([finished, run(transaction)]);
    return value;
  } finally {
    db.close();
  }
}

function withStore<T>(
  store: string,
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => Promise<T>,
): Promise<T> {
  return withStores([store], mode, (transaction) => run(transaction.objectStore(store)));
}

function readRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function requestResult<T>(
  store: string,
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return withStore(store, mode, (objectStore) => readRequest(run(objectStore)));
}

function putWithAudio(store: string, id: string, metadata: object, audio?: Blob) {
  return withStores([store, AUDIO_STORE], "readwrite", (transaction) => {
    const audioStore = transaction.objectStore(AUDIO_STORE);
    const key = [store, id];
    return Promise.all([
      readRequest(transaction.objectStore(store).put(metadata)),
      audio ? readRequest(audioStore.put(audio, key)) : readRequest(audioStore.delete(key)),
    ]);
  });
}

function deleteWithAudio(store: string, id: string) {
  return withStores([store, AUDIO_STORE], "readwrite", (transaction) => Promise.all([
    readRequest(transaction.objectStore(store).delete(id)),
    readRequest(transaction.objectStore(AUDIO_STORE).delete([store, id])),
  ]));
}

function attachAudio<T extends object>(
  source: string,
  items: T[],
  audioId: (item: T) => string | undefined,
): Promise<Array<T & { audio?: Blob }>> {
  if (!items.some(audioId)) return Promise.resolve(items);
  return withStore(AUDIO_STORE, "readonly", (store) => Promise.all(
    items.map(async (item) => {
      const id = audioId(item);
      if (!id) return item;
      const audio: Blob | undefined = await readRequest(store.get([source, id]));
      return audio ? { ...item, audio } : item;
    }),
  ));
}

function lastPage(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / pageSize));
}

function readIndexedPage<T>(index: IDBIndex, query: StoredPageRequest): Promise<StoredPage<T>> {
  return new Promise((resolve, reject) => {
    const count = index.count();
    count.onerror = () => reject(count.error);
    count.onsuccess = () => {
      const total = count.result;
      const page = Math.min(query.page, lastPage(total, query.pageSize));
      const items: T[] = [];
      const finish = () => resolve({ page, items, totalItems: total, totalMatches: total });
      if (total === 0) {
        finish();
        return;
      }

      let skip = (page - 1) * query.pageSize;
      const request = index.openCursor(null, "prev");
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) {
          finish();
        } else if (skip > 0) {
          cursor.advance(skip);
          skip = 0;
        } else {
          items.push(cursor.value as T);
          if (items.length === query.pageSize) finish();
          else cursor.continue();
        }
      };
    };
  });
}

function scanIndexedPage<T>(
  index: IDBIndex,
  query: StoredPageRequest,
  matches: (item: T) => boolean,
): Promise<StoredPage<T>> {
  return new Promise((resolve, reject) => {
    let totalItems = 0;
    let totalMatches = 0;
    let requestedPage: T[] | undefined;
    let trailingPage: T[] = [];
    const request = index.openCursor(null, "prev");
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) {
        resolve({
          page: Math.min(query.page, lastPage(totalMatches, query.pageSize)),
          items: requestedPage ?? trailingPage,
          totalItems,
          totalMatches,
        });
        return;
      }

      const item = cursor.value as T;
      totalItems++;
      if (matches(item)) {
        if (totalMatches % query.pageSize === 0) trailingPage = [];
        if (Math.floor(totalMatches / query.pageSize) + 1 === query.page) {
          requestedPage = trailingPage;
        }
        trailingPage.push(item);
        totalMatches++;
      }
      cursor.continue();
    };
  });
}

export async function computeFileSha256(file: File): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function getVoiceTranscript(sha256: string): Promise<VoiceTranscriptRecord | null> {
  const voice: VoiceMetadata | undefined = await requestResult(
    VOICE_TRANSCRIPT_STORE, "readonly", (store) => store.get(sha256),
  );
  if (!voice) return null;
  const [result] = await attachAudio(VOICE_TRANSCRIPT_STORE, [voice], (item) =>
    item.savedAt === undefined ? undefined : item.sha256,
  );
  return result;
}

export async function hasSavedVoices(): Promise<boolean> {
  const count = await requestResult(VOICE_TRANSCRIPT_STORE, "readonly", (store) => store.index("savedAt").count());
  return count > 0;
}

export async function listSavedVoicesPage(query: StoredPageRequest): Promise<StoredPage<VoiceTranscriptRecord>> {
  const term = query.search.trim().toLowerCase();
  const page = await withStore(VOICE_TRANSCRIPT_STORE, "readonly", (store) => {
    const index = store.index("savedAt");
    return term
      ? scanIndexedPage<VoiceMetadata>(index, query, (voice) =>
          voice.fileName.toLowerCase().includes(term) || (voice.transcript ?? "").toLowerCase().includes(term),
        )
      : readIndexedPage<VoiceMetadata>(index, query);
  });
  const items = await attachAudio(VOICE_TRANSCRIPT_STORE, page.items, (voice) => voice.sha256);
  return { ...page, items };
}

export async function saveVoiceTranscript(record: VoiceTranscriptRecord): Promise<void> {
  const { audio, ...metadata } = record;
  await putWithAudio(
    VOICE_TRANSCRIPT_STORE,
    record.sha256,
    { ...metadata, savedAt: audio ? record.updatedAt : undefined },
    audio,
  );
}

export async function deleteSavedVoice(sha256: string): Promise<void> {
  await deleteWithAudio(VOICE_TRANSCRIPT_STORE, sha256);
}

export async function listHistoryPage(
  query: StoredPageRequest,
  includeAudio = true,
): Promise<StoredPage<GenerationHistoryItem>> {
  const term = query.search.trim().toLowerCase();
  const page = await withStore(HISTORY_STORE, "readonly", (store) => {
    const index = store.index("createdAt");
    return term
      ? scanIndexedPage<HistoryMetadata>(index, query, (item) => item.text.toLowerCase().includes(term))
      : readIndexedPage<HistoryMetadata>(index, query);
  });
  if (!includeAudio) return page;
  const items = await attachAudio(HISTORY_STORE, page.items, (item) => item.hasAudio ? item.id : undefined);
  return { ...page, items };
}

export async function addHistoryItem(item: GenerationHistoryItem): Promise<void> {
  const { audio, ...metadata } = item;
  await putWithAudio(HISTORY_STORE, item.id, { ...metadata, hasAudio: Boolean(audio) }, audio);
}

export async function deleteHistoryItem(id: string): Promise<void> {
  await deleteWithAudio(HISTORY_STORE, id);
}

export async function clearHistory(): Promise<void> {
  await withStores([HISTORY_STORE, AUDIO_STORE], "readwrite", (transaction) => Promise.all([
    readRequest(transaction.objectStore(HISTORY_STORE).clear()),
    readRequest(transaction.objectStore(AUDIO_STORE).delete(
      IDBKeyRange.bound([HISTORY_STORE], [HISTORY_STORE, []], true, true),
    )),
  ]));
}
