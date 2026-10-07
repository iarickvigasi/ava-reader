"use client";

import {
  createContext, useCallback, useContext, useLayoutEffect, useRef, type ReactNode,
} from "react";
import type { ReaderPanel } from "@/components/app/core/reader-ui-context";
import { readerPanelControl, readerPanelId } from "@/features/reader/panel-id";
import { openReaderPanelDialog } from "./panel-dialog-lifecycle";
import { ReaderPanelTitleContext } from "./panel-title-context";

type Actions = { dismiss: () => void; navigate: (action: () => void) => void };
const ActionsContext = createContext<Actions | null>(null);

export function useReaderPanelActions() {
  const actions = useContext(ActionsContext);
  if (!actions) throw new Error("Reader panel actions require a dialog");
  return actions;
}

export function ReaderPanelDialog({
  panel,
  onClose,
  children,
}: {
  panel: ReaderPanel;
  onClose: () => void;
  children: ReactNode;
}) {
  const titleId = `${readerPanelId(panel)}-title`;
  const ref = useRef<HTMLDialogElement>(null);
  const close = useRef(onClose);
  useLayoutEffect(() => {
    close.current = onClose;
  }, [onClose]);
  const controller = useRef<ReturnType<typeof openReaderPanelDialog> | null>(null);
  useLayoutEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const current = openReaderPanelDialog(dialog, readerPanelControl(panel), () => close.current());
    controller.current = current;
    return () => {
      controller.current = null;
      current.dispose();
    };
  }, [panel]);
  const dismiss = useCallback(() => controller.current?.dismiss(), []);
  const navigate = useCallback(
    (action: () => void) => controller.current?.navigate(action), [],
  );
  return (
    <dialog
      ref={ref}
      id={readerPanelId(panel)}
      data-reader-modal
      aria-modal="true"
      aria-labelledby={titleId}
      className="reader-panel-dialog"
      onCancel={(event) => {
        event.preventDefault();
        dismiss();
      }}
    >
      <ReaderPanelTitleContext value={titleId}>
        <ActionsContext value={{ dismiss, navigate }}>{children}</ActionsContext>
      </ReaderPanelTitleContext>
    </dialog>
  );
}
