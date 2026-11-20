import { useRef, useState } from "react";
import { GuidedTour } from "./GuidedTour";
import type { TourStep } from "./GuidedTour";
import { getPageGuide } from "../lib/pageGuides";
import { Link, useLocation } from "react-router-dom";
import "../styles/help.css";

export function GlobalHelp() {
  const dialog = useRef<HTMLDialogElement>(null);
  const { pathname } = useLocation();
  const [steps, setSteps] = useState<TourStep[]>([]);
  const [index, setIndex] = useState(0);
  function start(guide: TourStep[]) {
    dialog.current?.close();
    setIndex(0);
    setSteps(guide);
  }
  return <>
    <button className="help-launch" onClick={() => dialog.current?.showModal()} aria-haspopup="dialog">? Help</button>
    <dialog ref={dialog} className="learn-panel help-menu" aria-labelledby="help-heading">
      <button className="help-close" onClick={() => dialog.current?.close()} aria-label="Close help">×</button>
      <small>EarthPulse field guide</small><h2 id="help-heading">How can we help?</h2>
      <p>{pathname.startsWith("/region") ? "Investigate one place at a time. Check the data label before comparing its charts." : "Explore the map, read the evidence or look up the science behind a result."}</p>
      <div className="help-options"><button onClick={() => start(getPageGuide(pathname))}>Start page tutorial</button>
      <Link to="/earthpedia" onClick={() => dialog.current?.close()}>Open EarthPedia</Link></div>
      <h3>Frequently asked questions</h3>
      <details><summary>Are the demo values measured?</summary><p>The offline sample is synthetic. Check the source and coverage labels for the active investigation.</p></details>
      <details><summary>Why is a reading missing?</summary><p>Location, date, cloud cover and the source product can limit coverage. A missing value is different from zero.</p></details>
      <details><summary>How certain is a forecast?</summary><p>The center line is a model estimate. Read the uncertainty band and the forecast horizon together.</p></details>
    </dialog>
    {steps.length > 0 && <GuidedTour steps={steps} index={index} move={setIndex} close={() => setSteps([])} />}
  </>;
}
