const CAPABILITIES = [
  {
    code: "Module A · Fingerprint",
    title: "Earth Trend Fingerprint",
    body: "Couples land temperature, canopy NDVI, rainfall, and adjacent sea-surface trends into one significance matrix.",
  },
  {
    code: "Module B · Trust Me",
    title: "Evidence & Confidence Layer",
    body: "Traces every conclusion directly to NASA LP DAAC, GES DISC, spatial resolution, missingness, and limitations.",
  },
  {
    code: "Module C · Anomalies",
    title: "Earth Anomaly Detective",
    body: "Isolates detrended seasonal departures and flags hotspots without conflating weather spikes with climate shifts.",
  },
  {
    code: "Module D · Folio",
    title: "One-Click Investigation Notebook",
    body: "Compiles research question, methods, charts, and confidence limits into a shareable Markdown or JSON dossier.",
  },
  {
    code: "Module E · Global Twins",
    title: "Earth Twin Finder",
    body: "Matches regional trend fingerprints across continents while enforcing explicit dataset comparability rules.",
  },
  {
    code: "Module F · Local Voice",
    title: "Local Earth Stories",
    body: "Translates findings for students, journalists, and researchers in English, Hindi, and Kannada.",
  },
];

export function InstrumentsSection() {
  return (
    <section id="instruments" className="landing-section l-instruments" data-section="instruments" aria-label="Scientific Instruments">
      <div className="landing-shell">
        <div className="l-section-head" data-l-reveal>
          <p className="l-eyebrow" data-anime="mark">03 · Scientific Instruments</p>
          <h2 className="l-section-title">Six lenses on planetary change.</h2>
          <p className="l-section-lede">
            An editorial suite of analytical instruments — each grounded in the project’s implemented methods and
            presented with scientific restraint.
          </p>
        </div>
        <div className="l-cards-3" data-l-stagger>
          {CAPABILITIES.map((cap) => (
            <article key={cap.code} className="l-inst-card" data-anime="accent">
              <div className="l-inst-code">{cap.code}</div>
              <h3 className="l-inst-title">{cap.title}</h3>
              <p className="l-inst-body">{cap.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
