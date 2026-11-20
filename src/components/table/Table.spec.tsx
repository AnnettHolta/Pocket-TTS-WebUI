import { flush } from "solid-js";
import { render } from "@solidjs/web";
import { afterEach, describe, expect, it } from "vitest";
import Table from "./Table";

describe("Table", () => {
  let dispose: (() => void) | undefined;

  afterEach(() => {
    dispose?.();
    document.body.innerHTML = "";
  });

  it("renders title, default 10-row page size, and paginates items", () => {
    const items = Array.from({ length: 15 }, (_, i) => ({ id: i + 1, name: `Row ${i + 1}` }));
    const host = document.createElement("div");
    document.body.appendChild(host);

    dispose = render(
      () => (
        <Table
          title="Sample Table"
          columns={[{ key: "name", label: "Name" }]}
          items={items}
          renderRow={(item) => <td>{item.name}</td>}
        />
      ),
      host
    );

    expect(host.querySelector(".table-title")?.textContent).toBe("Sample Table");
    expect(host.querySelectorAll("tbody tr")).toHaveLength(10);

    const select = host.querySelector("#table-page-size") as HTMLSelectElement;
    select.value = "25";
    select.dispatchEvent(new Event("change", { bubbles: true }));
    flush();
    expect(host.querySelectorAll("tbody tr")).toHaveLength(15);
  });

  it("renders emptyMessage when items are empty", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);

    dispose = render(
      () => (
        <Table
          title="Empty Table"
          columns={[{ key: "name", label: "Name" }]}
          items={[]}
          emptyMessage="Nothing here yet."
          renderRow={() => <td />}
        />
      ),
      host
    );

    expect(host.querySelector(".table-empty")?.textContent).toBe("Nothing here yet.");
  });
});
