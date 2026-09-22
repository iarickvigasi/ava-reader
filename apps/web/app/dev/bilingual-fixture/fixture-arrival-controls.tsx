export function FixtureArrivalControls({
  arrivals,
  total,
  running,
  publishNext,
  runArrivals,
  removals,
  remounts,
}: {
  arrivals: number;
  total: number;
  running: boolean;
  publishNext: () => void;
  runArrivals: () => void;
  removals: number;
  remounts: number;
}) {
  return (
    <aside className="fixed right-1 top-1 z-60 rounded border border-line bg-paper px-2 py-1 text-xs">
      <div className="flex gap-3">
        <button
          type="button"
          onClick={publishNext}
          disabled={arrivals >= total}
        >
          Next translation
        </button>
        <button
          type="button"
          onClick={runArrivals}
          disabled={running || arrivals >= total}
        >
          {running ? "Arriving…" : "Run arrivals"}
        </button>
      </div>
      <output
        data-fixture-arrivals={arrivals}
        data-fixture-column-removals={removals}
        data-fixture-column-remounts={remounts}
      >
        {arrivals}/{total} sentences · {removals} column removals · {remounts}{" "}
        remounts
      </output>
    </aside>
  );
}
