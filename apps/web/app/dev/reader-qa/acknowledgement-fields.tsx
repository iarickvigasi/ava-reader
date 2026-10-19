import type { QaAck } from "@/features/reader/navigation-qa/protocol";

export function AcknowledgementFields({ receipts }: { receipts: unknown[] }) {
  const latest = [...receipts].reverse().find((value) =>
    value !== null && typeof value === "object" &&
    "type" in value && value.type === "ack",
  ) as QaAck | undefined;
  if (!latest) return <p>No acknowledgement received yet.</p>;
  const fields = [
    ["Scope", latest.scope],
    ["Command ID", latest.commandId],
    ["Phase", latest.phase],
    ["OK", latest.ok],
    ["Sequence", latest.sequence],
    ["Reason", latest.reason ?? null],
    ["Origin", latest.origin],
    ["History", latest.history],
    ["History scopes", latest.historyScopes],
    ["Loaded chapter IDs", latest.loadedChapterIds],
    ["Pending", latest.pending],
    ["Stage", latest.stage ?? null],
    ["Actual restore success", latest.actualRestoreSuccess ?? null],
  ] as const;
  return (
    <section aria-label="Latest acknowledgement" className="mt-6">
      <h2 className="text-lg">Latest acknowledgement</h2>
      <dl className="mt-3 grid gap-3 text-sm">
        {fields.map(([label, value]) => (
          <div key={label}>
            <dt className="font-semibold">{label}</dt>
            <dd className="whitespace-pre-wrap break-words font-mono">
              {JSON.stringify(value) ?? "Missing"}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
