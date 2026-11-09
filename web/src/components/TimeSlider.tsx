interface Props {
  year: number
  min?: number
  max?: number
  onChange: (year: number) => void
}

export default function TimeSlider({ year, min = 1985, max = 2035, onChange }: Props) {
  return (
    <div className="overlay-card time-slider">
      <div className="row">
        <label htmlFor="time-slider">Time</label>
        <output htmlFor="time-slider">{year}</output>
      </div>
      <input
        id="time-slider"
        type="range"
        min={min}
        max={max}
        step={1}
        value={year}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-valuetext={String(year)}
      />
    </div>
  )
}
