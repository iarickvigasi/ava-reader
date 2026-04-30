import { FeedbackForm } from "./feedback-form";

export function FeedbackSection() {
  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-8 sm:gap-10">
      <div className="space-y-3 text-center">
        <p className="text-[0.8rem] font-bold uppercase tracking-[0.2em] text-muted sm:text-xs sm:tracking-[0.24em]">
          Continuous Evolution
        </p>
        <h2 className="font-display text-[2rem] leading-[1.15] tracking-[-0.03em] text-ink sm:text-5xl">
          Tell what you&apos;d like us to improve or fix
        </h2>
      </div>
      <FeedbackForm />
    </section>
  );
}
