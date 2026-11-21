import { createMemo, createSignal, Match, onCleanup, onSettled, Show, Switch } from "solid-js";
import type { LanguageOption } from "./components/InferenceSettings";
import AppLayout, { type PageTab } from "./layout/AppLayout";
import { decodeAndResampleTo24kMono } from "./lib/audioUtils";
import {
  addHistoryItem,
  clearHistory,
  deleteHistoryItem,
  deleteSavedVoice,
  listHistory,
  listSavedVoices,
  type GenerationHistoryItem,
  type PrecisionMode,
  type VoiceTranscriptRecord,
} from "./lib/historyDb";
import { probeHardwareInfo, type HardwareInfo } from "./lib/hardwareInfo";
import { encodeOgg } from "./lib/oggAudio";
import { getTtsClient } from "./lib/ttsClient";
import { t } from "./i18n";
import HistoryPage from "./pages/HistoryPage";
import StudioPage from "./pages/StudioPage";
import VoicesPage from "./pages/VoicesPage";
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
  return `pocket-tts-${languageId}-${iso}.ogg`;
}

export default function App() {
  const [activePage, setActivePage] = createSignal<PageTab>("studio");
  const [languages, setLanguages] = createSignal<LanguageOption[]>(PLACEHOLDER_LANGUAGES);
  const [selectedLang, setSelectedLang] = createSignal<string>(PLACEHOLDER_LANGUAGES[0].id);
  const [precision, setPrecision] = createSignal<PrecisionMode>("mixed");
  const [temperature, setTemperature] = createSignal<number>(0.35);
  const [text, setText] = createSignal<string>(
    "Hello! This is Pocket TTS running locally in the browser."
  );
  const [voiceFile, setVoiceFile] = createSignal<File | null>(null);
  const [voicePath, setVoicePath] = createSignal<string>("");
  const [voiceTranscript, setVoiceTranscript] = createSignal<string>("");
  const [voiceSha256, setVoiceSha256] = createSignal<string | null>(null);
  const [voiceNeedsAttachment, setVoiceNeedsAttachment] = createSignal(false);
  const [isGenerating, setIsGenerating] = createSignal<boolean>(false);
  const [inferenceStage, setInferenceStage] = createSignal<string | null>(null);
  const [inferenceProgress, setInferenceProgress] = createSignal<number>(0);
  const [queueSnapshot, setQueueSnapshot] = createSignal<QueueSnapshot | null>(null);
  const [errorMessage, setErrorMessage] = createSignal<string | null>(null);
  const [output, setOutput] = createSignal<{ url: string; name: string } | null>(null);
  const [hardwareInfo, setHardwareInfo] = createSignal<HardwareInfo | null>(null);
  const [history, setHistory] = createSignal<GenerationHistoryItem[]>([]);
  const [voices, setVoices] = createSignal<VoiceTranscriptRecord[]>([]);
  let generation: AbortController | null = null;
  let voiceRefresh = 0;

  const showError = (error: unknown) => setErrorMessage(error instanceof Error ? error.message : String(error));
  const refreshVoices = async () => {
    const revision = ++voiceRefresh;
    try {
      const items = await listSavedVoices();
      if (revision === voiceRefresh) setVoices(items);
    } catch (error) {
      showError(error);
    }
  };

  onCleanup(() => {
    generation?.abort();
    const result = output();
    if (result) URL.revokeObjectURL(result.url);
  });

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
      .catch(showError);
    void refreshVoices();

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
    setVoiceNeedsAttachment(false);
    void refreshVoices();
  };

  const handleClearVoice = () => {
    setVoiceFile(null);
    setVoicePath("");
    setVoiceTranscript("");
    setVoiceSha256(null);
    setVoiceNeedsAttachment(false);
  };

  const useSavedVoice = (voice: VoiceTranscriptRecord, transcript = voice.transcript, path = voice.filePath ?? "") => {
    if (!voice.audio) return;
    setVoiceFile(new File([voice.audio], voice.fileName, { type: voice.audio.type }));
    setVoicePath(path);
    setVoiceTranscript(transcript);
    setVoiceSha256(voice.sha256);
    setVoiceNeedsAttachment(false);
    setActivePage("studio");
  };

  const handleGenerate = async (e: Event) => {
    e.preventDefault();
    const promptText = text().trim();
    if (!promptText || isGenerating() || voiceNeedsAttachment()) return;

    const controller = new AbortController();
    generation = controller;
    const { signal } = controller;
    setIsGenerating(true);
    setErrorMessage(null);
    setInferenceStage("Queued");
    setInferenceProgress(0);

    const now = Date.now();
    const lang = currentLanguage();
    const languageId = selectedLang();
    const precisionMode = precision();
    const file = voiceFile();
    const submittedTemperature = temperature();
    const submittedVoicePath = voicePath().trim() || null;
    const submittedVoiceTranscript = voiceTranscript().trim() || null;
    const submittedVoiceHash = voiceSha256();
    const generatedFileName = buildGeneratedFilename(languageId, now);

    try {
      setInferenceStage("Preparing model on server");
      setInferenceProgress(0.05);
      const prepRes = await fetch(
        `/api/languages/${encodeURIComponent(languageId)}/prepare`,
        {
          method: "POST",
          signal,
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
      signal.throwIfAborted();

      const client = getTtsClient();
      const result = await client.synthesize(
        {
          text: promptText,
          languageId,
          precision: precisionMode,
          temperature: submittedTemperature,
          refAudio24k,
        },
        (stage, progress) => {
          setInferenceStage(stage);
          setInferenceProgress(progress);
        },
        signal
      );

      setInferenceStage(t("studio.compressing"));
      setInferenceProgress(0.99);
      const wavBlob = new Blob([result.wavBuffer], { type: "audio/wav" });
      const audio = await encodeOgg(wavBlob, "opus", signal);
      signal.throwIfAborted();
      const previous = output();
      setOutput({ url: URL.createObjectURL(audio), name: generatedFileName });
      if (previous) URL.revokeObjectURL(previous.url);

      const entry: GenerationHistoryItem = {
        id: crypto.randomUUID(),
        createdAt: now,
        text: promptText,
        languageId,
        languageLabel: lang?.label ?? languageId,
        precision: precisionMode,
        temperature: submittedTemperature,
        voiceFileName: file ? file.name : null,
        voiceFilePath: submittedVoicePath,
        voiceTranscript: submittedVoiceTranscript,
        voiceSha256: submittedVoiceHash,
        generatedFileName,
        audio,
      };

      await addHistoryItem(entry);
      setHistory((prev) => [entry, ...prev]);
    } catch (err) {
      if (!signal.aborted) showError(err);
    } finally {
      generation = null;
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
    handleClearVoice();
    if (item.voiceFileName || item.voiceSha256) {
      const saved = voices().find((voice) => voice.sha256 === item.voiceSha256 && voice.audio);
      if (saved) {
        useSavedVoice(saved, item.voiceTranscript ?? "", item.voiceFilePath ?? "");
      } else {
        setVoicePath(item.voiceFilePath || item.voiceFileName || "");
        setVoiceTranscript(item.voiceTranscript ?? "");
        setVoiceSha256(item.voiceSha256 ?? null);
        setVoiceNeedsAttachment(true);
      }
    }
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

  const handleDeleteVoice = async (sha256: string) => {
    await deleteSavedVoice(sha256);
    if (voiceSha256() === sha256) handleClearVoice();
    await refreshVoices();
  };

  return (
    <AppLayout
      activePage={activePage()}
      onNavigate={setActivePage}
      historyCount={history().length}
      webGpuAvailable={webGpuAvailable()}
      hardwareInfo={hardwareInfo()}
    >
      <Show when={activePage() !== "studio" && errorMessage()}>
        <p class="studio-error" role="alert">
          {errorMessage()}
          <button type="button" class="btn btn-ghost btn-sm" onClick={() => setErrorMessage(null)}>
            {t("studio.dismiss")}
          </button>
        </p>
      </Show>
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
            voiceNeedsAttachment={voiceNeedsAttachment()}
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
            output={output()}
            onGenerate={handleGenerate}
            onCancel={() => generation?.abort()}
          />
        </Match>
        <Match when={activePage() === "history"}>
          <HistoryPage
            items={history()}
            onReuse={handleReuseHistory}
            onDelete={(id) => void handleDeleteHistory(id).catch(showError)}
            onClearAll={() => void handleClearHistory().catch(showError)}
          />
        </Match>
        <Match when={activePage() === "voices"}>
          <VoicesPage
            voices={voices()}
            onUse={useSavedVoice}
            onSaved={() => void refreshVoices()}
            onDelete={(sha256) => void handleDeleteVoice(sha256).catch(showError)}
          />
        </Match>
      </Switch>
    </AppLayout>
  );
}
