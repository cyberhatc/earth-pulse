import { useLayoutEffect, useRef, useState } from "react";

export interface TourStep { title: string; text: string; target: string; path?: string }
interface Props { steps: TourStep[]; index: number; move: (next: number) => void; close: () => void }

export function GuidedTour({ steps, index, move, close }: Props) {
  const step = steps[index];
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);
  useLayoutEffect(() => {
    const node = dialog.current!;
    node.showModal();
    return () => node.close();
  }, []);
  useLayoutEffect(() => {
    heading.current?.focus({ preventScroll: true });
    let target: HTMLElement | null = null;
    let timer = 0;
    function measure() {
      const candidate = document.querySelector<HTMLElement>(step.target);
      if (candidate && candidate !== target) {
        candidate.scrollIntoView({block:"center",behavior:"instant"});
      }
      target = candidate;
      const bounds = target?.getBoundingClientRect();
      setRect(bounds && bounds.width && bounds.height ? bounds : null);
    }
    function schedule() { cancelAnimationFrame(timer); timer = requestAnimationFrame(measure); }
    measure();
    const observer = new MutationObserver(schedule);
    observer.observe(document.getElementById("main-content")!, {childList:true,subtree:true});
    document.addEventListener("scroll",schedule,true);
    window.addEventListener("resize",schedule);
    return () => {
      cancelAnimationFrame(timer); observer.disconnect();
      document.removeEventListener("scroll",schedule,true); window.removeEventListener("resize",schedule);
    };
  }, [step]);
  const top = rect && rect.top > window.innerHeight / 2;
  return <dialog ref={dialog} className="tour-stage" aria-labelledby="tour-title" onCancel={event => {event.preventDefault();close();}}>
    {rect && <div className="tour-highlight" style={{top:rect.top,left:rect.left,width:rect.width,height:rect.height}} />}
    <section className={"learn-panel tour-panel " + (top ? "tour-top" : "tour-bottom")}>
      <small>Step {index+1} of {steps.length}</small>
      <h2 id="tour-title" ref={heading} tabIndex={-1}>{step.title}</h2><p>{step.text}</p>
      {!rect && <p role="status">This view is loading or unavailable. You can continue the guide.</p>}
      <div className="tour-actions"><button onClick={close}>Skip tour</button>
      <button disabled={index===0} onClick={() => move(index-1)}>Back</button>
      <button onClick={() => index+1===steps.length ? close() : move(index+1)}>{index+1===steps.length ? "Finish" : "Next"}</button></div>
    </section>
  </dialog>;
}
