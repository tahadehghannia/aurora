"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/** True once mounted on the client — avoids hydration mismatches for client-only UI (e.g. theme). */
export function useIsClient() {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  );
}
