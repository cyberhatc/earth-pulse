import { Link } from "react-router-dom";

const METHODS = [
  {
    title: "Theil–Sen estimator",
    concept: "theil-sen",
    plain: "Estimates the typical rate of change by taking the middle slope among pairs of readings. One extreme year has less influence.",
    body: "Robust slope estimation, reducing sensitivity to outliers compared with ordinary least squares in many cases.",
    details: [
      "Supports long-term direction and rate summaries for time series.",
      "Paired with significance testing for evidence-aware interpretation.",
    ],
  },
  {
    title: "Mann–Kendall test",
    concept: "mann-kendall",
    plain: "Checks whether later readings tend to be higher or lower than earlier ones. A steady direction can be easier to distinguish from random variation.",
    body: "Evaluates monotonic trend significance and direction.",
    details: [
      "Helps distinguish persistent signals from variability/noise where data permit.",
      "Reported alongside trend estimates in supported workflows.",
    ],
  },
  {
    title: "Anomaly detection",
    concept: "anomaly",
    plain: "Flags a reading that stands out from its usual local pattern so you can investigate what happened.",
    body: "Rolling robust statistics, median/MAD-based z-scores, and optional multivariate approaches such as Isolation Forest where implemented/configured.",
    details: [
      "Highlights departures that merit closer inspection.",
      "Interpreted alongside source coverage and series quality.",
    ],
  },
  {
    title: "Forecasting with uncertainty",
    concept: "uncertainty",
    plain: "Shows a middle estimate and a range of possible values. A wider band means the model sees more uncertainty.",
    body: "p10/p50/p90 forecast outputs, ridge-rollout forecasting, and linear-trend-plus-seasonal fallback behavior where applicable.",
    details: [
      "Communicates plausible ranges rather than a single certain future.",
      "Forecast skill is context-dependent and should be read with reported uncertainty.",
    ],
  },
  {
    title: "Climate Twins",
    concept: "climate-twins",
    plain: "Groups places with similar environmental patterns so you can compare them across a map.",
    body: "K-Means-based clustering of environmental feature signatures for comparative context (where supported by the analysis workflow).",
    details: [
      "Helps find places with related profiles, not identical outcomes.",
      "Based on selected features and preprocessing used in the analysis pipeline.",
    ],
  },
  {
    title: "Opposite Trend Detector",
    concept: "opposite-trends",
    plain: "Finds neighbors where the same measure trends in opposite directions. The contrast gives you a question to investigate.",
    body: "Identifies neighboring grid cells with opposite trend directions, subject to significance and strength criteria (where supported).",
    details: [
      "Useful for investigating local contrasts such as land use, terrain, or water management.",
      "Pairs are filtered/ranked by analysis logic; interpretation remains contextual.",
    ],
  },
];

export function MethodsSection() {
  return (
    <section id="methods" className="landing-section l-methods" data-section="methods" aria-label="Scientific methodology">
      <div className="landing-shell">
        <div className="l-section-head" data-l-reveal>
          <p className="l-eyebrow" data-anime="mark">Methods</p>
          <h2 className="l-section-title">Scientific methodology</h2>
          <p className="l-section-lede">
            Each method answers a different question about a record. The available tests depend on the place, measure and data source.
          </p>
        </div>

        <div className="l-method-grid" data-l-stagger>
          {METHODS.map((m) => (
            <article key={m.title} className="l-method-card" data-anime="accent">
              <h3>{m.title}</h3>
              <p>{m.plain}</p>
              <details><summary>Method details</summary>
              <p>{m.body}</p>
              <ul>
                {m.details.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
              </details>
              <Link to={"/earthpedia/"+m.concept}>Explore {m.title} in EarthPedia</Link>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
