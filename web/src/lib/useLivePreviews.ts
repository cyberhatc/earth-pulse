import { useEffect, useState } from "react";
import { fetchPlace } from "./api";
import { demoAnalysis, deriveLiveAnalysis, type LiveAnalysis } from "./live";
import type { Region } from "./types";

/**
 * Fetch a live /place summary for each region preview card.
 * Falls back to the local demonstration series when the API is offline.
 */
export function useLivePreviews(
  regions: Region[],
): Record<string, LiveAnalysis> {
  const [bySlug, setBySlug] = useState<Record<string, LiveAnalysis>>({});
  const key = regions.map((region) => region.slug).join("|");

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const slugs = key.split("|").filter(Boolean);
    const current = regions.filter((region) => slugs.includes(region.slug));

    Promise.allSettled(
      current.map((region) =>
        fetchPlace(
          region.center[0],
          region.center[1],
          60,
          controller.signal,
        ).then((payload) => ({ region, payload })),
      ),
    ).then((results) => {
      if (cancelled) return;
      const next: Record<string, LiveAnalysis> = {};
      results.forEach((result, index) => {
        const region = current[index];
        if (result.status === "fulfilled") {
          next[region.slug] = deriveLiveAnalysis(
            region,
            result.value.payload,
            null,
          );
        } else {
          next[region.slug] = demoAnalysis(
            region,
            null,
            "error",
            "Backend preview unavailable; showing the local demonstration series.",
          );
        }
      });
      setBySlug(next);
    });

    return () => {
      cancelled = true;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return bySlug;
}
