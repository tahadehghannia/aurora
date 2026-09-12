import { LibraryTabs } from "@/components/library/library-tabs";

export default function LibraryLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-6 px-4 py-6 sm:px-8">
      <div>
        <h1 className="text-h4 font-semibold">Library</h1>
        <p className="text-body-sm text-muted-foreground">Everything you&apos;ve saved, rated and collected.</p>
      </div>
      <LibraryTabs />
      {children}
    </div>
  );
}
