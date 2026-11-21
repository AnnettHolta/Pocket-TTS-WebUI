import { createEffect, Show } from "solid-js";
import type { JSX } from "@solidjs/web";
import { TbOutlineX } from "solid-icons/tb";
import "./Modal.css";

export interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  busy?: boolean;
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
      onCancel={(event) => {
        if (props.busy) event.preventDefault();
      }}
      onClose={() => {
        if (props.open) props.onClose();
      }}
      onClick={(e) => {
        if (e.target === dialogRef && !props.busy) {
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
            disabled={props.busy}
            onClick={() => props.onClose()}
            aria-label="Close modal"
          >
            <TbOutlineX size={16} />
          </button>
        </div>
        {props.children}
      </Show>
    </dialog>
  );
}
