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
const DB_VERSION = 2;
const HISTORY_STORE = "history";
const VOICE_TRANSCRIPT_STORE = "voiceTranscripts";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(HISTORY_STORE)) {
        const historyStore = db.createObjectStore(HISTORY_STORE, { keyPath: "id" });
        historyStore.createIndex("createdAt", "createdAt", { unique: false });
      }
      if (!db.objectStoreNames.contains(VOICE_TRANSCRIPT_STORE)) {
        db.createObjectStore(VOICE_TRANSCRIPT_STORE, { keyPath: "sha256" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Failed to open IndexedDB"));
  });
}

async function requestResult<T>(
  store: string,
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction(store, mode);
      const request = run(transaction.objectStore(store));
      transaction.oncomplete = () => resolve(request.result);
      transaction.onabort = () =>
        reject(request.error ?? transaction.error ?? new Error("Browser storage operation failed."));
    });
  } finally {
    db.close();
  }
}

export async function computeFileSha256(file: File): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function getVoiceTranscript(sha256: string): Promise<VoiceTranscriptRecord | null> {
  return (await requestResult(VOICE_TRANSCRIPT_STORE, "readonly", (store) => store.get(sha256))) ?? null;
}

export async function listSavedVoices(): Promise<VoiceTranscriptRecord[]> {
  const records: VoiceTranscriptRecord[] = await requestResult(
    VOICE_TRANSCRIPT_STORE, "readonly", (store) => store.getAll()
  );
  return records.filter((voice) => Boolean(voice.audio)).sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function saveVoiceTranscript(record: VoiceTranscriptRecord): Promise<void> {
  await requestResult(VOICE_TRANSCRIPT_STORE, "readwrite", (store) => store.put(record));
}

export async function deleteSavedVoice(sha256: string): Promise<void> {
  await requestResult(VOICE_TRANSCRIPT_STORE, "readwrite", (store) => store.delete(sha256));
}

export async function listHistory(): Promise<GenerationHistoryItem[]> {
  const items: GenerationHistoryItem[] = await requestResult(HISTORY_STORE, "readonly", (store) => store.getAll());
  return items.sort((a, b) => b.createdAt - a.createdAt);
}

export async function addHistoryItem(item: GenerationHistoryItem): Promise<void> {
  await requestResult(HISTORY_STORE, "readwrite", (store) => store.put(item));
}

export async function deleteHistoryItem(id: string): Promise<void> {
  await requestResult(HISTORY_STORE, "readwrite", (store) => store.delete(id));
}

export async function clearHistory(): Promise<void> {
  await requestResult(HISTORY_STORE, "readwrite", (store) => store.clear());
}
