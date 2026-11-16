import { useSyncExternalStore } from "react";
import { pwaUpdates } from "../lib/pwaClient.js";

export function usePwaUpdates() {
  return { ...useSyncExternalStore(pwaUpdates.subscribe, pwaUpdates.getSnapshot),
    check: pwaUpdates.check, install: pwaUpdates.install, dismiss: pwaUpdates.dismiss };
}
