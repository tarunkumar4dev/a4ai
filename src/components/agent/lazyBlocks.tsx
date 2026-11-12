// The two heavy blocks load on first use: the chart pulls in recharts, the paper pulls in KaTeX.
// An attendance-only chat never downloads either.
import { Suspense, lazy, type ComponentProps } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import type { AgentChart as ChartT } from "./AgentChart";
import type { PaperPreview as PaperT } from "./PaperPreview";

const Chart = lazy(() => import("./AgentChart").then((m) => ({ default: m.AgentChart })));
const Paper = lazy(() => import("./PaperPreview").then((m) => ({ default: m.PaperPreview })));

export function LazyChart(props: ComponentProps<typeof ChartT>) {
  return <Suspense fallback={<Skeleton className="h-72 w-full rounded-lg" />}><Chart {...props} /></Suspense>;
}
export function LazyPaper(props: ComponentProps<typeof PaperT>) {
  return <Suspense fallback={<Skeleton className="h-96 w-full rounded-lg" />}><Paper {...props} /></Suspense>;
}
