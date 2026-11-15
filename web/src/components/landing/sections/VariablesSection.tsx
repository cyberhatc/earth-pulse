const VARIABLES = [
  { category: "Atmosphere", name: "Temperature", desc: "Surface/air temperature signals used to examine warming/cooling patterns, seasonal cycles, and anomalies over time." },
  { category: "Atmosphere", name: "Humidity", desc: "Moisture-related atmospheric conditions that influence comfort, evapotranspiration, and regional hydroclimate behavior." },
  { category: "Atmosphere", name: "Wind", desc: "Near-surface wind characteristics relevant to circulation patterns, coastal dynamics, and local environmental variability." },
  { category: "Hydrology", name: "Precipitation", desc: "Rainfall amounts and variability used to assess wet/dry periods, trends, and extreme or unusual conditions." },
  { category: "Vegetation", name: "NDVI", desc: "Normalized Difference Vegetation Index as a proxy for vegetation greenness and condition, where observations are available and relevant." },
  { category: "Energy", name: "Solar radiation", desc: "Incoming solar energy context that can relate to surface conditions, seasonality, and climate/energy analyses." },
  { category: "Ocean", name: "Sea surface temperature", desc: "Ocean surface thermal conditions for marine-relevant locations; not applicable or available everywhere in the same way as land parameters." },
  { category: "Ocean", name: "Sea level", desc: "Sea-level-related signals where supported by the selected data/store; interpreted with coverage and relevance constraints." },
];

export function VariablesSection() {
  return (
    <section id="variables" className="landing-section l-variables" data-section="variables" aria-label="Environmental variables">
      <div className="landing-shell">
        <div className="l-section-head" data-l-reveal>
          <p className="l-eyebrow" data-anime="mark">Variables</p>
          <h2 className="l-section-title">Environmental variables</h2>
          <p className="l-section-lede">
            Parameters supported by application workflows. Availability depends on location, data mode, source coverage,
            and physical relevance.
          </p>
        </div>

        <div className="l-var-grid" data-l-stagger>
          {VARIABLES.map((v) => (
            <article key={v.name} className="l-var-card" data-anime="accent">
              <p className="l-var-cat">{v.category}</p>
              <h3>{v.name}</h3>
              <p>{v.desc}</p>
            </article>
          ))}
        </div>

        <p className="l-note-inline" data-l-reveal>
          <strong>Coverage note:</strong> Availability depends on location, data mode, source coverage, and physical
          relevance. The bundled offline demo uses a deterministic synthetic store with defined variables and masks.
          Parameters may be unavailable, masked, or irrelevant depending on geography; no single variable is implied to
          work everywhere.
        </p>
      </div>
    </section>
  );
}