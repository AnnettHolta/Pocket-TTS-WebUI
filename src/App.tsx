import { createMemo, createSignal, Match, onSettled, Switch } from "solid-js";
import type { LanguageOption } from "./components/InferenceSettings";
import AppLayout, { type PageTab } from "./layout/AppLayout";
import { decodeAndResampleTo24kMono } from "./lib/audioUtils";
import {
  addHistoryItem,
  clearHistory,
  deleteHistoryItem,
  listHistory,
  type GenerationHistoryItem,
  type PrecisionMode,
} from "./lib/historyDb";
import { probeHardwareInfo, type HardwareInfo } from "./lib/hardwareInfo";
import { getTtsClient } from "./lib/ttsClient";
import HistoryPage from "./pages/HistoryPage";
import StudioPage from "./pages/StudioPage";
import type { QueueSnapshot } from "./workers/ttsTypes";

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
  const [languages, setLanguages] = createSignal<LanguageOption[]>(PLACEHOLDER_LANGUAGES);
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
  const [isGenerating, setIsGenerating] = createSignal<boolean>(false);
  const [inferenceStage, setInferenceStage] = createSignal<string | null>(null);
  const [inferenceProgress, setInferenceProgress] = createSignal<number>(0);
  const [queueSnapshot, setQueueSnapshot] = createSignal<QueueSnapshot | null>(null);
  const [errorMessage, setErrorMessage] = createSignal<string | null>(null);
  const [audioUrl, setAudioUrl] = createSignal<string | null>(null);
  const [hardwareInfo, setHardwareInfo] = createSignal<HardwareInfo | null>(null);
  const [history, setHistory] = createSignal<GenerationHistoryItem[]>([]);

  const webGpuAvailable = createMemo(
    () => hardwareInfo()?.webGpuAdapterReady ?? false
  );

  onSettled(() => {
    void fetch("/api/languages")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { languages?: LanguageOption[] } | null) => {
        if (data?.languages && data.languages.length > 0) {
          setLanguages(data.languages);
          if (!data.languages.some((l) => l.id === selectedLang())) {
            setSelectedLang(data.languages[0].id);
          }
        }
      })
      .catch((err) => console.warn("Failed to load /api/languages:", err));

    void probeHardwareInfo()
      .then((info) => setHardwareInfo(info))
      .catch((err) => console.error("Hardware probe error:", err));
    void listHistory()
      .then((items) => setHistory(items))
      .catch((err) => console.error("IndexedDB load error:", err));

    const client = getTtsClient();
    const unsub = client.subscribeQueue((snapshot) => {
      setQueueSnapshot(snapshot);
    });
    return () => unsub();
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
    setErrorMessage(null);
    setInferenceStage("Queued");
    setInferenceProgress(0);

    const now = Date.now();
    const lang = currentLanguage();
    const languageId = selectedLang();
    const precisionMode = precision();
    const file = voiceFile();
    const generatedFileName = buildGeneratedFilename(languageId, now);

    try {
      setInferenceStage("Preparing model on server");
      setInferenceProgress(0.05);
      const prepRes = await fetch(
        `/api/languages/${encodeURIComponent(languageId)}/prepare`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            precision: precisionMode,
            includeEncoder: Boolean(file),
          }),
        }
      );
      if (!prepRes.ok) {
        const errBody = (await prepRes.json().catch(() => ({}))) as { error?: string };
        throw new Error(errBody.error || `Server model prepare failed (${prepRes.status})`);
      }
      setLanguages((prev) =>
        prev.map((l) => (l.id === languageId ? { ...l, cached: true } : l))
      );

      let refAudio24k: Float32Array | undefined;
      if (file) {
        setInferenceStage("Resampling reference audio");
        refAudio24k = await decodeAndResampleTo24kMono(file);
      }

      const client = getTtsClient();
      const result = await client.synthesize(
        {
          text: promptText,
          languageId,
          precision: precisionMode,
          temperature: temperature(),
          refAudio24k,
          refTranscript: voiceTranscript().trim() || undefined,
        },
        (stage, progress) => {
          setInferenceStage(stage);
          setInferenceProgress(progress);
        }
      );

      const prevUrl = audioUrl();
      if (prevUrl) URL.revokeObjectURL(prevUrl);
      const wavBlob = new Blob([result.wavBuffer], { type: "audio/wav" });
      setAudioUrl(URL.createObjectURL(wavBlob));

      const entry: GenerationHistoryItem = {
        id: crypto.randomUUID(),
        createdAt: now,
        text: promptText,
        languageId,
        languageLabel: lang?.label ?? languageId,
        precision: precisionMode,
        temperature: temperature(),
        voiceFileName: file ? file.name : null,
        voiceFilePath: voicePath().trim() || null,
        voiceTranscript: voiceTranscript().trim() || null,
        voiceSha256: voiceSha256(),
        generatedFileName,
      };

      await addHistoryItem(entry);
      setHistory((prev) => [entry, ...prev]);
    } catch (err) {
      console.error("Inference error:", err);
      setErrorMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setIsGenerating(false);
      setInferenceStage(null);
      setInferenceProgress(0);
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
      hardwareInfo={hardwareInfo()}
    >
      <Switch>
        <Match when={activePage() === "studio"}>
          <StudioPage
            languages={languages()}
            selectedLang={selectedLang()}
            onSelectLang={setSelectedLang}
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
            isGenerating={isGenerating()}
            inferenceStage={inferenceStage()}
            inferenceProgress={inferenceProgress()}
            queueLength={queueSnapshot()?.queueLength ?? 0}
            errorMessage={errorMessage()}
            onDismissError={() => setErrorMessage(null)}
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
