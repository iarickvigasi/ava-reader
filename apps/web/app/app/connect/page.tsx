import { ConnectProfileSection } from "@/components/app/connect/connect-profile-section";
import { ConnectIntroduction } from "@/components/app/connect/connect-introduction";
import { ScreenContainer } from "@/components/ui/screen-container";

export const dynamic = "force-dynamic";

export default function ConnectPage() {
  return (
    <ScreenContainer className="gap-10 py-10 sm:gap-16 sm:py-16">
      <ConnectIntroduction />
      <ConnectProfileSection />
    </ScreenContainer>
  );
}
