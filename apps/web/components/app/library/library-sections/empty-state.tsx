export function LibraryEmptyState() {
  return (
    <section className="rounded-[28px] bg-paper-strong/75 px-6 py-10 sm:px-8">
      <div className="max-w-2xl space-y-4">
        <p className="text-[0.78rem] font-semibold uppercase tracking-[0.18em] text-brand-fill">
          Library
        </p>
        <h1 className="font-display text-4xl leading-[1.02] text-title sm:text-5xl">
          Your collections will appear here as you build your reading world.
        </h1>
        <p className="text-lg leading-8 text-copy">
          Import books or add them from the public catalog and AVA will start
          organizing them into personal collections.
        </p>
      </div>
    </section>
  );
}
