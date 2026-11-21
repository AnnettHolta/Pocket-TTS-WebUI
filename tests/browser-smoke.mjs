import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { chromium } from "playwright";
import { createServer, preview } from "vite";

function referenceTone() {
  const sampleRate = 24_000;
  const pcm = Buffer.alloc(sampleRate * 2);
  for (let sample = 0; sample < sampleRate; sample++) {
    pcm.writeInt16LE(Math.round(3000 * Math.sin(2 * Math.PI * 220 * sample / sampleRate)), sample * 2);
  }
  const header = Buffer.alloc(44);
  header.write("RIFF");
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVEfmt ", 8);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return { name: "reference.wav", mimeType: "audio/wav", buffer: Buffer.concat([header, pcm]) };
}

async function verifyOggOpus(link) {
  const { header, duration, peak } = await link.evaluate(async (element) => {
    const bytes = await (await fetch(element.href)).arrayBuffer();
    const header = String.fromCharCode(...new Uint8Array(bytes, 0, Math.min(128, bytes.byteLength)));
    const context = new AudioContext();
    try {
      const decoded = await context.decodeAudioData(bytes);
      let peak = 0;
      for (const sample of decoded.getChannelData(0)) peak = Math.max(peak, Math.abs(sample));
      return { header, duration: decoded.duration, peak };
    } finally {
      await context.close();
    }
  });
  assert.ok(header.startsWith("OggS"));
  assert.ok(header.includes("OpusHead"), "The Ogg container should hold Opus audio.");
  assert.ok(duration > 0 && peak > 0.001, "The clip should decode to audible audio.");
  return duration;
}

function audioBytes(link) {
  return link.evaluate(async (element) => {
    const bytes = await (await fetch(element.href)).arrayBuffer();
    return Array.from(new Uint8Array(bytes));
  });
}

