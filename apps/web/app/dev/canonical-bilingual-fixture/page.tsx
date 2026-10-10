import { notFound } from "next/navigation";
import { BilingualFixture } from "./reader-fixture";
export default function Page() {
  if (process.env.NODE_ENV === "production") notFound();
  return <BilingualFixture />;
}
