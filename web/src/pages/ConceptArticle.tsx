import { Link, useParams, useLocation } from "react-router-dom";
import { concepts, references } from "../lib/earthpedia";
import { ConceptFigure } from "../components/ConceptFigure";

export function ConceptArticle() {
  const { concept } = useParams();
  const { search } = useLocation();
  const item = concepts.find(c => c.slug === concept);
  const back = <Link to={"/earthpedia" + search}>← Browse EarthPedia</Link>;
  if (!item) return <main className="learn-page">{back}<h1>Concept unavailable</h1></main>;
  const [credit, url] = references[item.source as keyof typeof references];
  const examples = concepts.filter(c => c.subject === item.subject && c !== item).slice(0,3);
  const method = item.subject === "Analysis";
  const section = method ? "signals" : item.subject === "Sources" ? "sources" : "variables";
  return <main className="learn-page">{back}
    <header><small>{item.subject}</small><h1>{item.name}</h1><p>{item.summary}</p></header>
    <h2>In the field</h2><p>{item.example}</p>
    <h2>Behind the science</h2><p>{item.science}</p>
    <ConceptFigure slug={item.slug} />
    <h2>Explore in EarthPulse</h2><p>{method ? "Use the illustrative signal chart to distinguish a trend, an unusual reading and a forecast." : item.subject === "Sources" ? "Check the source directory to see which products are integrated, optional or available for further reading." : "Use the variable guide to choose a measure, then check its unit, dates and coverage in a regional case file."}</p>
    <Link to={"/#" + section}>Open the {section} guide</Link>
    <h2>Read further</h2><a href={url}>{credit}</a>
    <h2>Related concepts</h2><ul>{examples.map(c => <li key={c.slug}><Link to={"/earthpedia/"+c.slug}>{c.name}</Link></li>)}</ul>
  </main>;
}
