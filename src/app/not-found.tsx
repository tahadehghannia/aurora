import Link from "next/link";
import { Compass } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-4 px-4 py-24 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
        <Compass size={26} />
      </div>
      <h1 className="text-h3 font-bold">Page not found</h1>
      <p className="max-w-sm text-body-md text-muted-foreground">
        We couldn&apos;t find what you were looking for. It may have been moved or doesn&apos;t exist.
      </p>
      <Button render={<Link href="/home" />}>Back to Home</Button>
    </div>
  );
}
