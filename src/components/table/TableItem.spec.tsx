import { render } from "@solidjs/web";
import { afterEach, describe, expect, it } from "vitest";
import TableItem from "./TableItem";

describe("TableItem", () => {
  let dispose: (() => void) | undefined;

  afterEach(() => {
    dispose?.();
    document.body.innerHTML = "";
  });

  it("renders a tr.table-item wrapping cell children", () => {
    const table = document.createElement("table");
    const tbody = document.createElement("tbody");
    table.appendChild(tbody);
    document.body.appendChild(table);

    dispose = render(
      () => (
        <TableItem>
          <td>Cell A</td>
          <td class="align-right">Cell B</td>
        </TableItem>
      ),
      tbody
    );

    const row = tbody.querySelector("tr.table-item");
    expect(row).not.toBeNull();
    expect(row?.querySelectorAll("td")).toHaveLength(2);
  });
});

