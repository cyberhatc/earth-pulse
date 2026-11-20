import { Link, useSearchParams } from "react-router-dom";
import { concepts, type Subject } from "../lib/earthpedia";
import { SciencePlot } from "../components/DiscoveryArt";
import { InvestigationLibrary } from "../components/InvestigationLibrary";
import "../styles/learning.css";
import "../styles/discovery.css";

const subjects: Record<Subject,[string,string]> = {
  "Earth observation":["◎","Earth Observation"], Atmosphere:["☁","Atmosphere"], Vegetation:["❧","Vegetation"],
  Oceans:["≈","Oceans"], Analysis:["∿","Scientific Analysis"], Sources:["▤","Data Sources"],
};
const pathways = [
  ["earth-observation","How do we observe Earth?","Start with what a sensor can see from orbit."],
  ["trend","How do we know Earth is changing?","Follow the pattern through a noisy record."],
  ["uncertainty","What can we learn about the future?","Read the range around a forecast."],
];
const popular = ["remote-sensing","ndvi","trend","anomaly","uncertainty","satellite-imagery"];
const aliases:Record<string,string> = {"why forecasts are uncertain":"uncertainty","what is a climate trend":"trend","how do satellites work":"remote-sensing","how do forecasts work":"forecast","satellites":"satellite","forecasts":"forecast"};
export function EarthPedia() {
  const [params, setParams] = useSearchParams();
  const query = params.get("q") || "";
  const subject = params.get("subject") || "";
  const normalized = query.trim().toLowerCase().replace(/[?!]/g,"");
  const words = (aliases[normalized] || normalized).split(/\s+/).filter(w=>!["is","a","the","what","do","how"].includes(w));
  const results = concepts.filter(c => (!subject || c.subject === subject) && words.every(word =>
    [c.name,c.subject,subjects[c.subject][1],c.summary,c.keywords,c.slug].join(" ").toLowerCase().includes(word)));
  function update(key:string,value:string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key,value); else next.delete(key);
    setParams(next,{replace:true});
  }
  const browsing = !query.trim() && !subject;
  return <main className="learn-page discovery">
    <header className="atlas-hero"><div className="atlas-copy"><p className="eyebrow">EarthPulse ? Knowledge base</p>
      <h1 className="regions-title">EarthPedia</h1><h2>Understand Earth. One Discovery at a Time.</h2>
      <p>Explore satellites, climate signals, oceans, vegetation, and scientific methods through easy explanations, interactive visuals, and trusted research.</p>
      <span className="atlas-meta">{concepts.length} scientific concepts · Beginner-friendly · Source-backed</span></div>
      <figure className="planet-plate specimen-frame"><img src="/atlas/apollo17.webp" alt="Sunlit Earth photographed by the Apollo 17 crew, with Africa and Antarctica visible."/><figcaption><a href="https://images.nasa.gov/details/as17-148-22727">Earth from Apollo 17 · NASA, 1972</a></figcaption></figure>
    </header>
    <section className="atlas-search specimen-frame"><h2>What would you like to understand?</h2>
      <div className="learn-filters"><label><span className="sr-only">Search concepts</span><span className="search-wrap"><span aria-hidden="true">⌕</span><input type="search" placeholder="Try NDVI, rainfall, satellites, or why forecasts are uncertain…" value={query} onChange={e=>update("q",e.target.value)}/>{query && <button onClick={()=>update("q","")} aria-label="Clear search">×</button>}</span></label>
      <label><span className="sr-only">Subject</span><select value={subject} onChange={e=>update("subject",e.target.value)}><option value="">All subjects</option>{Object.entries(subjects).map(([key,[,name]])=><option key={key} value={key}>{name}</option>)}</select></label></div>
      {browsing && <nav aria-label="Popular questions" className="question-links">{[["What is NDVI?","ndvi"],["How do satellites work?","remote-sensing"],["What is a climate trend?","trend"],["How do forecasts work?","forecast"]].map(([name,slug])=><Link key={slug} to={"/earthpedia/"+slug}>{name}</Link>)}</nav>}
    </section>
    {browsing && <>
      <InvestigationLibrary />
      <section className="discovery-section"><h2>Start With the Big Picture</h2><div className="pathways region-grid">{pathways.map(([slug,title,desc],i)=><Link key={slug} className="region-card specimen-frame" to={"/earthpedia/"+slug}>
        <div className="path-art">{i===0?<img loading="lazy" src="/atlas/nile-delta.jpg" alt="Satellite mosaic showing the Nile Delta" />:<SciencePlot kind={i===1?"trend":"uncertainty"}/>}</div>
        <div className="path-copy"><small>{["Earth observation","Climate trends","Forecasting"][i]}</small><h3>{title}</h3><p>{desc}</p><span>Learn more ↗</span></div>
      </Link>)}</div><p className="plate-caption">Nile Delta mosaic · Esri World Imagery and contributors. Charts use illustrative data.</p></section>
      <section className="discovery-section"><h2>Explore by Subject</h2><div className="subject-index">{Object.entries(subjects).map(([key,[icon,name]])=><button data-subject={key} key={key} onClick={()=>{update("subject",key);document.querySelector(".atlas-search")?.scrollIntoView({block:"start"});}}><b aria-hidden="true">{icon}</b> {name} <span>{concepts.filter(c=>c.subject===key).length}</span></button>)}</div></section>
      <section className="discovery-section"><h2>Popular Earth Science Concepts</h2><nav className="popular-index">{popular.map(slug=><Link key={slug} to={"/earthpedia/"+slug}>{concepts.find(c=>c.slug===slug)?.name} ↗</Link>)}</nav></section>
    </>}
    <section className="discovery-section"><div className="library-head"><h2>{browsing?"Complete Knowledge Library":"Matching concepts"}</h2><span role="status">{results.length} concepts</span></div>
    {!results.length && <><p>Try a broader term or explore all subjects.</p><button onClick={()=>setParams({})}>Clear search and filters</button></>}
    <div className="learn-grid library-grid">{results.map(c=><article className="specimen-frame" key={c.slug} data-subject={c.subject}><small>{subjects[c.subject][1]}</small><h3><Link to={`/earthpedia/${c.slug}${params.size?"?"+params:""}`}>{c.name}</Link></h3><p>{c.summary}</p><span aria-hidden="true">Learn more ↗</span></article>)}</div></section>
  </main>;
}
