import { ConnectIntroduction } from "@/components/app/connect/connect-introduction";
import { ScreenContainer } from "@/components/ui/screen-container";

export const dynamic = "force-dynamic";

export default function ConnectPage() {
  return (
    <ScreenContainer className="py-10 sm:py-16">
      <ConnectIntroduction />
    </ScreenContainer>
  );
}
