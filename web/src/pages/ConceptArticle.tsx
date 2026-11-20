import { Link, useParams, useLocation } from "react-router-dom";
import { concepts, references, type Subject } from "../lib/earthpedia";
import { ConceptFigure } from "../components/ConceptFigure";
import { ReadingSequence } from "../components/InvestigationLibrary";
import { investigations } from "../lib/investigations";

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
  const params = new URLSearchParams(search);
  const path = params.get("path");
  params.delete("path");
  const back = <Link to={"/earthpedia"+(params.size ? "?"+params : "")}>Browse EarthPedia</Link>;
  if (!item) return <main className="learn-page">{back}<h1>Concept unavailable</h1></main>;
  const [credit,url] = references[item.source as keyof typeof references];
  const guides = investigations.filter(guide => guide.concepts.includes(item.slug));
  const guide = guides.find(g => g.concepts[0] === path) ?? guides[0];
  const relatedResources = [...new Set(guides.flatMap(path => path.concepts)
    .map(slug => concepts.find(c => c.slug === slug)?.source)
    .filter(source => source && source !== item.source))].slice(0,2);
  return <main className="learn-page explainer">
    <nav aria-label="Breadcrumb" className="breadcrumb">{back}<span>/</span><Link to={"/earthpedia?subject="+encodeURIComponent(item.subject)}>{item.subject}</Link><span>/</span><span aria-current="page">{item.name}</span></nav>
    <header className="trend-head"><p className="eyebrow">{item.subject}</p><h1 className="regions-title">{item.name}</h1><p>{item.summary}</p></header>
    <div className="pedia-article-grid"><div className="article-body"><section><h2>Why this matters</h2><p>{item.example}</p></section>
    <ConceptFigure key={item.slug} slug={item.slug}/>
    <section><h2>Try it in EarthPulse</h2><p>{guide.task}</p><Link to={guide.destination}>{guide.action} ↗</Link></section>
    <section><h2>Go deeper</h2><p>{item.science}</p></section>
    <section className="reading-note"><h2>Limits to interpretation</h2><p>{limits[item.subject]}</p></section>
    <section><h2>Check your understanding</h2><p>{guide.check}</p><details key={item.slug}><summary>See the explanation</summary><p>{guide.answer}</p></details></section>
    </div><aside className="pedia-reference specimen-frame"><section><h2>Your reading path</h2><p>{guide.question}</p><ReadingSequence guide={guide} current={item.slug}/></section>
    <section><h2>Scientific references</h2><a href={url}>{credit} ↗</a>
      {relatedResources.length>0 && <><p>Further reading for this investigation</p><ul>{relatedResources.map(source=>{
        const [name,href]=references[source as keyof typeof references];
        return <li key={source}><a href={href}>{name} ↗</a></li>;
      })}</ul></>}
    </section></aside></div>
  </main>;
}
