import { render } from "@solidjs/web";
import { afterEach, describe, expect, it, vi } from "vitest";
import InferenceSettings from "./InferenceSettings";

describe("InferenceSettings", () => {
  let dispose: (() => void) | undefined;

  afterEach(() => {
    dispose?.();
    document.body.innerHTML = "";
  });

  it("renders language options, quantization, and temperature", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    dispose = render(
      () => (
        <InferenceSettings
          languages={[
            { id: "english_2026-10", label: "English (2026-10)", cached: true },
            { id: "french_24l", label: "French (24L)", cached: false },
          ]}
          selectedLang="english_2026-10"
          onSelectLang={vi.fn()}
          precision="mixed"
          onSelectPrecision={vi.fn()}
          temperature={0.35}
          onChangeTemperature={vi.fn()}
        />
      ),
      host
    );

    const options = host.querySelectorAll("#language option");
    expect(options).toHaveLength(2);
    expect(host.querySelector(".pill-value")?.textContent).toBe("0.35");
  });

  it("updates temperature when clicking a preset button", () => {
    const onChangeTemperature = vi.fn();
    const host = document.createElement("div");
    document.body.appendChild(host);
    dispose = render(
      () => (
        <InferenceSettings
          languages={[{ id: "english_2026-10", label: "English", cached: false }]}
          selectedLang="english_2026-10"
          onSelectLang={vi.fn()}
          precision="mixed"
          onSelectPrecision={vi.fn()}
          temperature={0.35}
          onChangeTemperature={onChangeTemperature}
        />
      ),
      host
    );

    const presetBtns = host.querySelectorAll(".temp-preset-btn");
    (presetBtns[2] as HTMLButtonElement).click(); // Expressive (0.65)
    expect(onChangeTemperature).toHaveBeenCalledWith(0.65);
  });
});

