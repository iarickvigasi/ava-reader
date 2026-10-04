"use client";

import type { FormEvent } from "react";
import { READER_BUILD_FINGERPRINT } from "@/features/reader/canonical/build";
import { actions, useOperatorChannel } from "./use-operator-channel";

const fields = [
  ["Library item ID", "libraryItemId"],
  ["Final content ID", "finalContentId"],
  ["Exact target JSON", "target"],
  ["Optional stale entry scope JSON", "entryScope"],
] as const;
export function OperatorControls() {
  const { local, receipts, send } = useOperatorChannel();
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const button = (event.nativeEvent as SubmitEvent).submitter;
    const action =
      button instanceof HTMLButtonElement ? button.value : "snapshot";
    if (actions.includes(action as (typeof actions)[number]))
      send(
        action as (typeof actions)[number],
        Object.fromEntries(new FormData(event.currentTarget)),
      );
  }
  return (
    <main className="h-full overflow-auto bg-paper p-8 text-copy">
      <h1 className="text-xl font-semibold">Reader QA operator controls</h1>
      <p className="my-4">
        Local TEST build only. Open the normally imported reader in another tab.
        Get a snapshot first, then arm and verify its acknowledgement before
        using the real reader controls. Refresh the snapshot after reopening the
        reader.
      </p>
      <p>
        Reader fingerprint: <code>{READER_BUILD_FINGERPRINT}</code>
      </p>
      {!local && <p role="alert">This operator page requires localhost.</p>}
      <form onSubmit={submit}>
        <div className="my-6 grid max-w-3xl gap-4">
          {fields.map(([label, name]) => (
            <label key={name}>
              {label}
              <input
                name={name}
                required={name === "libraryItemId" || name === "finalContentId"}
                className="block w-full bg-surface p-2"
              />
            </label>
          ))}
          <label>
            Fault stage
            <select name="stage" className="block bg-surface p-2">
              <option value="navigate">navigate</option>
              <option value="restore">restore</option>
            </select>
          </label>
        </div>
        <div className="flex flex-wrap gap-3">
          {actions.map((action) => (
            <button
              type="submit"
              name="action"
              value={action}
              className="rounded-control bg-brand px-4 py-2 text-white disabled:opacity-50"
              key={action}
              disabled={!local}
            >
              {action}
            </button>
          ))}
        </div>
      </form>
      <h2 className="mt-6 text-lg">Acknowledgements and commands</h2>
      <pre className="mt-4 whitespace-pre-wrap break-words text-xs">
        {JSON.stringify(receipts, null, 2)}
      </pre>
    </main>
  );
}
