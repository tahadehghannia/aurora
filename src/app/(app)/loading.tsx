import { ContentRowSkeleton } from "@/components/content/content-row";

export default function AppLoading() {
  return (
    <div className="flex flex-col gap-10 px-4 py-8 sm:px-8">
      <ContentRowSkeleton count={6} />
      <ContentRowSkeleton count={6} />
      <ContentRowSkeleton count={6} />
    </div>
  );
}
