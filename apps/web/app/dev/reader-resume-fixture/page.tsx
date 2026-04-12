import { ReaderScreen } from "@/components/app/reader/reader-screen";
import { createReaderResumeFixturePayload } from "@/lib/reader-test-fixture";

export default function ReaderResumeFixturePage() {
  return (
    <ReaderScreen
      initialPayload={createReaderResumeFixturePayload()}
      libraryItemId="reader-resume-fixture"
      persistenceMode="local-only"
    />
  );
}
