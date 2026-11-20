import { createEffect, Show } from "solid-js";
import type { JSX } from "@solidjs/web";
import "./Modal.css";

export interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: JSX.Element;
}

export default function Modal(props: ModalProps) {
  let dialogRef: HTMLDialogElement | undefined;

  createEffect(
    () => props.open,
    (isOpen) => {
      if (!dialogRef) return;
      if (isOpen && !dialogRef.open) {
        dialogRef.showModal();
      } else if (!isOpen && dialogRef.open) {
        dialogRef.close();
      }
    }
  );

  return (
    <dialog
      ref={dialogRef}
      class="modal-dialog"
      aria-label={props.title}
      onClose={() => {
        if (props.open) props.onClose();
      }}
      onClick={(e) => {
        if (e.target === dialogRef) {
          props.onClose();
        }
      }}
    >
      <Show when={props.open}>
        <div class="modal-header">
          <h3 class="modal-title">{props.title}</h3>
          <button
            type="button"
            class="btn btn-ghost btn-sm"
            onClick={() => props.onClose()}
            aria-label="Close modal"
          >
            ×
          </button>
        </div>
        {props.children}
      </Show>
    </dialog>
  );
}
