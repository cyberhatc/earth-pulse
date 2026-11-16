import { useInvestigation } from "../lib/context";
import { CardRenderer } from "./cards";

export function ArtifactCanvas() {
  const { region, cards, live } = useInvestigation();
  const analysis = live.analysis;

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
            forecasts, anomaly reports, maps, and evidence-backed explanations
            from the live backend.
          </p>
        </div>
      ) : (
        cards.map((card) => (
          <CardRenderer key={card.id} card={card} region={region} analysis={analysis} />
        ))
      )}
    </section>
  );
}
