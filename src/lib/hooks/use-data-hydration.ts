"use client";

import { useRef } from "react";
import { useData } from "@/lib/data-store";

type DataSlice = Parameters<ReturnType<typeof useData>["hydrate"]>[0];

/**
 * Seed the global DataProvider with server-fetched data on first mount.
 *
 * Runs synchronously during render so the seeded state is available on the
 * very first paint — avoiding the transient-zero flash that a useEffect
 * seed would introduce.
 *
 * Idempotent per page: the ref guard prevents re-seeding on React strict
 * mode double-renders.
 */
export function useDataHydration(slice: DataSlice) {
  const { hydrate } = useData();
  const seeded = useRef(false);
  if (!seeded.current) {
    seeded.current = true;
    hydrate(slice);
  }
}
