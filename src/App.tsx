import { createMemo, createSignal, Match, onSettled, Switch } from "solid-js";
import type { LanguageOption } from "./components/InferenceSettings";
import AppLayout, { type PageTab } from "./layout/AppLayout";
import {
  addHistoryItem,
  clearHistory,
  deleteHistoryItem,
  listHistory,
  type GenerationHistoryItem,
  type PrecisionMode,
} from "./lib/historyDb";
import HistoryPage from "./pages/HistoryPage";
import StudioPage from "./pages/StudioPage";

const PLACEHOLDER_LANGUAGES: LanguageOption[] = [
  { id: "english_2026-10", label: "English (2026-10)", cached: false },
  { id: "french_24l", label: "French (24L)", cached: false },
  { id: "german_24l", label: "German (24L)", cached: false },
  { id: "italian_24l", label: "Italian (24L)", cached: false },
  { id: "portuguese_24l", label: "Portuguese (24L)", cached: false },
  { id: "spanish_24l", label: "Spanish (24L)", cached: false },
];

function buildGeneratedFilename(languageId: string, ts: number): string {
  const iso = new Date(ts).toISOString().replace(/[:.]/g, "-").slice(0, 19);
  return `pocket-tts-${languageId}-${iso}.wav`;
}

export default function App() {
  const [activePage, setActivePage] = createSignal<PageTab>("studio");
  const [languages] = createSignal<LanguageOption[]>(PLACEHOLDER_LANGUAGES);
  const [selectedLang, setSelectedLang] = createSignal<string>(PLACEHOLDER_LANGUAGES[0].id);
  const [precision, setPrecision] = createSignal<PrecisionMode>("mixed");
  const [temperature, setTemperature] = createSignal<number>(0.3);
  const [text, setText] = createSignal<string>(
    "Hello! This is Pocket TTS running locally in the browser."
  );
  const [voiceFile, setVoiceFile] = createSignal<File | null>(null);
  const [voicePath, setVoicePath] = createSignal<string>("");
  const [voiceTranscript, setVoiceTranscript] = createSignal<string>("");
  const [voiceSha256, setVoiceSha256] = createSignal<string | null>(null);
  const [status, setStatus] = createSignal<string>(
    "UI ready — backend & WebGPU worker not wired yet."
  );
  const [isGenerating, setIsGenerating] = createSignal<boolean>(false);
  const [audioUrl] = createSignal<string | null>(null);
  const [webGpuAvailable, setWebGpuAvailable] = createSignal<boolean>(false);
  const [history, setHistory] = createSignal<GenerationHistoryItem[]>([]);

  onSettled(() => {
    setWebGpuAvailable("gpu" in navigator);
    void listHistory()
      .then((items) => setHistory(items))
      .catch((err) => console.error("IndexedDB load error:", err));
  });

  const currentLanguage = createMemo(() =>
    languages().find((lang) => lang.id === selectedLang())
  );

  const handleApplyVoice = (payload: {
    file: File | null;
    path: string;
    transcript: string;
    sha256: string | null;
  }) => {
    setVoiceFile(payload.file);
    setVoicePath(payload.path);
    setVoiceTranscript(payload.transcript);
    setVoiceSha256(payload.sha256);
  };

  const handleClearVoice = () => {
    setVoiceFile(null);
    setVoicePath("");
    setVoiceTranscript("");
    setVoiceSha256(null);
  };

  const handleGenerate = async (e: Event) => {
    e.preventDefault();
    const promptText = text().trim();
    if (!promptText || isGenerating()) return;

    setIsGenerating(true);
    const now = Date.now();
    const lang = currentLanguage();
    const file = voiceFile();
    const generatedFileName = buildGeneratedFilename(selectedLang(), now);

    const entry: GenerationHistoryItem = {
      id: crypto.randomUUID(),
      createdAt: now,
      text: promptText,
      languageId: selectedLang(),
      languageLabel: lang?.label ?? selectedLang(),
      precision: precision(),
      temperature: temperature(),
      voiceFileName: file ? file.name : null,
      voiceFilePath: voicePath().trim() || null,
      voiceTranscript: voiceTranscript().trim() || null,
      voiceSha256: voiceSha256(),
      generatedFileName,
    };

    try {
      await addHistoryItem(entry);
      setHistory((prev) => [entry, ...prev]);
      setStatus(
        `Saved "${generatedFileName}" to local IndexedDB history (inference worker not connected yet).`
      );
    } catch (err) {
      console.error("Failed to save history:", err);
      setStatus("Failed to save generation metadata to IndexedDB.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleReuseHistory = (item: GenerationHistoryItem) => {
    setText(item.text);
    setSelectedLang(item.languageId);
    setPrecision(item.precision);
    setTemperature(item.temperature);
    setVoicePath(item.voiceFilePath ?? "");
    setVoiceTranscript(item.voiceTranscript ?? "");
    setVoiceSha256(item.voiceSha256 ?? null);
    setStatus(`Loaded settings from ${item.generatedFileName}.`);
    setActivePage("studio");
  };

  const handleDeleteHistory = async (id: string) => {
    await deleteHistoryItem(id);
    setHistory((prev) => prev.filter((item) => item.id !== id));
  };

  const handleClearHistory = async () => {
    await clearHistory();
    setHistory([]);
  };

  return (
    <AppLayout
      activePage={activePage()}
      onNavigate={setActivePage}
      historyCount={history().length}
      webGpuAvailable={webGpuAvailable()}
    >
      <Switch>
        <Match when={activePage() === "studio"}>
          <StudioPage
            languages={languages()}
            selectedLang={selectedLang()}
            onSelectLang={setSelectedLang}
            currentCached={currentLanguage()?.cached ?? false}
            precision={precision()}
            onSelectPrecision={setPrecision}
            temperature={temperature()}
            onChangeTemperature={setTemperature}
            voiceFile={voiceFile()}
            voicePath={voicePath()}
            voiceTranscript={voiceTranscript()}
            voiceSha256={voiceSha256()}
            onApplyVoice={handleApplyVoice}
            onClearVoice={handleClearVoice}
            text={text()}
            onTextInput={setText}
            status={status()}
            isGenerating={isGenerating()}
            audioUrl={audioUrl()}
            onGenerate={handleGenerate}
          />
        </Match>
        <Match when={activePage() === "history"}>
          <HistoryPage
            items={history()}
            onReuse={handleReuseHistory}
            onDelete={(id) => void handleDeleteHistory(id)}
            onClearAll={() => void handleClearHistory()}
          />
        </Match>
      </Switch>
    </AppLayout>
  );
}
