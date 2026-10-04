import { notFound } from "next/navigation";
import { READER_QA_ENABLED } from "@/features/reader/qa/build-config";
import { OperatorControls } from "./operator-controls";

export default function ReaderQaPage() {
  if (process.env.NEXT_PUBLIC_AVA_READER_QA !== "1" || !READER_QA_ENABLED)
    notFound();
  return <OperatorControls />;
}
