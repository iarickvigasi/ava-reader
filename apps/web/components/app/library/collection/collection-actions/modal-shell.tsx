import type { ReactNode } from "react";

type ModalShellProps = {
  children: ReactNode;
  onClose: () => void;
};

export function ModalShell({ children, onClose }: ModalShellProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <button
        aria-label="Close modal"
        className="absolute inset-0 bg-ink/40 backdrop-blur-sm"
        type="button"
        onClick={onClose}
      />
      {children}
    </div>
  );
}
