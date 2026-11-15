const STEPS = [
  {
    num: "01",
    title: "Discover environmental variables.",
    body: "Review the parameters available for the selected location and mode (e.g. temperature, precipitation, vegetation indices, humidity, wind, solar radiation, and ocean-related variables where relevant).",
  },
  {
    num: "02",
    title: "Select a geographical region.",
    body: "Open a case file or region and anchor the analysis to a specific location of interest.",
  },
  {
    num: "03",
    title: "Explore historical observations.",
    body: "Inspect monthly time series and available imagery/context to understand past behavior, seasonality, and notable events.",
  },
  {
    num: "04",
    title: "Detect and quantify trends.",
    body: "Estimate long-term trend direction and magnitude using robust methods designed to reduce sensitivity to outliers.",
  },
  {
    num: "05",
    title: "Evaluate statistical significance.",
    body: "Assess whether detected trends are likely monotonic signals using formal significance testing rather than visual impression alone.",
  },
  {
    num: "06",
    title: "Compare environmental changes.",
    body: "Examine neighboring contrasts (opposite trends), climate similarity context, and anomalies to understand spatial differences.",
  },
  {
    num: "07",
    title: "Understand the findings.",
    body: "Read plain-language summaries alongside coverage notes, uncertainty intervals, and labels distinguishing observations, forecasts, and illustrative outputs.",
  },
];

export function HowItWorksSection() {
  return (
    <section id="how-it-works" className="landing-section l-how" data-section="how" aria-label="How it works">
      <div className="landing-shell">
        <div className="l-section-head" data-l-reveal>
          <p className="l-eyebrow" data-anime="mark">Workflow</p>
          <h2 className="l-section-title">How it works</h2>
          <p className="l-section-lede">A clear workflow for environmental investigation.</p>
          <p className="l-section-lede">
            Earth Pulse guides users from question to evidence: select a place, examine available observations,
            quantify trends, assess significance, and interpret forecasts and contrasts with transparent limitations.
          </p>
        </div>

        <ol className="l-steps" data-l-stagger>
          {STEPS.map((step) => (
            <li key={step.num} className="l-step">
              <div className="l-step-num" aria-hidden="true">{step.num}</div>
              <div className="l-step-body">
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </div>
            </li>
          ))}
        </ol>

        <p className="l-note-inline" data-l-reveal>
          <strong>Note:</strong> The application includes interactive case files, maps, charts, imagery, and analysis
          views. This landing page does not embed fabricated screenshots; launch the app to view the actual interface
          and outputs for a selected location.
        </p>
      </div>
    </section>
  );
}