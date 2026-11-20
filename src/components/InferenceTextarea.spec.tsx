import { render } from "@solidjs/web";
import { afterEach, describe, expect, it, vi } from "vitest";
import InferenceTextarea from "./InferenceTextarea";

describe("InferenceTextarea", () => {
  let dispose: (() => void) | undefined;

  afterEach(() => {
    dispose?.();
    document.body.innerHTML = "";
  });

  it("displays character count and clears text on clear click", () => {
    const onInput = vi.fn();
    const host = document.createElement("div");
    document.body.appendChild(host);
    dispose = render(
      () => (
        <InferenceTextarea
          value="Hello world"
          onInput={onInput}
          footer={<button class="footer-btn">Go</button>}
        />
      ),
      host
    );

    expect(host.textContent).toContain("11 / 2,000");
    expect(host.querySelector(".footer-btn")).not.toBeNull();

    const clearBtn = host.querySelector(".textarea-clear") as HTMLButtonElement;
    clearBtn.click();
    expect(onInput).toHaveBeenCalledWith("");
  });
});

