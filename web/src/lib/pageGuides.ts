import type { TourStep } from "../components/GuidedTour";
export const landingGuide: TourStep[] = [
  {target:"#hero .l-actions",title:"Start with a place",text:"Explore Earth Pulse opens a map of three case studies."},
  {target:"#regions .l-region-case",title:"Compare three coasts",text:"Each case file pairs a landscape with a question you can investigate."},
  {target:"#signals .l-signal-controls",title:"Read the layers",text:"Toggle the trend, anomaly and forecast in the teaching chart. The numbers here are illustrative."},
  {target:"#methods .l-method-card",title:"Look inside the method",text:"Open Method details to see how the calculation works and where its assumptions matter."},
  {target:"#earthpedia-preview h2",title:"Keep learning",text:"Select a term to open its EarthPedia article, or use Help on any page."},
];
export function getPageGuide(path: string): TourStep[] {
  if (path === "/regions") return [
    {"target":".locations-map-frame","title":"Choose a location","text":"Zoom the map and select a case-study marker, or use a region card below."},
    {"target":".locations-map-legend","title":"Read the marker key","text":"Direction refers to the primary variable. The source label tells you which record supports it."},
    {"target":".region-card","title":"Open a case file","text":"Each card names the variable and shows its slope and source. Select a card to investigate."},
  ];
  if (path.endsWith("/map")) return [
    {"target":".map-rail","title":"Check the layer","text":"Read the selected variable, units and source before comparing locations."},
    {"target":".map-canvas","title":"Select a point","text":"Click the map to choose coordinates within the study area."},
    {"target":".point-panel","title":"Inspect the point","text":"The selected point panel offers a dossier and discussion when a location is selected."},
  ];
  if (path === "/trend" || path === "/report") return [
    {"target":".trend-controls select","title":"Choose a measure","text":"Select a variable to compare cell slopes across the global grid."},
    {"target":".trend-status","title":"Check availability","text":"Read the data status before interpreting the summary."},
    {"target":".kpi-strip","title":"Read the summary","text":"Mean slope and the number of significant cells describe different aspects of the pattern."},
  ];
  if (path.startsWith("/region/") && path.split("/").length === 3) return [
    {"target":".hub-title","title":"Orient yourself","text":"Confirm the place before interpreting its record."},
    {"target":".detail-canvas","title":"Read the evidence","text":"Look at the dates and units on the historical record."},
    {"target":".insight-grid","title":"Investigate a contrast","text":"Unusual months and neighboring differences suggest questions for follow-up."},
    {"target":".coverage-callouts","title":"Check the source","text":"Read which values are observed, modeled, missing or synthetic."},
  ];
  if (path === "/") return landingGuide;
  if (path === "/earthpedia") return [
    {target:".learn-filters input", title:"Search in your own words",text:"Try rainfall or unusual measurement. The result count updates as you type."},
    {target:".learn-filters select",title:"Narrow the subject",text:"Choose one topic to filter the current search. Open a result to read its article."},
  ];
  return [{target:"#main-content main",title:"Explore this view",text:"Review the location and source labels. Open Help whenever you need a scientific definition."}];
}
