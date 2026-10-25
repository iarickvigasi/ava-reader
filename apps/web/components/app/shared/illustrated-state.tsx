import type { ReactNode } from "react";

export function IllustratedState({
  icon,
  message,
  action,
  role = "status",
}: {
  icon: ReactNode;
  message: string;
  action?: ReactNode;
  role?: "status" | "alert";
}) {
  return (
    <div
      role={role}
      className="flex flex-col items-center rounded-card bg-paper px-6 py-10 text-center sm:px-10 sm:py-14"
    >
      <span
        aria-hidden="true"
        className="flex size-14 items-center justify-center rounded-full bg-soft-fill text-ink"
      >
        {icon}
      </span>
      <p className="mt-6 max-w-xl font-display text-2xl text-title sm:text-3xl">
        {message}
      </p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
