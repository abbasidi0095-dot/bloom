import { Suspense } from "react";
import { SleepView } from "./sleep-view";

export const metadata = { title: "Sleep" };

export default function SleepPage() {
  return (
    <Suspense fallback={<div className="skeleton h-80" />}>
      <SleepView />
    </Suspense>
  );
}
