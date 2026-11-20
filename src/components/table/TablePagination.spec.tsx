import { render } from "@solidjs/web";
import { afterEach, describe, expect, it, vi } from "vitest";
import TablePagination from "./TablePagination";

describe("TablePagination", () => {
  let dispose: (() => void) | undefined;

  afterEach(() => {
    dispose?.();
    document.body.innerHTML = "";
  });

  it("shows range and triggers page changes", () => {
    const onPageChange = vi.fn();
    const host = document.createElement("div");
    document.body.appendChild(host);

    dispose = render(
      () => (
        <TablePagination
          totalItems={25}
          page={2}
          pageSize={10}
          onPageChange={onPageChange}
        />
      ),
      host
    );

    expect(host.querySelector(".table-pagination-info")?.textContent).toContain("11–20");
    expect(host.querySelector(".table-pagination-info")?.textContent).toContain("25");

    const nextBtn = host.querySelector('button[aria-label="Next page"]') as HTMLButtonElement;
    nextBtn.click();
    expect(onPageChange).toHaveBeenCalledWith(3);
  });
});

