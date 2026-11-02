import { Suspense } from "react";
import { GrowthView } from "./growth-view";

export const metadata = { title: "Growth" };

export default function GrowthPage() {
  return (
    <Suspense fallback={<div className="skeleton h-80" />}>
      <GrowthView />
    </Suspense>
  );
}
