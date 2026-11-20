import type { TourStep } from "../components/GuidedTour";
export const landingGuide: TourStep[] = [
  {target:"#hero .l-actions",title:"Start with a place",text:"Explore Earth Pulse opens a map of three case studies."},
  {target:"#regions .l-region-case",title:"Compare three coasts",text:"Each case file pairs a landscape with a question you can investigate."},
  {target:"#signals .l-signal-controls",title:"Read the layers",text:"Toggle the trend, anomaly and forecast in the teaching chart. The numbers here are illustrative."},
  {target:"#methods .l-method-card",title:"Look inside the method",text:"Open Method details to see how the calculation works and where its assumptions matter."},
  {target:"#earthpedia-preview h2",title:"Keep learning",text:"Select a term to open its EarthPedia article, or use Help on any page."},
];
export function getPageGuide(path: string): TourStep[] {
  if (path.startsWith("/region/") && path.endsWith("/report")) return [
    {"target":"#report-s1","title":"Read the monthly record","text":"Time runs along the horizontal axis. Check the vertical unit and hover for values."},
    {"target":"#report-s2","title":"Compare trends","text":"Direction and rate summarize the record. Check which measure and unit each slope uses."},
    {"target":"#report-s4","title":"Read a forecast","text":"Look for the middle estimate and outer uncertainty band. Their dates are in the future."},
    {"target":"#report-s5","title":"Check past performance","text":"A backtest compares forecasts with later known values."},
    {"target":"#report-s6","title":"Find an unusual month","text":"A large departure is a lead to investigate; it cannot establish a cause."},
  ];
  if (path.endsWith("/visualizations")) return [
    {"target":".page-title","title":"Visual investigation","text":"Confirm the active region before reading the charts."},
    {"target":".viz-chart-wrap","title":"Read a chart","text":"Check the axes and legend. Compare the historical record with derived trends."},
    {"target":".imagery-grid","title":"Check image labels","text":"Look for the observation date and whether an image is projected."},
  ];
  if (path.endsWith("/chat")) return [
    {"target":".chat-suggestions","title":"Try a question","text":"Suggested prompts can help you ask about evidence for this region."},
    {"target":".chat-composer","title":"Ask in your own words","text":"Review a question before sending it. The tour does not submit messages."},
  ];
  if (path.endsWith("/notebook")) return [
    {"target":".notebook-title","title":"Your regional case file","text":"Keep the selected place in view as you review its evidence."},
    {"target":".card","title":"Inspect the evidence","text":"Read the card title and units before comparing records."},
  ];
  if (path.endsWith("/point")) return [
    {"target":".notebook-title","title":"Check the selected coordinates","text":"This dossier concerns one location and the sources available there."},
    {"target":".rail-caption","title":"Interpret the record","text":"Read the product and coverage notes before using a point estimate."},
  ];
  if (path.endsWith("/videos")) return [
    {"target":".page-title","title":"Read imagery in context","text":"Look at the dates and provenance for each sequence."},
    {"target":"main section h2","title":"Distinguish reference and projection","text":"Observed imagery and model-generated frames answer different questions."},
  ];
  if (path.startsWith("/earthpedia/")) return [
    {"target":".learn-page header","title":"Start with the idea","text":"The first paragraph introduces the scientific term."},
    {"target":".learn-page ul","title":"Follow a related concept","text":"The article includes a scientific reference and links to related terms."},
  ];
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
