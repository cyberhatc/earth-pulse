import { Link } from "react-router-dom";
import { concepts } from "../lib/earthpedia";

export function ScienceShelf() {
  return <section id="earthpedia-preview" className="landing-section"><div className="landing-shell">
    <p className="l-eyebrow">EarthPedia</p><h2 className="l-section-title">Curious about the science?</h2>
    <div className="learn-grid">{["ndvi","anomaly","trend","forecast"].map(slug => {
      const item = concepts.find(c => c.slug === slug)!;
      return <article key={slug}><small>{item.subject}</small><h3><Link to={"/earthpedia/"+slug}>{item.name}</Link></h3><p>{item.summary}</p></article>;
    })}</div><Link className="l-btn-secondary" to="/earthpedia">Explore EarthPedia</Link>
  </div></section>;
}
