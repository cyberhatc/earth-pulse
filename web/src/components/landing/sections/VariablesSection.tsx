const VARIABLES = [
  { category: "Atmosphere", name: "Temperature", desc: "How warm the air or surface is, and how that changes with the seasons." },
  { category: "Atmosphere", name: "Humidity", desc: "How much moisture the air holds. Humidity affects how quickly water evaporates." },
  { category: "Atmosphere", name: "Wind", desc: "How air moves near the surface, including along the coast." },
  { category: "Hydrology", name: "Precipitation", desc: "How much rain or snow falls. Compare wet and dry periods across years." },
  { category: "Vegetation", name: "NDVI", desc: "A satellite measure of greenness. NDVI compares reflected red and near-infrared light to help track changes in plant cover." },
  { category: "Energy", name: "Solar radiation", desc: "How much energy from sunlight reaches the surface." },
  { category: "Ocean", name: "Sea surface temperature", desc: "How warm the upper ocean is at a marine location." },
  { category: "Ocean", name: "Sea level", desc: "How the height of the sea changes where the dataset covers coastal or ocean waters." },
];

export function VariablesSection() {
  return (
    <section id="variables" className="landing-section l-variables" data-section="variables" aria-label="Environmental variables">
      <div className="landing-shell">
        <div className="l-section-head" data-l-reveal>
          <p className="l-eyebrow" data-anime="mark">Variables</p>
          <h2 className="l-section-title">Environmental variables</h2>
          <p className="l-section-lede">
            Choose a measure that fits your question. A coastal water temperature record covers a different part of the landscape than a hillside vegetation record.
          </p>
        </div>

        <div className="l-var-grid" data-l-stagger>
          {VARIABLES.map((v) => (
            <article key={v.name} className="l-var-card" data-domain={v.category} data-anime="accent">
              <p className="l-var-cat">{v.category}</p>
              <h3>{v.name}</h3>
              <p>{v.desc}</p>
              {v.name === "NDVI" && <a href="https://science.nasa.gov/earth/earth-observatory/measuring-vegetation-ndvi-evi/">How NASA measures greenness</a>}
            </article>
          ))}
        </div>

        <p className="l-note-inline" data-l-reveal>
          A missing value means the source has no usable reading there. Check the dates too: different records begin in different years.
        </p>
      </div>
    </section>
  );
}
