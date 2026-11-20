import type { JSX } from "@solidjs/web";
import "./Badge.css";

export type BadgeTone = "default" | "ok" | "warn";

export interface BadgeProps {
  tone?: BadgeTone;
  dot?: boolean;
  children: JSX.Element;
}

export default function Badge(props: BadgeProps) {
  const toneClass = () => {
    if (props.tone === "ok") return "badge ok";
    if (props.tone === "warn") return "badge warn";
    return "badge";
  };

  return (
    <span class={toneClass()}>
      {props.dot ? <span class="badge-dot" /> : null}
      {props.children}
    </span>
  );
}
