import { Suspense } from "react";
import { FeedingView } from "./feeding-view";

export const metadata = { title: "Feeding" };

export default function FeedingPage() {
  return (
    <Suspense fallback={<div className="skeleton h-80" />}>
      <FeedingView />
    </Suspense>
  );
}
