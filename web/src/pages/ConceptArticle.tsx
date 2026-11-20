import { Link, useParams, useLocation } from "react-router-dom";
import { concepts, references, type Subject } from "../lib/earthpedia";
import { ConceptFigure } from "../components/ConceptFigure";

const limits:Record<Subject,string> = {
  "Earth observation":"A single observation describes one footprint at one time. Establishing change requires comparable repeat measurements.",
  Atmosphere:"A regional average can hide local extremes. Check whether the record describes a grid cell, a station or a larger area.",
  Vegetation:"Greenness alone cannot identify a plant species or establish the cause of a change in cover.",
  Oceans:"Conditions at the surface can differ from conditions at depth. Check the reference level and location before comparing records.",
  Analysis:"A statistical pattern can guide an investigation. Establishing its cause requires additional evidence.",
  Sources:"A source listing describes a product. Check the active dataset, dates and provenance to see whether it contributed to your result.",
};
export function ConceptArticle() {
  const { concept } = useParams();
  const { search } = useLocation();
  const item = concepts.find(c => c.slug === concept);
  const back = <Link to={"/earthpedia"+search}>Browse EarthPedia</Link>;
  if (!item) return <main className="learn-page">{back}<h1>Concept unavailable</h1></main>;
  const [credit,url] = references[item.source as keyof typeof references];
  const related = concepts.filter(c => c.subject===item.subject && c!==item).slice(0,3);
  const method = item.subject==="Analysis";
  const section = method?"signals":item.subject==="Sources"?"sources":"variables";
  return <main className="learn-page explainer">
    <nav aria-label="Breadcrumb" className="breadcrumb">{back}<span>/</span><Link to={"/earthpedia?subject="+encodeURIComponent(item.subject)}>{item.subject}</Link><span>/</span><span aria-current="page">{item.name}</span></nav>
    <header><small>{item.subject}</small><h1>{item.name}</h1><p>{item.summary}</p></header>
    <div className="article-body"><section><h2>Why this matters</h2><p>{item.example}</p></section>
    <ConceptFigure key={item.slug} slug={item.slug}/>
    <section><h2>How EarthPulse uses it</h2><p>{method?"Use the illustrative signal chart to distinguish a trend, an unusual reading and a forecast.":item.subject==="Sources"?"Check the source directory to see which products are integrated, optional or available for further reading.":"Use the variable guide to choose a measure, then check its unit, dates and coverage in a regional case file."}</p><Link to={"/#"+section}>Open the {section} guide ↗</Link></section>
    <section><h2>Go deeper</h2><p>{item.science}</p></section>
    <section className="reading-note"><h2>Limits to interpretation</h2><p>{limits[item.subject]}</p></section>
    <section><h2>Trusted source</h2><a href={url}>{credit} ↗</a></section>
    <section><h2>Related discoveries</h2><ul>{related.map(c=><li key={c.slug}><Link to={"/earthpedia/"+c.slug}>{c.name}</Link></li>)}</ul></section></div>
  </main>;
}
