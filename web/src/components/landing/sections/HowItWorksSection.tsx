const STEPS = [
  {
    "num": "01",
    "title": "Choose a place",
    "body": "Open a regional case file or find a point on the map."
  },
  {
    "num": "02",
    "title": "Read its record",
    "body": "Pick a measure, such as rainfall. Follow the months and look for a repeating season."
  },
  {
    "num": "03",
    "title": "Test the pattern",
    "body": "Estimate how fast values change. Check whether the evidence supports a lasting trend."
  },
  {
    "num": "04",
    "title": "Compare and interpret",
    "body": "Look for a neighbor moving in the opposite direction. Check the dates, source and forecast range before drawing conclusions."
  }
];

export function HowItWorksSection() {
  return (
    <section id="how-it-works" className="landing-section l-how" data-section="how" aria-label="How it works">
      <div className="landing-shell">
        <div className="l-section-head" data-l-reveal>
          <p className="l-eyebrow" data-anime="mark">Workflow</p>
          <h2 className="l-section-title">How it works</h2>
          <p className="l-section-lede">Start with a question you can check. Has rainfall changed at the coast and in the hills nearby?</p>
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

        
      </div>
    </section>
  );
}