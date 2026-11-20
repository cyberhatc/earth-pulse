import { useState } from "react";

type Plot = "trend" | "anomaly" | "uncertainty";
const captions: Record<Plot,string> = {
  trend:"The readings fluctuate. The dashed line summarizes their upward direction.",
  anomaly:"The marked point stands above the surrounding readings. Its cause needs investigation.",
  uncertainty:"The dashed line is a central forecast. The shaded range widens with the forecast horizon.",
};

export function SciencePlot({ kind, interactive=false }: { kind:Plot; interactive?:boolean }) {
  const [show,setShow] = useState(true);
  const forecast = kind === "uncertainty";
  const values = kind === "anomaly" ? [61,55,62,54,56,51,18,59,50,58,53] : [77,65,71,50,63,46,52,35,43,30,34];
  const points = (forecast ? values.slice(0,6) : values).map((y,i)=>[12+i*23,y].join(",")).join(" ");
  return <div className="science-plot"><svg viewBox="0 0 260 100" role="img" aria-label={"Illustrative time series. "+captions[kind]}>
    {[20,45,70,92].map(y=><path key={y} d={`M10 ${y}H250`} stroke="var(--line-strong)" strokeDasharray="2 5"/>)}
    <polyline points={points} fill="none" stroke="var(--ink)" strokeWidth="2"/>
    {show && kind==="trend" && <path d="M12 74L242 27" stroke="var(--trend-down)" strokeWidth="3" strokeDasharray="6 4"/>}
    {show && kind==="anomaly" && <circle cx="150" cy="18" r="6" fill="var(--trend-up)"/>}
    {show && forecast && <><path d="M127 46L242 9V68Z" fill="var(--trend-down)" opacity=".38"/><path d="M127 46L242 38" stroke="var(--trend-down)" strokeWidth="2" strokeDasharray="4 3"/></>}
  </svg>{interactive && <><button aria-pressed={show} onClick={()=>setShow(!show)}>{show?"Hide":"Show"} {kind==="trend"?"trend line":kind==="anomaly"?"unusual point":"forecast band"}</button><p>{captions[kind]} Illustrative values over time.</p></>}</div>;
}
