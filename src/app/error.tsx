"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-4 px-4 py-24 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-error/10 text-error">
        <AlertTriangle size={26} />
      </div>
      <h1 className="text-h3 font-bold">Something went wrong</h1>
      <p className="max-w-sm text-body-md text-muted-foreground">
        An unexpected error occurred. You can try again, or head back to your homepage.
      </p>
      <Button onClick={() => reset()}>Try again</Button>
    </div>
  );
}
