import { Show } from "solid-js";
import type { JSX } from "@solidjs/web";
import "./Badge.css";

export type BadgeTone = "default" | "ok" | "warn";

export interface BadgeProps {
  tone?: BadgeTone;
  dot?: boolean;
  onClick?: () => void;
  ariaLabel?: string;
  children: JSX.Element;
}

export default function Badge(props: BadgeProps) {
  const toneClass = () => {
    if (props.tone === "ok") return "badge ok";
    if (props.tone === "warn") return "badge warn";
    return "badge";
  };

  return (
    <Show
      when={props.onClick}
      fallback={
        <span class={toneClass()} aria-label={props.ariaLabel}>
          {props.dot ? <span class="badge-dot" /> : null}
          {props.children}
        </span>
      }
    >
      {(onClick) => (
        <button
          type="button"
          class={toneClass()}
          aria-label={props.ariaLabel}
          onClick={() => onClick()()}
        >
          {props.dot ? <span class="badge-dot" /> : null}
          {props.children}
        </button>
      )}
    </Show>
  );
}
