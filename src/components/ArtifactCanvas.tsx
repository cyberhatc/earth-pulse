"use client";

import { useMemo } from "react";
import { useInvestigation } from "../lib/context";
import { computeStats, generateSeries } from "../lib/trend";
import { CardRenderer } from "./cards";

export function ArtifactCanvas() {
  const { region, cards } = useInvestigation();

  const analysis = useMemo(() => {
    if (!region) return null;
    const series = generateSeries(region);
    const stats = computeStats(region, series);
    return { series, stats };
  }, [region]);

  if (!region || !analysis) {
    return null;
  }

  return (
    <section className="canvas" aria-label="Investigation artifacts">
      {cards.length === 0 ? (
        <div className="canvas-empty">
          <p className="canvas-empty-eyebrow">ARTIFACTS APPEAR HERE</p>
          <p className="canvas-empty-copy">
            As you ask questions on the left, cards will stack here — findings,
            charts, maps, and explanations.
          </p>
        </div>
      ) : (
        cards.map((card) => (
          <CardRenderer
            key={card.id}
            card={card}
            region={region}
            series={analysis.series}
            stats={analysis.stats}
          />
        ))
      )}
    </section>
  );
}