async function verifyLibraryPagination(browser, origin, historyAudio, voiceAudio) {
  const page = await browser.newPage({ locale: "en-US" });
  page.setDefaultTimeout(10_000);
  try {
    await page.route("**/__legacy-library", (route) => route.fulfill({
      contentType: "text/html",
      body: "<!doctype html><title>Library fixture</title>",
    }));
    await page.goto(`${origin}/__legacy-library`);
    await page.evaluate(({ historyAudio, voiceAudio }) => new Promise((resolve, reject) => {
      const request = indexedDB.open("pocket-tts-webui", 2);
      request.onupgradeneeded = () => {
        const db = request.result;
        db.createObjectStore("history", { keyPath: "id" }).createIndex("createdAt", "createdAt");
        db.createObjectStore("voiceTranscripts", { keyPath: "sha256" });
      };
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction(["history", "voiceTranscripts"], "readwrite");
        const history = tx.objectStore("history");
        const voices = tx.objectStore("voiceTranscripts");
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onabort = () => { db.close(); reject(tx.error); };
        const clip = new Blob([new Uint8Array(historyAudio)], { type: "audio/ogg" });
        const reference = new Blob([new Uint8Array(voiceAudio)], { type: "audio/ogg" });
        for (let i = 1; i <= 12; i++) {
          const suffix = String(i).padStart(2, "0");
          const timestamp = Date.UTC(2026, 0, 1, 0, i);
          history.put({
            id: `clip-${suffix}`, createdAt: timestamp,
            text: i === 1 ? "Sleepy fox" : `Generated row ${suffix}`,
            languageId: "english_2026-10", languageLabel: "English",
            precision: "mixed", temperature: 0.35,
            voiceFileName: null, voiceFilePath: null, generatedFileName: `${suffix}.ogg`,
            ...(i === 1 || i === 12 ? { audio: clip } : {}),
          });
          voices.put({
            sha256: `voice-${suffix}`, fileName: `Voice ${suffix}.wav`, filePath: null,
            updatedAt: timestamp, transcript: i === 1 ? "Patient narrator" : "",
            audio: reference,
          });
        }
        voices.put({
          sha256: "notes-only", fileName: "Legacy notes.wav", filePath: null,
          updatedAt: Date.UTC(2026, 0, 2), transcript: "No recording attached.",
        });
      };
    }), { historyAudio, voiceAudio });

    await page.goto(origin);
    const desktopNav = page.getByRole("navigation", { name: "Views" });
    await desktopNav.getByRole("button", { name: "History (12)" }).click();
    await page.getByText("Generated row 12", { exact: true }).waitFor();
    assert.equal(await page.locator(".history-row").count(), 10);
    await page.getByLabel("Items per page", { exact: true }).click();
    await page.getByRole("button", { name: "25 per page" }).click();
    await page.getByText("Sleepy fox", { exact: true }).waitFor();
    assert.equal(await page.locator(".history-row").count(), 12);
    await page.getByLabel("Items per page", { exact: true }).click();
    await page.getByRole("button", { name: "10 per page" }).click();
    await page.locator(".history-row").nth(10).waitFor({ state: "detached" });
    await page.getByRole("button", { name: "Next page" }).click();
    await page.getByText("Sleepy fox", { exact: true }).waitFor();
    assert.equal(await page.locator(".history-row").count(), 2);
    const sleepyRow = page.locator(".history-row").filter({ hasText: "Sleepy fox" });
    await sleepyRow.evaluate((row) => { row.dataset.refreshCheck = "same"; });
    const clipDownload = sleepyRow.locator("a[download]");
    const clipUrl = await clipDownload.getAttribute("href");

    const search = page.getByRole("searchbox", { name: "Search generated text" });
    await search.fill("SLEEPY");
    await page.getByText("Showing 1–1 of 1", { exact: true }).waitFor();
    assert.equal(await sleepyRow.getAttribute("data-refresh-check"), "same");
    assert.equal(await clipDownload.getAttribute("href"), clipUrl);
    await sleepyRow.getByLabel("Clip actions").click();
    await verifyOggOpus(clipDownload);
    await search.fill("no match exists");
    await page.getByText("No matching items.", { exact: true }).waitFor();
    await search.clear();
    await page.getByText("Generated row 12", { exact: true }).waitFor();
    await page.getByRole("button", { name: "Next page" }).click();
    await sleepyRow.getByLabel("Clip actions").click();
    await sleepyRow.getByRole("button", { name: "Delete" }).click();
    const deleteClip = page.getByRole("dialog", { name: "Delete clip?" });
    await deleteClip.getByRole("button", { name: "Cancel" }).click();
    await deleteClip.waitFor({ state: "hidden" });
    await sleepyRow.waitFor();
    await sleepyRow.getByLabel("Clip actions").click();
    await sleepyRow.getByRole("button", { name: "Delete" }).click();
    await deleteClip.getByRole("button", { name: "Delete" }).click();
    await sleepyRow.waitFor({ state: "detached" });
    const lastRow = page.locator(".history-row").filter({ hasText: "Generated row 02" });
    await lastRow.getByLabel("Clip actions").click();
    await lastRow.getByRole("button", { name: "Delete" }).click();
    await deleteClip.getByRole("button", { name: "Delete" }).click();
    await page.getByText("Generated row 12", { exact: true }).waitFor();
    assert.equal(await page.getByRole("button", { name: "Next page" }).count(), 0);

    await desktopNav.getByRole("button", { name: "Voices" }).click();
    await page.getByText("Voice 12.wav", { exact: true }).waitFor();
    assert.equal(await page.locator(".voices-row").count(), 10);
    await page.getByRole("button", { name: "Next page" }).click();
    await page.getByText("Voice 01.wav", { exact: true }).waitFor();
    assert.equal(await page.locator(".voices-row").count(), 2);
    const narrator = page.locator(".voices-row").filter({ hasText: "Patient narrator" });
    await narrator.evaluate((row) => { row.dataset.refreshCheck = "same"; });
    const voiceSearch = page.getByRole("searchbox", { name: "Search voice names and transcripts" });
    await voiceSearch.fill("narrator");
    await page.locator(".voices-row").nth(1).waitFor({ state: "detached" });
    assert.equal(await narrator.getAttribute("data-refresh-check"), "same");
    await page.getByLabel("Voice actions").click();
    await verifyOggOpus(page.getByRole("link", { name: "Download Ogg" }));
    await voiceSearch.fill("VOICE 12");
    await page.getByText("Voice 12.wav", { exact: true }).waitFor();
    assert.equal(await page.locator(".voices-row").count(), 1);
    await voiceSearch.fill("legacy notes");
    await page.getByText("No matching items.", { exact: true }).waitFor();

    await desktopNav.getByRole("button", { name: "History (10)" }).click();
    await page.getByLabel("History options").click();
    await page.getByRole("button", { name: "Clear All" }).click();
    const clearHistory = page.getByRole("dialog", { name: "Clear All" });
    await clearHistory.waitFor();
    await page.keyboard.press("Escape");
    await clearHistory.waitFor({ state: "hidden" });
    await desktopNav.getByRole("button", { name: "History (10)" }).waitFor();
    await page.getByLabel("History options").click();
    await page.getByRole("button", { name: "Clear All" }).click();
    await clearHistory.getByRole("button", { name: "Clear All" }).click();
    await desktopNav.getByRole("button", { name: "History (0)" }).waitFor();
    const stores = await page.evaluate(() => new Promise((resolve, reject) => {
      const open = indexedDB.open("pocket-tts-webui");
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const db = open.result;
        const tx = db.transaction(["audio", "voiceTranscripts"]);
        const audio = tx.objectStore("audio").getAllKeys();
        const voices = tx.objectStore("voiceTranscripts").getAll();
        tx.oncomplete = () => {
          db.close();
          resolve({
            audio: audio.result,
            hasEmbeddedAudio: voices.result.some((voice) => "audio" in voice),
          });
        };
        tx.onabort = () => { db.close(); reject(tx.error); };
      };
    }));
    assert.equal(stores.audio.length, 12);
    assert.ok(stores.audio.every(([source]) => source === "voiceTranscripts"));
    assert.equal(stores.hasEmbeddedAudio, false);

    await desktopNav.getByRole("button", { name: "Studio", exact: true }).click();
    await page.getByRole("button", { name: "Choose voice", exact: true }).click();
    const picker = page.getByRole("dialog", { name: "Choose a saved voice" });
    await picker.getByRole("button", { name: "Next page" }).click();
    await picker.getByRole("button", { name: /Voice 01.wav/ }).filter({ hasText: "Patient narrator" }).click();
    await page.getByText("Voice 01.wav", { exact: true }).waitFor();
  } finally {
    await page.context().close();
  }
}

