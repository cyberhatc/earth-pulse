import type { TourStep } from "../components/GuidedTour";
export const landingGuide: TourStep[] = [
  {target:"#hero .l-actions",title:"Start with a place",text:"Explore Earth Pulse opens a map of three case studies."},
  {target:"#regions .l-region-case",title:"Compare three coasts",text:"Each case file pairs a landscape with a question you can investigate."},
  {target:"#signals .l-signal-controls",title:"Read the layers",text:"Toggle the trend, anomaly and forecast in the teaching chart. The numbers here are illustrative."},
  {target:"#methods .l-method-card",title:"Look inside the method",text:"Open Method details to see how the calculation works and where its assumptions matter."},
  {target:"#earthpedia-preview h2",title:"Keep learning",text:"Select a term to open its EarthPedia article, or use Help on any page."},
];
export function getPageGuide(path: string): TourStep[] {
  if (path === "/") return landingGuide;
  if (path === "/earthpedia") return [
    {target:".learn-filters input", title:"Search in your own words",text:"Try rainfall or unusual measurement. The result count updates as you type."},
    {target:".learn-filters select",title:"Narrow the subject",text:"Choose one topic to filter the current search. Open a result to read its article."},
  ];
  return [{target:"#main-content main",title:"Explore this view",text:"Review the location and source labels. Open Help whenever you need a scientific definition."}];
}
