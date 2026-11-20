const figures = {
  ndvi: {title:"From light to a vegetation index", labels:["Red reflectance","Near-infrared reflectance"],values:[18,63], caption:"Illustrative reflectances of 0.18 and 0.63 give NDVI ≈ 0.56. Compare the difference with the sum of both bands."},
  uncertainty: {title:"Three points in a forecast distribution",labels:["P10","P50 · median","P90"],values:[10,50,90],caption:"The bars show percentile rank. The interval between P10 and P90 contains the middle 80% of the model distribution. Observed coverage can differ."},
  "spatial-resolution": {title:"One landscape, two pixel sizes",labels:["10 m pixel edge","30 m pixel edge"],values:[25,75],caption:"A 30 m square covers the area of nine 10 m squares. Smaller pixels can separate finer features when sensor quality allows."},
};
export function ConceptFigure({slug}:{slug:string}) {
  if (!(slug in figures)) return null;
  const figure=figures[slug as keyof typeof figures];
  return <figure className="concept-figure"><h3>{figure.title}</h3>
    {figure.labels.map((label,i)=><div key={label}><span>{label}</span><i aria-hidden="true" style={{width:figure.values[i]+"%"}} /></div>)}
    <figcaption>{figure.caption}</figcaption></figure>;
}