const dev = process.argv.includes("--dev");
const options = { host: "127.0.0.1", port: 0 };
const server = dev ? await createServer({ server: options }) : await preview({ preview: options });
let browser;
try {
  if (dev) await server.listen();
  browser = await chromium.launch({ channel: process.env.POCKETTTS_BROWSER_CHANNEL || undefined });
  const page = await browser.newPage({ locale: "en-US" });
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.setDefaultTimeout(10_000);
  const address = server.httpServer.address();
  assert.ok(address && typeof address !== "string");
  const origin = `http://127.0.0.1:${address.port}/`;
  await page.goto(origin);

  const desktopNav = page.getByRole("navigation", { name: "Views" });
  await page.setViewportSize({ width: 740, height: 820 });
  const header = page.getByRole("banner");
  const tightHeader = await header.evaluate((element) => {
    const labels = [...element.querySelectorAll(".one-liner")];
    return labels.length === 7 && labels.every((label) => {
      const style = getComputedStyle(label);
      const bounds = label.getBoundingClientRect();
      return style.whiteSpace === "nowrap" && style.textOverflow === "ellipsis"
        && bounds.x >= 0 && bounds.right <= element.clientWidth;
    });
  });
  assert.ok(tightHeader, "Header labels should stay on one line and fit within the viewport.");
  await page.setViewportSize({ width: 1280, height: 820 });
  await page.getByRole("button", { name: "Choose voice", exact: true }).click();
  const emptyLibraryUpload = page.getByRole("dialog", { name: "Upload voice" });
  await emptyLibraryUpload.waitFor();
  assert.equal(await page.locator("dialog[open]").count(), 1);
  await emptyLibraryUpload.getByRole("button", { name: "Cancel" }).click();
  await emptyLibraryUpload.waitFor({ state: "hidden" });
  await page.waitForFunction(() => document.activeElement?.textContent?.trim() === "Choose voice");
  const tone = referenceTone();
  await page.getByRole("button", { name: "Choose voice", exact: true }).click();
  await emptyLibraryUpload.locator('input[type="file"]').setInputFiles(tone);
  await emptyLibraryUpload.getByRole("button", { name: "Save & Apply" }).click();
  await emptyLibraryUpload.waitFor({ state: "hidden", timeout: 120_000 });
  await page.getByText(tone.name, { exact: true }).waitFor();
  await page.getByRole("button", { name: "Clear", exact: true }).click();
  await desktopNav.getByRole("button", { name: "Voices" }).click();
  const transfer = await page.evaluateHandle(({ name, mimeType, bytes }) => {
    const data = new DataTransfer();
    data.items.add(new File([new Uint8Array(bytes)], name, { type: mimeType }));
    return data;
  }, { name: tone.name, mimeType: tone.mimeType, bytes: Array.from(tone.buffer) });
  const addVoice = page.getByRole("region", { name: "Voice Cloning" }).getByRole("button", { name: "Add voice", exact: true });
  await addVoice.dispatchEvent("drop", { dataTransfer: transfer });
  await transfer.dispose();
  const dialog = page.getByRole("dialog");
  await dialog.getByText(tone.name, { exact: true }).waitFor();
  const saveVoice = dialog.getByRole("button", { name: "Save & Apply" });
  await saveVoice.and(page.locator("button:enabled")).waitFor();
  await dialog.getByLabel("Transcript notes").fill("Browser smoke test reference");
  await saveVoice.click();
  await dialog.waitFor({ state: "hidden", timeout: 120_000 });
  await page.getByLabel("Voice actions").click();
  const voiceDownload = page.getByRole("link", { name: "Download Ogg" });
  await verifyOggOpus(voiceDownload);
  const voiceAudio = await audioBytes(voiceDownload);
  await page.getByLabel("Play preview: reference.wav").click();
  await page.getByLabel("Stop preview: reference.wav").waitFor();
  await page.getByRole("button", { name: "Use in Studio" }).click();
  await page.getByRole("button", { name: "Clear", exact: true }).click();
  await page.getByRole("button", { name: "Choose voice", exact: true }).click();
  const picker = page.getByRole("dialog", { name: "Choose a saved voice" });
  await picker.getByRole("button", { name: "Upload voice" }).click();
  const upload = page.getByRole("dialog", { name: "Upload voice" });
  await upload.waitFor();
  assert.equal(await page.locator("dialog[open]").count(), 1);
  await upload.getByRole("button", { name: "Cancel" }).click();
  await picker.waitFor();
  await picker.getByRole("button", { name: /reference.wav/ }).filter({ hasText: "Browser smoke test reference" }).click();
  await picker.waitFor({ state: "hidden" });
  await desktopNav.getByRole("button", { name: "Voices" }).click();
  await page.getByLabel("Voice actions").click();
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  const editedTranscript = "Updated browser smoke test reference";
  await dialog.getByLabel("Transcript notes").fill(editedTranscript);
  await dialog.getByRole("button", { name: "Save & Apply" }).click();
  await dialog.waitFor({ state: "hidden" });
  await desktopNav.getByRole("button", { name: "Studio" }).click();
  await page.getByText(editedTranscript, { exact: false }).waitFor();
  await page.getByLabel("Text to Synthesize").fill("Hello world.");

  const generate = page.getByRole("button", { name: "Generate Speech" });
  const prepare = "**/api/languages/*/prepare";
  let releasePrepare;
  const hold = new Promise((resolve) => { releasePrepare = resolve; });
  const holdPrepare = async (route) => {
    await hold;
    try {
      await route.abort();
    } catch (error) {
      if (!String(error).includes("Route is already handled")) throw error;
    }
  };
  await page.route(prepare, holdPrepare);
  try {
    await Promise.all([page.waitForRequest(prepare), generate.click()]);
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    assert.equal(await generate.isEnabled(), true);
  } finally {
    releasePrepare();
    await page.unroute(prepare, holdPrepare);
  }

  await generate.click();
  const output = page.getByRole("link", { name: "Download Ogg" });
  const generationError = page.locator(".studio-error");
  await output.or(generationError).waitFor({ timeout: 240_000 });
  if (await generationError.isVisible()) assert.fail(await generationError.innerText());
  await verifyOggOpus(output);
  const historyAudio = await audioBytes(output);
  const format = page.getByRole("combobox", { name: "Audio format" });
  assert.equal(await format.inputValue(), "ogg");
  await format.selectOption("opus");
  assert.deepEqual(await audioBytes(page.locator('.studio-output a[download$=".opus"]')), historyAudio);
  await format.selectOption("wav");
  const wav = Buffer.from(await audioBytes(page.getByRole("link", { name: "Download WAV" })));
  assert.match(wav.toString("ascii", 0, 12), /^RIFF....WAVE$/s);
  for (const [extension, signature] of [["mp3", "ID3"], ["flac", "fLaC"]]) {
    await format.selectOption(extension);
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Download", exact: true }).click(),
    ]);
    assert.ok(download.suggestedFilename().endsWith(`.${extension}`));
    const bytes = await readFile(await download.path());
    assert.equal(bytes.toString("ascii", 0, signature.length), signature);
  }
  await desktopNav.getByRole("button", { name: "History (1)" }).waitFor();

  await page.reload();
  await desktopNav.getByRole("button", { name: "History (1)" }).click();
  await page.getByRole("button", { name: "Play clip" }).click();
  await page.getByRole("button", { name: "Stop clip" }).waitFor();
  await page.getByLabel("Clip actions").click();
  await page.getByRole("button", { name: "Clip details" }).click();
  const clipDetails = page.getByRole("dialog", { name: "Clip details" });
  await verifyOggOpus(clipDetails.getByRole("link", { name: "Download Ogg" }));
  await clipDetails.getByRole("button", { name: "Close modal" }).click();
  await page.getByRole("button", { name: "Reuse" }).click();
  assert.equal(await page.getByLabel("Text to Synthesize").inputValue(), "Hello world.");
  await page.getByText("reference.wav", { exact: true }).waitFor();

  await page.setViewportSize({ width: 390, height: 844 });
  const mobileNav = page.getByRole("navigation", { name: "Mobile navigation" });
  await mobileNav.getByRole("button", { name: "Voices" }).click();
  await page.getByText(editedTranscript, { exact: true }).waitFor();
  await page.getByLabel("Voice actions").click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  const deleteVoice = page.getByRole("dialog", { name: "Delete voice?" });
  await deleteVoice.getByText(/reference\.wav/).waitFor();
  await page.waitForFunction(() => document.activeElement?.textContent?.trim() === "Cancel");
  await page.keyboard.press("Enter");
  await deleteVoice.waitFor({ state: "hidden" });
  await page.getByText(editedTranscript, { exact: true }).waitFor();
  await page.getByLabel("Voice actions").click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await deleteVoice.getByRole("button", { name: "Delete" }).click();
  await page.getByText(/No saved voices yet/).waitFor();
  await mobileNav.getByRole("button", { name: "History" }).click();
  await page.getByRole("button", { name: "Reuse" }).click();
  await page.getByText(/Reattach the original recording/).waitFor();
  assert.equal(await page.getByRole("button", { name: "Generate Speech" }).isDisabled(), true);
  await page.getByRole("button", { name: "Reattach voice", exact: true }).click();
  await page.getByRole("dialog", { name: "Reattach voice" }).getByRole("button", { name: "Cancel" }).click();

  await mobileNav.getByRole("button", { name: "Voices" }).click();
  await addVoice.click();
  const opusUpload = page.getByRole("dialog");
  await opusUpload.locator('input[type="file"]').setInputFiles({
    name: "reference.opus", mimeType: "application/octet-stream", buffer: Buffer.from(voiceAudio),
  });
  await opusUpload.getByRole("button", { name: "Save & Apply" }).click();
  await opusUpload.waitFor({ state: "hidden" });
  await page.getByText("reference.opus", { exact: true }).waitFor();
  await page.getByLabel("Voice actions").click();
  const opusDownload = page.getByRole("link", { name: "Download Ogg" });
  await verifyOggOpus(opusDownload);
  assert.deepEqual(await audioBytes(opusDownload), voiceAudio, "Uploaded Opus should be saved byte-for-byte.");

  await mobileNav.getByRole("button", { name: "Generate" }).click();
  await page.getByRole("button", { name: "Clear", exact: true }).click();
  await page.getByLabel("Text to Synthesize").fill([
    "This morning I took the slow train through the valley and watched the clouds move across the fields.",
    "We stopped near a little café, where I bought a cup of coffee and sat by the window.",
    "Later, I met a friend at the library and we talked about the books we had read that week.",
    "By the time I got home, the sun was setting and all the lights were coming on along the street.",
  ].join(" "));
  await generate.click();
  await output.or(generationError).waitFor({ timeout: 240_000 });
  if (await generationError.isVisible()) assert.fail(await generationError.innerText());
  assert.ok(await verifyOggOpus(output) > 16, "Long speech should exceed the old 16-second cap.");

  await verifyLibraryPagination(browser, origin, historyAudio, voiceAudio);
  assert.deepEqual(pageErrors, []);
  console.log("Browser smoke passed for generation, voice reuse, library pagination, search, and audio migration.");
} finally {
  try {
    await browser?.close();
  } finally {
    await server.close();
  }
}
