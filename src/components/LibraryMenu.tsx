import { TbOutlineDots } from "solid-icons/tb";
import type { JSX } from "@solidjs/web";

export default function LibraryMenu(props: {
  label: string;
  trigger?: JSX.Element;
  children: (close: () => void) => JSX.Element;
}) {
  let menu: HTMLDetailsElement | undefined;
  const close = () => {
    if (menu) menu.open = false;
  };
  const closeAndFocus = () => {
    close();
    menu?.querySelector("summary")?.focus();
  };

  return (
    <details
      ref={menu}
      class="library-menu"
      onFocusOut={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) close();
      }}
      onKeyDown={(event) => {
        if (event.key !== "Escape" || !menu?.open) return;
        closeAndFocus();
      }}
    >
      <summary
        class={`btn ${props.trigger ? "btn-secondary library-menu-text" : "btn-ghost"}`}
        aria-label={props.label}
      >
        {props.trigger ?? <TbOutlineDots size={16} />}
      </summary>
      <div class="library-menu-panel">{props.children(closeAndFocus)}</div>
    </details>
  );
}
