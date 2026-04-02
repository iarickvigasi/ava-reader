import { auth } from "@clerk/nextjs/server";
import { AppBootstrapPanel } from "@/components/app/app-bootstrap-panel";
import { MissingAuthConfiguration } from "@/components/auth/missing-auth-configuration";
import { BrandSigilDivider } from "@/components/brand/brand-sigil-divider";
import { BrandWordmark } from "@/components/brand/brand-wordmark";
import { ScreenContainer } from "@/components/ui/screen-container";

export default async function AppPage() {
  if (
    !process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ||
    !process.env.CLERK_SECRET_KEY
  ) {
    return <MissingAuthConfiguration />;
  }

  const authState = await auth();

  if (!authState.userId) {
    authState.redirectToSignIn({ returnBackUrl: "/app" });
  }

  return (
    <ScreenContainer className="justify-center py-14 sm:py-18">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
        <div className="flex flex-col items-center gap-5 text-center">
          <BrandWordmark variant="stacked" />
          <p className="max-w-lg text-lg text-copy sm:text-xl">
            Your authenticated shell is live. The web app now boots from Clerk
            and reads its current user from the Nest API.
          </p>
          <BrandSigilDivider />
        </div>

        <AppBootstrapPanel />
      </div>
    </ScreenContainer>
  );
}
