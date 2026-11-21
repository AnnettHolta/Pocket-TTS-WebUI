import { createEffect, createMemo, createSignal, Match, onCleanup, onSettled, Show, Switch, untrack } from "solid-js";
import type { LanguageOption } from "./components/InferenceSettings";
import AppLayout, { type PageTab } from "./layout/AppLayout";
import { decodeAndResampleTo24kMono } from "./lib/audioUtils";
import createStoredList from "./lib/createStoredList";
import {
  addHistoryItem,
  clearHistory,
  deleteHistoryItem,
  deleteSavedVoice,
  getVoiceTranscript,
  listHistoryPage,
  listSavedVoicesPage,
  type GenerationHistoryItem,
  type PrecisionMode,
  type VoiceTranscriptRecord,
} from "./lib/historyDb";
import { probeHardwareInfo, type HardwareInfo } from "./lib/hardwareInfo";
import { encodeOggOpus } from "./lib/oggAudio";
import { getTtsClient } from "./lib/ttsClient";
import { t } from "./i18n";
import HistoryPage from "./pages/HistoryPage";
import StudioPage, { type StudioOutput } from "./pages/StudioPage";
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

function releaseOutput(output: StudioOutput): void {
  URL.revokeObjectURL(output.url);
  URL.revokeObjectURL(output.oggUrl);
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
  const [usingCpuFallback, setUsingCpuFallback] = createSignal(false);
  const [inferenceStage, setInferenceStage] = createSignal<string | null>(null);
  const [inferenceProgress, setInferenceProgress] = createSignal<number>(0);
  const [queueSnapshot, setQueueSnapshot] = createSignal<QueueSnapshot | null>(null);
  const [errorMessage, setErrorMessage] = createSignal<string | null>(null);
  const [output, setOutput] = createSignal<StudioOutput | null>(null);
  const [hardwareInfo, setHardwareInfo] = createSignal<HardwareInfo | null>(null);
  let generation: AbortController | null = null;
  let historyReuse = 0;

  const showError = (error: unknown) => setErrorMessage(error instanceof Error ? error.message : String(error));
  const history = createStoredList(
    (request) => listHistoryPage(request, untrack(activePage) === "history"),
    showError,
  );
  const voices = createStoredList(listSavedVoicesPage, showError);
  const navigate = (page: PageTab) => {
    historyReuse++;
    setActivePage(page);
  };

  createEffect(activePage, (page) => {
    if (page === "history") void history.refresh();
    if (page === "voices") void voices.refresh();
  });

  onCleanup(() => {
    generation?.abort();
    const result = output();
    if (result) releaseOutput(result);
  });

  const webGpuAvailable = createMemo(
    () => !usingCpuFallback() && (hardwareInfo()?.webGpuAdapterReady ?? false)
  );
  const reportedHardware = createMemo((): HardwareInfo | null => {
    const info = hardwareInfo();
    return info && usingCpuFallback() ? { ...info, hardwareAcceleration: "CPU (WASM)" } : info;
  });

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
    void history.refresh();

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
          setInferenceStage(usingCpuFallback() ? `CPU (WASM) · ${stage}` : stage);
          setInferenceProgress(progress);
        },
        signal,
        () => {
          setUsingCpuFallback(true);
          setInferenceStage(t("studio.cpuRetry"));
          setInferenceProgress(0);
        },
      );

      setInferenceStage(t("studio.compressing"));
      setInferenceProgress(0.99);
      const wavBlob = new Blob([result.wavBuffer], { type: "audio/wav" });
      const audio = await encodeOggOpus(wavBlob, { signal });
      signal.throwIfAborted();
      const previous = output();
      setOutput({
        wav: wavBlob,
        url: URL.createObjectURL(wavBlob),
        oggUrl: URL.createObjectURL(audio),
        name: generatedFileName,
      });
      if (previous) releaseOutput(previous);

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
      await history.refresh();
    } catch (err) {
      if (!signal.aborted) showError(err);
    } finally {
      generation = null;
      setIsGenerating(false);
      setInferenceStage(null);
      setInferenceProgress(0);
    }
  };

  const handleReuseHistory = async (item: GenerationHistoryItem) => {
    const request = ++historyReuse;
    const saved = item.voiceSha256 ? await getVoiceTranscript(item.voiceSha256) : null;
    if (request !== historyReuse) return;
    setText(item.text);
    setSelectedLang(item.languageId);
    setPrecision(item.precision);
    setTemperature(item.temperature);
    handleClearVoice();
    if (item.voiceFileName || item.voiceSha256) {
      if (saved?.audio) {
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
    await history.refresh();
  };

  const handleClearHistory = async () => {
    await clearHistory();
    await history.refresh();
  };

  const handleDeleteVoice = async (sha256: string) => {
    await deleteSavedVoice(sha256);
    if (voiceSha256() === sha256) handleClearVoice();
    await voices.refresh();
  };

  return (
    <AppLayout
      activePage={activePage()}
      onNavigate={navigate}
      historyCount={history.result().totalItems}
      webGpuAvailable={webGpuAvailable()}
      hardwareInfo={reportedHardware()}
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
            onUseSavedVoice={useSavedVoice}
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
            list={history}
            onReuse={(item) => void handleReuseHistory(item).catch(showError)}
            onDelete={(id) => void handleDeleteHistory(id).catch(showError)}
            onClearAll={() => void handleClearHistory().catch(showError)}
          />
        </Match>
        <Match when={activePage() === "voices"}>
          <VoicesPage
            list={voices}
            activeVoiceHash={voiceFile() ? voiceSha256() : null}
            onUse={useSavedVoice}
            onSaved={(voice) => {
              if (voice.sha256 && voice.sha256 === voiceSha256()) handleApplyVoice(voice);
              void voices.refresh();
            }}
            onDelete={(sha256) => void handleDeleteVoice(sha256).catch(showError)}
          />
        </Match>
      </Switch>
    </AppLayout>
  );
}
