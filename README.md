# PocketTTS WebUI

Generate speech in your browser with PocketTTS. Pick a language and a voice, type a short passage, and download the result as an Ogg file.

## Get started

Install Node.js 24 and pnpm. From this project folder, run:

```sh
pnpm install
pnpm dev
```

Open the localhost address printed in the terminal in a recent desktop version of Chrome, Edge, or Firefox. Leave the terminal running while you use the app. On Windows, use `pnpm.cmd` if PowerShell blocks `pnpm`.

## Generate your first clip

1. In **Studio**, keep the default English model and mixed precision.
2. Leave the sample text in place and click **Generate Speech**. The first run downloads model weights from Hugging Face and can take a few minutes. The local server reuses those files on subsequent runs.
3. Play the result or click **Download Ogg**. Open **History** to play or download an earlier result, or reuse its settings in Studio.

Keep passages short. If generation reaches the model's output limit, split the passage and generate the sections separately. If the speech worker stops, retry generation. The app can run on CPU through WASM when GPU acceleration is unavailable.

## Use a reference voice

In **Voices**, add a short, clear recording you have permission to use. WAV and FLAC are good starting formats. Add transcript notes to identify what the speaker said, then save it. Select **Use in Studio** to generate with that recording. You can also add a recording directly from Studio.

The browser saves new reference voices and generated speech as Ogg Opus. Previously saved Ogg Vorbis voices remain playable. Transcript notes are for your library. When you reuse an old generation whose reference is missing, reattach the original recording or clear the reference to generate with the default voice.

History and saved voices belong to this browser profile and site address. Clearing site data removes them. Download anything you want to keep. Older history entries can still restore their settings, and their audio is available only if it was saved.

The app processes your text and recordings on your device. Internet access is needed to fetch models and runtime assets on first use. Audio encoding runs locally.

## Licenses

- The original PocketTTS WebUI source uses Apache License 2.0. [License text](LICENSE)
- Kyutai’s Pocket TTS source code uses MIT. [Kyutai’s license](https://github.com/kyutai-labs/pocket-tts/blob/main/LICENSE)
- The Pocket TTS model weights are © Kyutai and use CC BY 4.0. The app downloads stephvax’s ONNX conversions, which carry the same license. [Kyutai model card](https://huggingface.co/kyutai/pocket-tts) · [ONNX export attribution](https://huggingface.co/stephvax/pocket-tts-onnx#licence-and-attribution) · [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)
- The bundled FFmpeg WebAssembly core uses GPL-2.0-or-later. Distributions that include the core must meet the GPL’s notice and corresponding-source requirements. [Package license](https://github.com/ffmpegwasm/ffmpeg.wasm/blob/main/packages/core/package.json) · [GNU GPL distribution guidance](https://www.gnu.org/licenses/gpl-faq.en.html#DistributeWithSource)
