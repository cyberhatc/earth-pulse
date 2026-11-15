export function ScrollIndicator() {
  return (
    <div className="l-scroll-indicator" aria-hidden="true">
      <div className="line">
        <span className="dot" data-anime="scroll-dot" />
      </div>
      <span>Scroll</span>
    </div>
  );
}
