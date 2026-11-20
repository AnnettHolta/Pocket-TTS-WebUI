import { render } from "@solidjs/web";
import { afterEach, describe, expect, it, vi } from "vitest";
import Badge from "./Badge";

describe("Badge", () => {
  let dispose: (() => void) | undefined;

  afterEach(() => {
    dispose?.();
    document.body.innerHTML = "";
  });

  it("renders a span with tone and dot when not clickable", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    dispose = render(
      () => (
        <Badge tone="ok" dot>
          WebGPU Ready
        </Badge>
      ),
      host
    );

    const el = host.querySelector(".badge.ok");
    expect(el?.tagName).toBe("SPAN");
    expect(el?.textContent).toContain("WebGPU Ready");
    expect(el?.querySelector(".badge-dot")).not.toBeNull();
  });

  it("renders a clickable button when onClick is provided", () => {
    const onClick = vi.fn();
    const host = document.createElement("div");
    document.body.appendChild(host);
    dispose = render(
      () => (
        <Badge tone="warn" onClick={onClick}>
          CPU Ready
        </Badge>
      ),
      host
    );

    const btn = host.querySelector("button.badge.warn") as HTMLButtonElement | null;
    expect(btn).not.toBeNull();
    btn?.click();
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

