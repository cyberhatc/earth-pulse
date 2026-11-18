"""Self-contained HTML visual report for a location dossier.

Used by GET /dossier/report. No JavaScript or external CSS is required to read
the report; charts are inline SVG so the page can be printed to PDF or archived
as a single file. Imagery thumbnails remain remote URLs (NASA GIBS / Planetary
Computer) and are labelled as links.
"""
from __future__ import annotations

import html
import math
from datetime import datetime
from typing import Any


def _esc(value: Any) -> str:
    return html.escape(str(value))


def _num(value: Any, digits: int = 3) -> str:
    try:
        f = float(value)
    except (TypeError, ValueError):
        return "—"
    if not math.isfinite(f):
        return "—"
    if abs(f) >= 1000:
        return f"{f:,.0f}"
    return f"{f:.{digits}f}"


def _signed(value: Any, digits: int = 3) -> str:
    try:
        f = float(value)
    except (TypeError, ValueError):
        return "—"
    if not math.isfinite(f):
        return "—"
    return f"{f:+.{digits}f}"


def _svg_chart(
    values: list[float | None],
    labels: list[str],
    *,
    width: int = 760,
    height: int = 220,
    color: str = "#0e5a63",
    band: tuple[list[float], list[float]] | None = None,
    unit: str = "",
    title: str = "",
) -> str:
    finite = [v for v in values if isinstance(v, (int, float)) and math.isfinite(v)]
    if band:
        for arr in band:
            finite += [v for v in arr if isinstance(v, (int, float)) and math.isfinite(v)]
    if len(finite) < 2:
        return f"<p class='muted'>No data for {_esc(title)}.</p>"

    pad_l, pad_r, pad_t, pad_b = 52, 14, 14, 28
    plot_w = width - pad_l - pad_r
    plot_h = height - pad_t - pad_b
    lo, hi = min(finite), max(finite)
    span = (hi - lo) or 1.0

    def x_of(i: int) -> float:
        return pad_l + (i / max(1, len(values) - 1)) * plot_w

    def y_of(v: float) -> float:
        return pad_t + (1 - (v - lo) / span) * plot_h

    parts: list[str] = []
    for frac in (0.0, 0.5, 1.0):
        y = pad_t + frac * plot_h
        val = hi - frac * span
        parts.append(
            f"<line x1='{pad_l}' y1='{y:.1f}' x2='{width - pad_r}' y2='{y:.1f}' "
            "stroke='#d6cebe' stroke-width='1' stroke-dasharray='2 4'/>"
        )
        parts.append(
            f"<text x='{pad_l - 8}' y='{y + 3:.1f}' text-anchor='end' "
            "font-size='10' fill='#756e64'>"
            f"{val:.2f}</text>"
        )

    if band:
        lower, upper = band
        up = [
            (i, upper[i])
            for i in range(min(len(upper), len(values)))
            if isinstance(upper[i], (int, float)) and math.isfinite(upper[i])
        ]
        down = [
            (i, lower[i])
            for i in range(min(len(lower), len(values)))
            if isinstance(lower[i], (int, float)) and math.isfinite(lower[i])
        ]
        if up and down:
            pts = " ".join(f"{x_of(i):.1f},{y_of(v):.1f}" for i, v in up)
            pts += " " + " ".join(
                f"{x_of(i):.1f},{y_of(v):.1f}" for i, v in reversed(down)
            )
            parts.append(f"<polygon points='{pts}' fill='{color}' opacity='0.14'/>")

    pts = [
        f"{x_of(i):.1f},{y_of(v):.1f}"
        for i, v in enumerate(values)
        if isinstance(v, (int, float)) and math.isfinite(v)
    ]
    if pts:
        parts.append(
            "<polyline points='" + " ".join(pts) + f"' fill='none' stroke='{color}' "
            "stroke-width='1.8'/>"
        )

    n = len(labels)
    for idx, i in enumerate((0, n // 2, n - 1)):
        anchor = "start" if idx == 0 else "end" if idx == 2 else "middle"
        label = labels[i] if 0 <= i < n else ""
        parts.append(
            f"<text x='{x_of(i):.1f}' y='{height - 8}' text-anchor='{anchor}' "
            f"font-size='10' fill='#756e64'>{_esc(label)}</text>"
        )

    svg = (
        f"<svg viewBox='0 0 {width} {height}' role='img' "
        f"aria-label='{_esc(title)}' style='width:100%;height:auto'>"
        + "".join(parts)
        + "</svg>"
    )
    caption = f"<div class='chart-caption'>{_esc(title)}"
    if unit:
        caption += f" · {_esc(unit)}"
    caption += "</div>"
    return f"<figure class='chart'>{svg}{caption}</figure>"


def _trend_table(trends: dict[str, dict], parameters: dict[str, dict]) -> str:
    rows = []
    for key, t in trends.items():
        label = parameters.get(key, {}).get("label", key)
        unit = parameters.get(key, {}).get("unit", "")
        sig = "yes" if t.get("significant") else "no"
        rows.append(
            "<tr>"
            f"<td>{_esc(label)}</td>"
            f"<td>{_signed(t.get('slope_per_decade'), 3)} {_esc(unit)}</td>"
            f"<td>{_num(t.get('p_value'), 4)}</td>"
            f"<td>{_esc(sig)}</td>"
            f"<td>{_esc(t.get('n', '—'))}</td>"
            "</tr>"
        )
    return (
        "<table><thead><tr><th>Parameter</th><th>Slope / decade</th>"
        "<th>p-value</th><th>Significant (α=0.05)</th><th>n</th></tr></thead>"
        "<tbody>" + "".join(rows) + "</tbody></table>"
    )


def render_dossier_html(d: dict) -> str:
    """Render the dossier payload as a printable HTML report."""
    loc = d.get("location", {})
    area = d.get("area", {})
    cov = d.get("coverage", {})
    params = d.get("parameters", {})
    mode = d.get("mode")
    start, end = (cov.get("time_range") or ["—", "—"])[:2]

    badges = [
        ("REAL NASA POWER" if mode == "point_real" else "GRID DEMO (SYNTHETIC)"),
        f"{d.get('forecast', {}).get('horizon_months', 60)}-month forecast",
        f"generated {d.get('provenance', {}).get('generated_utc', '')}",
    ]

    hist_dates = d.get("history", {}).get("dates", [])
    hist_series = d.get("history", {}).get("series", {})
    fc_dates = d.get("forecast", {}).get("dates", [])
    fc_ts = d.get("forecast", {}).get("timeseries", {})

    # annualise the observed history for a readable 40-year chart
    annual: dict[str, dict[str, list[float]]] = {}
    for p, series in hist_series.items():
        acc: dict[str, list[float]] = {}
        for i, v in enumerate(series):
            if i >= len(hist_dates):
                break
            if isinstance(v, (int, float)) and math.isfinite(v):
                acc.setdefault(hist_dates[i][:4], []).append(float(v))
        annual[p] = {y: sum(vs) / len(vs) for y, vs in acc.items()}

    charts: list[str] = []
    for p in (
        "temperature", "precipitation", "ndvi", "lst_day",
        "soil_moisture_surface", "aerosol_optical_depth", "pm2_5",
    ):
        if p not in annual or len(annual[p]) < 3:
            continue
        years = sorted(annual[p])
        label = params.get(p, {}).get("label", p)
        unit = params.get(p, {}).get("unit", "")
        charts.append(
            _svg_chart(
                [annual[p][y] for y in years],
                years,
                color="#0e5a63" if p != "precipitation" else "#1e40af",
                title=f"Observed annual mean — {label}",
                unit=unit,
            )
        )
    hist_html = "".join(charts) or "<p class='muted'>No observed series available.</p>"

    fc_charts: list[str] = []
    for p in ("temperature", "precipitation", "ndvi", "lst_day"):
        if p not in fc_ts:
            continue
        band = fc_ts[p]
        label = params.get(p, {}).get("label", p)
        unit = params.get(p, {}).get("unit", "")
        fc_charts.append(
            _svg_chart(
                band.get("mean", []),
                fc_dates,
                color="#b84214" if p == "temperature" else "#1e40af",
                band=(band.get("lower", []), band.get("upper", [])),
                title=f"Projected median with p10–p90 band — {label}",
                unit=unit,
            )
        )
    fc_html = "".join(fc_charts) or "<p class='muted'>No forecast series available.</p>"

    ml = d.get("ml", {})
    backtest = (ml.get("backtest") or {}).get("per_parameter", {})
    bt_rows = []
    for key, m in backtest.items():
        label = params.get(key, {}).get("label", key)
        bt_rows.append(
            "<tr>"
            f"<td>{_esc(label)}</td>"
            f"<td>{_num(m.get('mae'), 3)}</td>"
            f"<td>{_num(m.get('rmse'), 3)}</td>"
            f"<td>{_num(m.get('pinball'), 3)}</td>"
            f"<td>{_num(m.get('picp_p10_p90'), 3)}</td>"
            f"<td>{_num(m.get('persistence_mae'), 3)}</td>"
            f"<td>{_num(m.get('skill_vs_persistence'), 3)}</td>"
            "</tr>"
        )
    bt_html = (
        "<table><thead><tr><th>Parameter</th><th>MAE</th><th>RMSE</th>"
        "<th>Pinball</th><th>p10–p90 coverage</th><th>Persistence MAE</th>"
        "<th>Skill vs persistence</th></tr></thead><tbody>"
        + "".join(bt_rows)
        + "</tbody></table>"
        if bt_rows
        else "<p class='muted'>No backtest metrics available.</p>"
    )

    cc = d.get("cross_check", {})
    cc_rows = []
    for source, block in (cc.get("sources") or {}).items():
        if not isinstance(block, dict):
            continue
        for key, t in (block.get("trends") or {}).items():
            cc_rows.append(
                "<tr>"
                f"<td>{_esc(source)}</td>"
                f"<td>{_esc(params.get(key, {}).get('label', key))}</td>"
                f"<td>{_signed(t.get('slope_per_decade'), 3)} "
                f"{_esc(params.get(key, {}).get('unit', ''))}</td>"
                f"<td>{_num(t.get('p_value'), 4)}</td>"
                f"<td>{'yes' if t.get('significant') else 'no'}</td>"
                "</tr>"
            )
    gistemp = cc.get("gistemp") or {}
    if gistemp.get("available"):
        cc_rows.append(
            "<tr><td>NASA GISS GISTEMP v4 (global context)</td>"
            "<td>Global temperature anomaly</td>"
            f"<td>{_signed(gistemp.get('slope_per_decade'), 3)} °C</td>"
            f"<td>{_num(gistemp.get('p_value'), 4)}</td>"
            f"<td>{'yes' if gistemp.get('significant') else 'no'}</td></tr>"
        )
    cc_html = (
        "<table><thead><tr><th>Source</th><th>Parameter</th><th>Slope / decade</th>"
        "<th>p-value</th><th>Significant</th></tr></thead><tbody>"
        + "".join(cc_rows)
        + "</tbody></table>"
        if cc_rows
        else "<p class='muted'>No cross-check series available.</p>"
    )

    anomalies = d.get("anomalies", [])
    anomaly_html = (
        "<ul class='anomalies'>"
        + "".join(
            f"<li><strong>{_esc(a.get('date'))}</strong> · "
            f"{_esc(params.get(a.get('parameter'), {}).get('label', a.get('parameter')))} · "
            f"{_esc(a.get('kind'))} (z={_esc(a.get('z'))}, {_esc(a.get('severity'))})</li>"
            for a in anomalies[-12:]
        )
        + "</ul>"
        if anomalies
        else "<p class='muted'>No anomaly exceeds the robust-z threshold.</p>"
    )

    source_rows = []
    for s in d.get("sources", []):
        source_rows.append(
            "<tr>"
            f"<td><a href='{_esc(s.get('url'))}'>{_esc(s.get('name'))}</a></td>"
            f"<td>{_esc(s.get('role'))}</td>"
            f"<td><span class='status is-{_esc(s.get('status'))}'>{_esc(s.get('status'))}</span></td>"
            f"<td class='muted'>{_esc(s.get('note', ''))}</td>"
            "</tr>"
        )
    sources_html = (
        "<table><thead><tr><th>Source</th><th>Role</th><th>Status</th>"
        "<th>Note</th></tr></thead><tbody>"
        + "".join(source_rows)
        + "</tbody></table>"
    )

    gibs = d.get("imagery", {}).get("gibs", [])
    gibs_labels = d.get("imagery", {}).get("gibs_labels", {})
    # One representative frame per layer, newest first, keeps the printed report
    # compact while covering optical, temperature, atmosphere and soil groups.
    by_layer: dict[str, dict] = {}
    for g in gibs:
        by_layer.setdefault(g.get("layer"), g)
    order = [
        "true_color", "false_color", "viirs_true_color", "viirs_false_color",
        "ndvi", "evi", "lst_day", "lst_night", "viirs_lst_day",
        "snow", "ndsi", "viirs_ndsi", "snow_pct", "snow_mass",
        "snow_water_equivalent", "aerosol", "no2", "so2", "co",
        "precipitation", "soil_moisture", "gldas_air_temperature",
        "gldas_precipitation",
    ]
    shots = [by_layer[k] for k in order if k in by_layer]
    gallery = "".join(
        "<a class='shot' href='{u}'><img src='{u}' alt='{a}' loading='lazy'/>"
        "<span>{l} · {d}</span></a>".format(
            u=_esc(g.get("url")),
            a=_esc(f"{g.get('layer')} {g.get('date')}"),
            l=_esc(gibs_labels.get(g.get("layer"), g.get("layer"))),
            d=_esc(g.get("date")),
        )
        for g in shots
    )
    if not gallery:
        gallery = "<p class='muted'>Imagery references unavailable.</p>"

    links = d.get("imagery", {}).get("links", {})
    link_html = " · ".join(
        f"<a href='{_esc(url)}'>{_esc(name)}</a>"
        for name, url in (
            ("NASA Worldview", links.get("worldview")),
            ("Earthdata Search", links.get("earthdata_search")),
            ("NASA POWER API", links.get("power_api")),
            ("NASA FIRMS", links.get("firms")),
        )
        if url
    )

    # Parameter catalogue: grouped labels, units, native resolution/frequency and
    # how many months actually carry data. This is the honest inventory that
    # backs the charts above.
    pmeta = cov.get("parameter_meta") or {}
    cat_rows = []
    for group in d.get("parameter_groups", []):
        cat_rows.append(
            f"<tr><td colspan='6' style='background:#ede7da;font-weight:600'>"
            f"{_esc(group.get('name'))}</td></tr>"
        )
        for item in group.get("parameters", []):
            key = item.get("key")
            meta = pmeta.get(key) or {}
            n = meta.get("n")
            cat_rows.append(
                "<tr>"
                f"<td>{_esc(item.get('label', key))}</td>"
                f"<td>{_esc(item.get('unit', ''))}</td>"
                f"<td>{_esc(item.get('source', ''))}</td>"
                f"<td>{_esc(item.get('native', ''))}</td>"
                f"<td>{_esc(item.get('coverage', ''))}</td>"
                f"<td>{_esc(n if n is not None else '0')}</td>"
                "</tr>"
            )
    parameter_catalogue_html = (
        "<table><thead><tr><th>Parameter</th><th>Unit</th><th>Source</th>"
        "<th>Native frequency</th><th>Coverage</th><th>Months</th></tr></thead><tbody>"
        + "".join(cat_rows)
        + "</tbody></table>"
        if cat_rows
        else "<p class='muted'>No parameter catalogue available.</p>"
    )

    unavailable = d.get("requested_unavailable", {})
    unavail_rows = [
        "<tr>"
        f"<td>{_esc(v.get('label', k))}</td>"
        f"<td>{_esc(v.get('source', ''))}</td>"
        f"<td>{_esc(v.get('reason', ''))}</td>"
        "</tr>"
        for k, v in unavailable.items()
    ]
    unavailable_html = (
        "<table><thead><tr><th>Requested parameter</th><th>Source</th>"
        "<th>Why unavailable</th></tr></thead><tbody>"
        + "".join(unavail_rows)
        + "</tbody></table>"
        if unavail_rows
        else ""
    )

    warnings = d.get("warnings", [])
    warn_html = (
        "<ul class='warn'>" + "".join(f"<li>{_esc(w)}</li>" for w in warnings) + "</ul>"
        if warnings
        else ""
    )

    bbox = area.get("bbox")
    bbox_txt = (
        f"{bbox[0]:.4f}, {bbox[1]:.4f} → {bbox[2]:.4f}, {bbox[3]:.4f}"
        if isinstance(bbox, (list, tuple)) and len(bbox) == 4
        else "—"
    )

    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Earth Pulse dossier — {_esc(loc.get('lat'))}, {_esc(loc.get('lon'))}</title>
<style>
  :root {{ color-scheme: light; }}
  * {{ box-sizing: border-box; }}
  body {{ margin: 0; padding: 32px; background: #f7f3ea; color: #171614;
         font: 15px/1.55 "Plus Jakarta Sans", system-ui, sans-serif; }}
  .sheet {{ max-width: 1040px; margin: 0 auto; background: #fcfbf7;
            border: 1px solid #d6cebe; padding: 34px 38px 40px; }}
  h1 {{ font-family: Georgia, serif; font-weight: 500; margin: 0 0 4px; font-size: 30px; }}
  h2 {{ font-size: 15px; letter-spacing: .08em; text-transform: uppercase;
        margin: 30px 0 10px; padding-bottom: 6px; border-bottom: 1px solid #d6cebe;
        color: #0e5a63; }}
  .sub {{ color: #756e64; font: 12px/1.5 ui-monospace, monospace; margin: 0 0 14px; }}
  .badges {{ display: flex; flex-wrap: wrap; gap: 6px; margin: 10px 0 4px; }}
  .badge {{ font: 11px/1.4 ui-monospace, monospace; letter-spacing: .06em;
            text-transform: uppercase; border: 1px solid #d6cebe; padding: 3px 7px;
            background: #ede7da; color: #756e64; }}
  .badge.live {{ border-color: #0e5a63; color: #0e5a63; }}
  table {{ width: 100%; border-collapse: collapse; font-size: 13px; margin: 6px 0 8px; }}
  th, td {{ text-align: left; padding: 6px 8px; border-bottom: 1px solid #ede7da;
            vertical-align: top; }}
  th {{ font: 10px/1.3 ui-monospace, monospace; letter-spacing: .06em;
        text-transform: uppercase; color: #756e64; }}
  a {{ color: #0e5a63; }}
  .grid {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
           gap: 18px; }}
  .chart {{ margin: 10px 0 18px; }}
  .chart-caption {{ font: 11px/1.4 ui-monospace, monospace; color: #756e64;
                    margin-top: 4px; }}
  .muted {{ color: #756e64; }}
  .warn {{ border-left: 3px solid #b84214; background: #ede7da; padding: 8px 12px 8px 26px;
           font-size: 12.5px; color: #4e4a43; }}
  .anomalies {{ margin: 4px 0; padding-left: 18px; font-size: 13px; color: #4e4a43; }}
  .gallery {{ display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
              gap: 8px; }}
  .shot {{ display: block; border: 1px solid #d6cebe; text-decoration: none;
           font: 10px/1.4 ui-monospace, monospace; color: #756e64; background: #ede7da; }}
  .shot img {{ width: 100%; aspect-ratio: 1/1; object-fit: cover; display: block; }}
  .shot span {{ display: block; padding: 4px 6px; text-align: center; }}
  .status {{ font: 10px/1.3 ui-monospace, monospace; text-transform: uppercase;
             border: 1px solid #b6ac99; padding: 2px 5px; color: #756e64; }}
  .status.is-used {{ border-color: #0e5a63; color: #0e5a63; }}
  .status.is-context {{ border-color: #1e40af; color: #1e40af; }}
  .status.is-restricted {{ border-color: #b84214; color: #b84214; }}
  .kv {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
         gap: 10px; margin: 10px 0; }}
  .kv dt {{ font: 10px/1.3 ui-monospace, monospace; letter-spacing: .06em;
            text-transform: uppercase; color: #756e64; }}
  .kv dd {{ margin: 2px 0 0; font-size: 13.5px; }}
  footer {{ margin-top: 28px; padding-top: 12px; border-top: 1px solid #d6cebe;
            font-size: 11.5px; color: #756e64; }}
  .print {{ position: fixed; top: 14px; right: 16px; }}
  @media print {{
    body {{ padding: 0; background: #fff; }}
    .sheet {{ border: 0; padding: 0; }}
    .print {{ display: none; }}
    h2 {{ break-after: avoid; }}
    .chart, table {{ break-inside: avoid; }}
  }}
</style>
</head>
<body>
<button class="print" onclick="window.print()">Print / save PDF</button>
<div class="sheet">
  <h1>Earth Pulse — Location Dossier</h1>
  <p class="sub">{_esc(loc.get('lat'))}°, {_esc(loc.get('lon'))}° · region: {_esc(loc.get('region_slug') or '—')}
     · {_esc(start)}–{_esc(end)} · area ≈ {_esc(area.get('approx_km2', 100))} km²
     (10 × 10 km)</p>
  <div class="badges">
    <span class="badge {'live' if mode == 'point_real' else ''}">{_esc(badges[0])}</span>
    <span class="badge">{_esc(badges[1])}</span>
    <span class="badge">{_esc(badges[2])}</span>
  </div>
  {warn_html}

  <h2>Area of interest</h2>
  <dl class="kv">
    <div><dt>Bounding box</dt><dd>{_esc(bbox_txt)}</dd></div>
    <div><dt>Nominal size</dt><dd>{_esc(area.get('width_km', 10))} × {_esc(area.get('height_km', 10))} km</dd></div>
    <div><dt>Effective resolution</dt><dd>{_esc(area.get('resolution_note', '—'))}</dd></div>
    <div><dt>Parameters analysed</dt><dd>{_esc(', '.join(cov.get('parameters_used', []) or ['—']))}</dd></div>
  </dl>

  <h2>Summary</h2>
  <p>{_esc(d.get('explanation', {}).get('text', ''))}</p>

  <h2>Trend statistics (Theil–Sen / Mann–Kendall)</h2>
  {_trend_table(d.get('trends', {}), params)}

  <h2>Observed record</h2>
  {hist_html}

  <h2>ML forecast — ridge rollout with p10–p90 bands</h2>
  <p class="muted">Model: {_esc((d.get('forecast') or {}).get('model', '—'))} ·
     horizon {_esc((d.get('forecast') or {}).get('horizon_months', 60))} months ·
     {_esc((ml.get('backtest') or {}).get('origins', 0))} rolling origins.
     Bands are statistical projections, not observations or climate-model projections.</p>
  {fc_html}

  <h2>Backtest accuracy (rolling origin)</h2>
  {bt_html}

  <h2>Cross-check against independent sources</h2>
  {cc_html}

  <h2>Anomalies (rolling robust z ≥ 3)</h2>
  {anomaly_html}

  <h2>Satellite imagery</h2>
  <div class="gallery">{gallery}</div>
  <p class="sub">{link_html}</p>

  <h2>Parameter catalogue</h2>
  {parameter_catalogue_html}

  {("<h2>Requested but unavailable</h2>" + unavailable_html) if unavailable_html else ""}

  <h2>Data sources</h2>
  {sources_html}

  <footer>
    Generated by Earth Pulse on {_esc(datetime.utcnow().isoformat(timespec='seconds'))} UTC ·
    NASA POWER, NASA GIBS, NASA GISS, Open-Meteo (ERA5), Microsoft Planetary Computer.
    MODIS NDVI/EVI/LST/ET/GPP are read through the free Microsoft Planetary
    Computer mosaic point API; no Earthdata login is used. Restricted products
    (AppEEARS, GPM IMERG subsets, altimetry, NSIDC, FIRMS) are not fabricated
    here. Forecasts are statistical extrapolations with uncertainty, not climate
    projections.
  </footer>
</div>
</body>
</html>"""
