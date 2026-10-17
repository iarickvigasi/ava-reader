import { notFound } from "next/navigation";
import { ReviewFixture } from "./review-fixture";
export default function Page() {
  if (process.env.NODE_ENV === "production") notFound();
  return <ReviewFixture />;
}
