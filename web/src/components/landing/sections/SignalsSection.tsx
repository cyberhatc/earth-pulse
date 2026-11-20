import { useState } from "react";

export function SignalsSection() {
  const [showTrend, setShowTrend] = useState(true);
  const [showAnomaly, setShowAnomaly] = useState(true);
  const [showForecast, setShowForecast] = useState(true);

  const w = 760, h = 340, pad = 46;
  const xs = (i: number) => pad + (i / 23) * (w - pad * 2);
  const ys = (v: number) => h - pad - ((v - 10) / 18) * (h - pad * 2);
  const hist = [12.2,12.6,12.1,12.8,13.0,12.7,13.4,13.1,13.6,13.8,13.5,14.1,13.9,14.4,14.0,14.8,14.3,15.2,14.7,15.5];
  const forecast = [15.6,15.9,16.1,16.4];
  const upper = [16.2,16.8,17.3,17.9];
  const lower = [15.0,15.0,14.9,14.9];
  const line = (vals: number[], off = 0) => vals.map((v, i) => `${i === 0 ? "M" : "L"} ${xs(i + off)} ${ys(v)}`).join(" ");
  const area = upper.map((v, i) => `${i === 0 ? "M" : "L"} ${xs(i + 20)} ${ys(v)}`).join(" ") + " " + [...lower].reverse().map((v, i) => `L ${xs(23 - i)} ${ys(v)}`).join(" ") + " Z";
  const trend = `M ${xs(0)} ${ys(12.4)} L ${xs(23)} ${ys(16.3)}`;
  const anomalyI = 17;

  return (
    <section id="signals" className="landing-section l-signals" data-section="signals" aria-label="Reading the signals">
      <div className="landing-shell">
        <div className="l-section-head" data-l-reveal>
          <p className="l-eyebrow" data-anime="mark">Signals</p>
          <h2 className="l-section-title">Reading the Signals</h2>
          <p className="l-section-lede">Switch the trend line on to see the long-term direction. Then switch on the forecast: its shaded band widens as the possible outcomes spread apart.
          </p>
        </div>

        <div className="l-illustrative-banner" role="note" data-l-reveal>
          <strong>Illustrative explanation only — not Earth Pulse output and not NASA observations.</strong>
        </div>

        <div className="l-signal-layout">
          <div className="l-signal-chart" data-l-reveal>
            <div className="l-signal-controls" role="group" aria-label="Toggle chart elements">
              <button type="button" className="l-chip-btn" aria-pressed={showTrend} onClick={() => setShowTrend((v) => !v)}>Trend line</button>
              <button type="button" className="l-chip-btn" aria-pressed={showAnomaly} onClick={() => setShowAnomaly((v) => !v)}>Anomaly</button>
              <button type="button" className="l-chip-btn" aria-pressed={showForecast} onClick={() => setShowForecast((v) => !v)}>Forecast & uncertainty</button>
            </div>
            <figure>
              <svg
                className="l-signal-svg"
                viewBox={`0 0 ${w} ${h}`}
                role="img"
                aria-labelledby="sig-title sig-desc"
              >
                <title id="sig-title">Illustrative environmental time series (teaching example)</title>
                <desc id="sig-desc">
                  Chart with illustrative historical observations, a trend line, one anomaly marker, a forecast horizon with p50 and an uncertainty band between p10 and p90. Not real application output.
                </desc>
                <defs>
                  <linearGradient id="sigBand" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#d7d2c6" stopOpacity="0.22" />
                    <stop offset="100%" stopColor="#d7d2c6" stopOpacity="0.05" />
                  </linearGradient>
                </defs>
                {[12,14,16,18,20,22,24,26,28].map((v) => (
                  <g key={v}>
                    <line x1={pad} x2={w - pad} y1={ys(v)} y2={ys(v)} stroke="rgba(242,240,234,0.12)" />
                    <text x={8} y={ys(v) + 4} fontSize="10" fill="rgba(242,240,234,0.55)">{v}</text>
                  </g>
                ))}
                <line x1={xs(19.5)} x2={xs(19.5)} y1={pad} y2={h - pad} stroke="rgba(242,240,234,0.35)" strokeDasharray="4 4" />
                <text x={xs(19.5) - 46} y={pad - 10} fontSize="10" fill="rgba(242,240,234,0.7)">Observed</text>
                <text x={xs(19.5) + 8} y={pad - 10} fontSize="10" fill="rgba(242,240,234,0.7)">Forecast horizon</text>

                {showForecast && <path d={area} fill="url(#sigBand)" stroke="none" />}
                <path d={line(hist)} fill="none" stroke="#f2f0ea" strokeWidth="2.6" />
                {showForecast && <path d={line(forecast, 20)} fill="none" stroke="#d7d2c6" strokeWidth="2.4" strokeDasharray="6 4" />}
                {showTrend && <path d={trend} fill="none" stroke="#ffffff" strokeWidth="2" strokeDasharray="5 5" opacity="0.8" />}
                {showAnomaly && (
                  <g>
                    <circle cx={xs(anomalyI)} cy={ys(hist[anomalyI])} r="6" fill="#ffffff" />
                    <circle cx={xs(anomalyI)} cy={ys(hist[anomalyI])} r="3" fill="#050505" />
                    <text x={xs(anomalyI) + 10} y={ys(hist[anomalyI]) - 10} fontSize="11" fill="#f2f0ea" fontWeight="600">Anomaly</text>
                  </g>
                )}
                {showForecast && (
                  <g fontSize="10" fill="rgba(242,240,234,0.75)">
                    <text x={xs(21.2)} y={ys(upper[1]) - 6}>p90</text>
                    <text x={xs(21.2)} y={ys(forecast[1]) - 6} fill="#f2f0ea">p50</text>
                    <text x={xs(21.2)} y={ys(lower[1]) + 14}>p10</text>
                  </g>
                )}
                <text x={w / 2 - 70} y={h - 8} fontSize="11" fill="rgba(242,240,234,0.55)">Time (illustrative units)</text>
              </svg>
              <figcaption className="l-signal-caption">
                Teaching visual only. Values and markers are illustrative and do not represent measured data or Earth Pulse results.
              </figcaption>
            </figure>
          </div>

          <div className="l-signal-legend" data-l-reveal>
            <h3>How to read it</h3>
            <ul>
              <li><strong>Historical observations.</strong> Measured or recorded values over time (subject to source coverage and quality).</li>
              <li><strong>Trend line.</strong> An estimate of long-term direction/magnitude (e.g. robust slope) that helps summarize gradual change.</li>
              <li><strong>Anomaly.</strong> A value that departs unusually from local/expected behavior under a chosen detection method and window.</li>
              <li><strong>Forecast p50.</strong> A model-derived central estimate for future steps, not a guarantee.</li>
              <li><strong>Uncertainty band p10–p90.</strong> A plausible range reflecting model and variability uncertainty; wider bands indicate lower certainty.</li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}