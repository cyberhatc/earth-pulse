import type { TourStep } from "../components/GuidedTour";

export function beginnerGuide(region: string, topic: string): TourStep[] {
  const hub = "/region/" + region;
  const report = hub + "/report";
  return [
    {path:"/",target:"#hero h1",title:"Welcome to EarthPulse",text:"Follow a question from a place on the map to the evidence behind a result."},
    {path:"/earthpedia/"+topic,target:".learn-page header",title:"Meet your measure",text:"Read the unit and physical meaning of your topic before looking for change. The regional report can include several variables."},
    {path:"/regions",target:".locations-map-frame",title:"Locate the study regions",text:"Markers identify case studies. Next opens the region you selected."},
    {path:report,target:"#report-s1",title:"Explore historical observations",text:"Read time from left to right. Check the vertical scale, unit and source label."},
    {path:report,target:"#report-s2",title:"Understand the trend",text:"The slope estimates direction and rate. A short fluctuation can differ from the longer trend."},
    {path:report,target:"#report-s6",title:"Investigate unusual months",text:"A flagged reading differs from its baseline. Some records have no flagged months."},
    {path:report,target:"#report-s4",title:"Look ahead",text:"The forecast horizon sets how far the model looks into the future."},
    {path:"/",target:"#signals .l-signal-chart",title:"Understand uncertainty",text:"In this illustrative chart P50 marks the middle estimate. P10 and P90 bound the model’s central range."},
    {path:hub,target:".insight-grid",title:"Compare nearby places",text:"Opposite trends and climate twins offer leads when comparisons are available."},
    {path:"/earthpedia/anomaly",target:".learn-page header",title:"Learn the science",text:"Each concept connects a short explanation to an example and a scientific reference."},
    {path:hub,target:".coverage-callouts",title:"Check the data",text:"Separate observations, model results, synthetic demo records and illustrative imagery before reporting a finding."},
    {path:"/regions",target:".region-grid",title:"Start your own investigation",text:"Finish to choose a regional case file. Help can restart this journey or open EarthPedia at any time."},
  ];
}
