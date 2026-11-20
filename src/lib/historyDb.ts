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
}

export interface VoiceTranscriptRecord {
  sha256: string;
  fileName: string;
  filePath: string | null;
  transcript: string;
  updatedAt: number;
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

export async function computeFileSha256(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  const bytes = new Uint8Array(digest);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function getVoiceTranscript(
  sha256: string
): Promise<VoiceTranscriptRecord | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(VOICE_TRANSCRIPT_STORE, "readonly");
    const store = tx.objectStore(VOICE_TRANSCRIPT_STORE);
    const request = store.get(sha256);

    request.onsuccess = () =>
      resolve((request.result as VoiceTranscriptRecord | undefined) ?? null);
    request.onerror = () =>
      reject(request.error ?? new Error("Failed to read voice transcript"));
    tx.oncomplete = () => db.close();
  });
}

export async function saveVoiceTranscript(
  record: VoiceTranscriptRecord
): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(VOICE_TRANSCRIPT_STORE, "readwrite");
    const store = tx.objectStore(VOICE_TRANSCRIPT_STORE);
    const request = store.put(record);

    request.onsuccess = () => resolve();
    request.onerror = () =>
      reject(request.error ?? new Error("Failed to save voice transcript"));
    tx.oncomplete = () => db.close();
  });
}

export async function listHistory(): Promise<GenerationHistoryItem[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(HISTORY_STORE, "readonly");
    const store = tx.objectStore(HISTORY_STORE);
    const request = store.getAll();

    request.onsuccess = () => {
      const items = (request.result as GenerationHistoryItem[]) ?? [];
      items.sort((a, b) => b.createdAt - a.createdAt);
      resolve(items);
    };
    request.onerror = () => reject(request.error ?? new Error("Failed to read history"));
    tx.oncomplete = () => db.close();
  });
}

export async function addHistoryItem(item: GenerationHistoryItem): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(HISTORY_STORE, "readwrite");
    const store = tx.objectStore(HISTORY_STORE);
    const request = store.put(item);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error("Failed to save history item"));
    tx.oncomplete = () => db.close();
  });
}

export async function deleteHistoryItem(id: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(HISTORY_STORE, "readwrite");
    const store = tx.objectStore(HISTORY_STORE);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error("Failed to delete history item"));
    tx.oncomplete = () => db.close();
  });
}

export async function clearHistory(): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(HISTORY_STORE, "readwrite");
    const store = tx.objectStore(HISTORY_STORE);
    const request = store.clear();

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error("Failed to clear history"));
    tx.oncomplete = () => db.close();
  });
}
