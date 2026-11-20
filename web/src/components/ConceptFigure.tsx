import { SciencePlot } from "./DiscoveryArt";

const figures = {
  ndvi: {title:"From light to a vegetation index", labels:["Red reflectance","Near-infrared reflectance"],values:[18,63], caption:"Illustrative reflectances of 0.18 and 0.63 give NDVI ≈ 0.56. Compare the difference with the sum of both bands."},
  uncertainty: {title:"Three points in a forecast distribution",labels:["P10","P50 · median","P90"],values:[10,50,90],caption:"The bars show percentile rank. The interval between P10 and P90 contains the middle 80% of the model distribution. Observed coverage can differ."},
  "spatial-resolution": {title:"One landscape, two pixel sizes",labels:["10 m pixel edge","30 m pixel edge"],values:[25,75],caption:"A 30 m square covers the area of nine 10 m squares. Smaller pixels can separate finer features when sensor quality allows."},
};
export function ConceptFigure({slug}:{slug:string}) {
  if (["trend","anomaly","uncertainty","forecast"].includes(slug)) {
    const kind = slug==="trend"?"trend":slug==="anomaly"?"anomaly":"uncertainty";
    return <figure className="concept-figure"><h3>{kind==="trend"?"Separate direction from variation":kind==="anomaly"?"Spot the unusual reading":"A range of possible futures"}</h3><SciencePlot kind={kind} interactive /></figure>;
  }
  if (["remote-sensing","earth-observation","satellite-imagery"].includes(slug)) return <figure className="concept-figure"><h3>From surface to signal</h3><ol><li>Sunlight reflects off land or water.</li><li>A satellite sensor records light in selected bands.</li><li>Processing places those readings on a map.</li><li>Scientists compare measurements across time.</li></ol><figcaption>Illustrative optical observation sequence.</figcaption></figure>;
  if (slug==="temporal-resolution") return <figure className="concept-figure"><h3>Same place, different dates</h3><p>Day 1 → Day 6 → Day 11</p><figcaption>Illustrative five-day sampling. Pixel size describes the area observed; revisit time describes the interval between looks.</figcaption></figure>;
  if (!(slug in figures)) return null;
  const figure=figures[slug as keyof typeof figures];
  return <figure className="concept-figure"><h3>{figure.title}</h3>
    {figure.labels.map((label,i)=><div key={label}><span>{label}</span><i aria-hidden="true" style={{width:figure.values[i]+"%"}} /></div>)}
    <figcaption>{figure.caption}</figcaption></figure>;
}
