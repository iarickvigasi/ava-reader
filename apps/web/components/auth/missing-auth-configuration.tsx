import { AuthShell } from "@/components/auth/auth-shell";
import { ButtonLink } from "@/components/ui/button";

export function MissingAuthConfiguration() {
  return (
    <AuthShell
      title="Auth not configured"
      subtitle="Add your Clerk environment variables to turn on the custom sign-in and sign-up flows."
      footer={<ButtonLink href="/">Return to splash</ButtonLink>}
    >
      <div className="rounded-[var(--radius-card)] border border-line bg-white/68 p-5 text-left shadow-[var(--shadow-card)]">
        <p className="text-sm uppercase tracking-[0.22em] text-muted">
          Required web variables
        </p>
        <pre className="mt-4 overflow-x-auto rounded-2xl bg-paper px-4 py-4 text-sm text-copy">
          {`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=\nCLERK_SECRET_KEY=\nNEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in\nNEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up`}
        </pre>
      </div>
    </AuthShell>
  );
}
