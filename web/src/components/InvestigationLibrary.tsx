import { Link } from "react-router-dom";
import { concepts } from "../lib/earthpedia";
import { investigations, type Investigation } from "../lib/investigations";

export function ReadingSequence({ guide, current }: { guide: Investigation; current?: string }) {
  return <ol className="reading-sequence">{guide.concepts.map(slug => {
    const name = concepts.find(c => c.slug === slug)?.name;
    return <li key={slug}>{slug === current ? <strong aria-current="step">{name}</strong> : <Link to={"/earthpedia/"+slug+"?path="+guide.concepts[0]}>{name}</Link>}</li>;
  })}</ol>;
}

export function InvestigationLibrary() {
  return <section className="discovery-section field-guides"><h2>Learn through an investigation</h2>
    <p>Choose a question. Read the concepts in order, then try the investigation with EarthPulse’s own tools.</p>
    {investigations.map(guide => <details key={guide.question}>
      <summary>{guide.question}</summary><ReadingSequence guide={guide}/>
      <p>{guide.task}</p><Link to={guide.destination}>{guide.action} ↗</Link>
    </details>)}
  </section>;
}
