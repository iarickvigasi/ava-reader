import Link from "next/link";

export function DashboardFooter() {
  return (
    <footer className="border-t border-line/40 pt-8 text-[0.62rem] uppercase tracking-[0.22em] text-muted sm:text-xs">
      <div className="flex flex-col items-center gap-5 text-center sm:flex-row sm:items-center sm:justify-between sm:text-left">
        <p>© AVA Reader • Designed for immersive reading • 2026</p>
        <div className="flex gap-6">
          <Link href="">Privacy</Link>
          <Link href="">Terms</Link>
          <Link href="">Contact</Link>
        </div>
      </div>
    </footer>
  );
}
