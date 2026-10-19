import { notFound } from "next/navigation";
import { PdfImportFixture } from "./pdf-import-fixture";
export default function Page() {
  if (process.env.NODE_ENV === "production") notFound();
  return <PdfImportFixture />;
}
