import assert from "node:assert/strict";
import { chromium } from "playwright";
import { preview } from "vite";

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

async function verifyOgg(link, codec) {
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
  assert.ok(header.includes(codec));
  assert.ok(duration > 0 && peak > 0.001, "The clip should decode to audible audio.");
}

const server = await preview({ preview: { host: "127.0.0.1", port: 0 } });
let browser;
try {
  browser = await chromium.launch({ channel: process.env.POCKETTTS_BROWSER_CHANNEL || undefined });
  const page = await browser.newPage({ locale: "en-US" });
  page.setDefaultTimeout(10_000);
  const address = server.httpServer.address();
  assert.ok(address && typeof address !== "string");
  await page.goto(`http://127.0.0.1:${address.port}/`);

  const desktopNav = page.getByRole("navigation", { name: "Views" });
  await desktopNav.getByRole("button", { name: "Voices" }).click();
  await page.getByRole("button", { name: "Add voice" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.locator('input[type="file"]').setInputFiles(referenceTone());
  await dialog.getByLabel("Transcript notes").fill("Browser smoke test reference");
  await dialog.getByRole("button", { name: "Save & Apply" }).click();
  await dialog.waitFor({ state: "hidden", timeout: 120_000 });
  await verifyOgg(page.getByRole("link", { name: "Download Ogg" }), "vorbis");
  await page.getByRole("button", { name: "Use in Studio" }).click();
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
  await output.waitFor({ timeout: 240_000 });
  await verifyOgg(output, "OpusHead");
  await desktopNav.getByRole("button", { name: "History (1)" }).waitFor();

  await page.reload();
  await desktopNav.getByRole("button", { name: "History (1)" }).click();
  await verifyOgg(page.getByRole("link", { name: "Download Ogg" }), "OpusHead");
  await page.getByRole("button", { name: "Reuse" }).click();
  assert.equal(await page.getByLabel("Text to Synthesize").inputValue(), "Hello world.");
  await page.getByText("reference.wav", { exact: true }).waitFor();

  await page.setViewportSize({ width: 390, height: 844 });
  const mobileNav = page.getByRole("navigation", { name: "Mobile navigation" });
  await mobileNav.getByRole("button", { name: "Voices" }).click();
  await page.getByText("Browser smoke test reference", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await page.getByText(/No saved voices yet/).waitFor();
  await mobileNav.getByRole("button", { name: "History" }).click();
  await page.getByRole("button", { name: "Reuse" }).click();
  await page.getByText(/Reattach the original recording/).waitFor();
  assert.equal(await page.getByRole("button", { name: "Generate Speech" }).isDisabled(), true);
  console.log("Browser smoke passed for generation, history, and desktop and mobile voice reuse.");
} finally {
  try {
    await browser?.close();
  } finally {
    await server.close();
  }
}
