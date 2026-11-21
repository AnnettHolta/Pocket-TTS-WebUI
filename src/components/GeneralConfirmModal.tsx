import { createUniqueId } from "solid-js";
import { t } from "../i18n";
import Modal from "./Modal";
import "./GeneralConfirmModal.css";

export interface GeneralConfirmModalProps {
  open: boolean;
  heading: string;
  message: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
}

export default function GeneralConfirmModal(props: GeneralConfirmModalProps) {
  const descriptionId = createUniqueId();

  return (
    <Modal open={props.open} heading={props.heading} descriptionId={descriptionId} onClose={props.onCancel}>
      <p id={descriptionId} class="confirm-message">{props.message} {t("confirm.irreversible")}</p>
      <div class="confirm-actions">
        <button type="button" class="btn btn-secondary btn-sm" autofocus onClick={props.onCancel}>
          {t("refVoice.cancel")}
        </button>
        <button type="button" class="btn btn-ghost btn-sm confirm-destructive" onClick={props.onConfirm}>
          {props.confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
