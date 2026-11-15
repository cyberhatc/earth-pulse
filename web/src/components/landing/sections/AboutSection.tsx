export function AboutSection() {
  return (
    <section id="about" className="landing-section l-about" data-section="about" aria-label="About Earth Pulse">
      <div className="landing-shell l-two-col">
        <div className="l-prose" data-l-reveal>
          <p className="l-eyebrow" data-anime="mark">About</p>
          <h2 className="l-section-title">About Earth Pulse</h2>
          <p className="l-section-lede l-section-lede-strong">
            A focused environment for investigating Earth-system signals.
          </p>
          <p>
            Earth Pulse is an open-source, map-first explorer for examining how environmental conditions vary over time
            and differ across regions—using Earth observation data, statistical analysis, and transparent presentation.
          </p>

          <h3>What it is</h3>
          <p>
            A place-based investigation interface where users can explore historical series, detect trends, review
            anomalies, compare neighboring behaviors, and view probabilistic forecasts alongside imagery and provenance
            context.
          </p>

          <h3>Why change matters</h3>
          <p>
            Earth-system changes—warming, shifting precipitation, vegetation dynamics, ocean conditions, and more—affect
            ecosystems, infrastructure, and communities.
          </p>

          <h3>Why trends differ geographically</h3>
          <p>
            Climate drivers, land cover, elevation, coastal influence, water availability, and human land use can produce
            different trends even across nearby areas.
          </p>

          <h3>Why statistical significance matters</h3>
          <p>
            Not every apparent slope reflects a robust signal. Earth Pulse pairs trend estimates with significance
            testing to distinguish stronger evidence from uncertain or noisy patterns.
          </p>

          <p className="l-pull-quote">
            “Earth Pulse is designed to help users move from ‘something looks different’ to ‘here is what the data shows,
            how confident we are, and where coverage is limited.’”
          </p>
        </div>

        <aside className="l-principles" aria-label="Principles" data-l-stagger>
          {[
            {
              title: "Evidence over assumption.",
              body: "Combines visual exploration with quantitative methods and explicit uncertainty bands for forecasts.",
            },
            {
              title: "Regional contrast, not averages only.",
              body: "Supports comparison-oriented views, including detection of neighboring areas with opposite trend directions.",
            },
            {
              title: "Honest data communication.",
              body: "Separates observed data, forecasts, and scenario/illustrative outputs; flags synthetic demo stores and coverage gaps.",
            },
            {
              title: "Built for investigation.",
              body: "Search or click a location, review variables and methods, and interpret results with documented context.",
            },
          ].map((item) => (
            <article key={item.title} className="l-principle-card" data-anime="accent">
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </article>
          ))}
        </aside>
      </div>
    </section>
  );
}