import { Link, useSearchParams } from "react-router-dom";
import { concepts } from "../lib/earthpedia";
import "../styles/learning.css";

export function EarthPedia() {
  const [params, setParams] = useSearchParams();
  const query = params.get("q") || "";
  const subject = params.get("subject") || "";
  const results = concepts.filter(c => (!subject || c.subject === subject) &&
    query.trim().toLowerCase().split(/\s+/).every(word =>
      [c.name, c.subject, c.summary, c.keywords, c.slug].join(" ").toLowerCase().includes(word)));
  function update(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value); else next.delete(key);
    setParams(next, { replace: true });
  }
  return <main className="learn-page">
    <Link to="/">← EarthPulse</Link>
    <header><small>EARTHPULSE KNOWLEDGE BASE</small><h1>EarthPedia</h1>
    <p>Big Earth Science, Simply Explained.</p><p>Explore the science behind changing coastlines, seasonal vegetation, climate trends and forecasts.</p></header>
    <div className="learn-filters">
      <label>Search concepts<input type="search" placeholder="Try rainfall, NDVI or unusual measurement" value={query} onChange={e => update("q", e.target.value)} /></label>
      <label>Subject<select value={subject} onChange={e => update("subject", e.target.value)}>
        <option value="">All subjects</option>{Array.from(new Set(concepts.map(c => c.subject))).map(s => <option key={s}>{s}</option>)}
      </select></label>
    </div>
    <p role="status">{results.length} concepts</p>
    {results.length === 0 && <button onClick={() => setParams({})}>Clear search and filters</button>}
    <div className="learn-grid">{results.map(c => <article key={c.slug} data-subject={c.subject}><small>{c.subject}</small><h2><Link to={`/earthpedia/${c.slug}${params.size ? "?" + params : ""}`}>{c.name}</Link></h2><p>{c.summary}</p></article>)}</div>
  </main>;
}
