import { render } from "@solidjs/web";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import Modal from "./Modal";

describe("Modal", () => {
  let dispose: (() => void) | undefined;

  beforeAll(() => {
    HTMLDialogElement.prototype.showModal ??= function () {
      this.setAttribute("open", "");
    };
    HTMLDialogElement.prototype.close ??= function () {
      this.removeAttribute("open");
    };
  });

  afterEach(() => {
    dispose?.();
    document.body.innerHTML = "";
  });

  it("renders title and children when open", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    dispose = render(
      () => (
        <Modal open={true} heading="Test Dialog" onClose={vi.fn()}>
          <p class="body-copy">Projected content</p>
        </Modal>
      ),
      host
    );

    expect(host.querySelector(".modal-title")?.textContent).toBe("Test Dialog");
    expect(host.querySelector(".body-copy")?.textContent).toBe("Projected content");
  });

  it("calls onClose when clicking the close button", () => {
    const onClose = vi.fn();
    const host = document.createElement("div");
    document.body.appendChild(host);
    dispose = render(
      () => (
        <Modal open={true} heading="Closable" onClose={onClose}>
          <span>Body</span>
        </Modal>
      ),
      host
    );

    const closeBtn = host.querySelector('button[aria-label="Close modal"]') as HTMLButtonElement;
    closeBtn.click();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

