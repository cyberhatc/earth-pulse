"""GET /place — the unified on-click payload."""
from __future__ import annotations

import numpy as np
from fastapi import APIRouter, Query, HTTPException

from api.deps import get_store, get_analysis, ANALYSIS_PATH
from api.services import store as svc
from api.services import ondemand, explainer
from models.infer import forecast_place
from models.anomaly import anomalies_for_cell

router = APIRouter()


def r3(x: float) -> float:
    return round(float(x), 3)


@router.get("/place")
def place(lat: float = Query(..., ge=-90, le=90),
          lon: float = Query(..., ge=-180, le=180),
          horizon_months: int = Query(60, ge=3, le=240)):
    try:
        store = get_store()
        analysis = get_analysis()
    except Exception as exc:
        raise HTTPException(503, detail=str(exc))

    cell, glat, glon = svc.nearest(store, lat, lon)

    # ---- per-parameter availability at this cell (land/ocean mask honesty) ----
    finite_counts = {p: int(np.isfinite(store[p][:, cell]).sum()) for p in svc.TS_PARAMS}
    usable = [p for p, n in finite_counts.items() if n >= 12]
    dropped = [p for p, n in finite_counts.items() if n < 12]
    ocean_mask = store.get("ocean_mask")
    is_ocean_cell = bool(ocean_mask[cell] == 1) if ocean_mask is not None else None

    dates, ts = svc.past_timeseries(store, cell, usable)
    # fill interior gaps so charts/JSON stay valid; record raw coverage in data_coverage
    from pipeline.clean import fill_missing_linear
    ts = {p: [round(float(v), 3) for v in fill_missing_linear(store[p][:, cell])] for p in usable}
    time_range = [dates[0], dates[-1]]
    meta = store.get("meta", {})
    synthetic = bool(meta.get("synthetic", True))

    # trends at nearest cell
    trends = {}
    for p in svc.TS_PARAMS:
        rec = svc.trend_for(analysis, p, cell)
        if rec:
            trends[p] = {
                "slope_per_decade": r3(rec["slope_per_decade"]),
                "p_value": round(float(rec["p_value"]), 4),
                "significant": bool(rec["significant"]),
                "direction": rec["direction"],
                "n": int(rec["n"]),
            }

    # forecast (trained ridge artifact if present, else linear trend + season baseline)
    fc = forecast_place(store, cell, horizon_months, variables=usable)
    # rolling-origin backtest on nearest cell (populates payload.backtest as documented)
    try:
        from pipeline.build_features import prepare_cell_matrix
        from models.backtest import backtest_cell
        _, Xbt = prepare_cell_matrix(store, cell, list(fc["timeseries"].keys()))
        bt = backtest_cell(Xbt, list(fc["timeseries"].keys()), seq_len=24, test_months=12, horizon=12)
        pv = list(bt["per_parameter"].values())
        mae = sum(d["mae"] for d in pv) / len(pv)
        rmse = sum(d["rmse"] for d in pv) / len(pv)
        picp = sum(d["picp_p10_p90"] for d in pv) / len(pv)
        backtest_out = {
            "mae": round(mae, 3),
            "rmse": round(rmse, 3),
            "picp_p10_p90": round(picp, 3),
            "per_parameter": {
                p: {
                    "mae": round(float(d["mae"]), 3),
                    "rmse": round(float(d["rmse"]), 3),
                    "picp_p10_p90": round(float(d["picp_p10_p90"]), 3),
                    "bias": round(float(d.get("bias", 0)), 3),
                }
                for p, d in bt["per_parameter"].items()
            },
            "note": "ridge vs prefix, horizon 12; top-level metrics average all parameters",
        }
    except Exception as e:
        backtest_out = None
        raise e
    fc_timeseries = {
        p: {"mean": [r3(v) for v in d["mean"]],
            "lower": [r3(v) for v in d["lower"]],
            "upper": [r3(v) for v in d["upper"]]}
        for p, d in fc["timeseries"].items()
    }
    issued = fc["dates"][0]
    horizon_years = horizon_months // 12
    years_ahead = [int(fc["dates"][min(len(fc["dates"]) - 1, 24 * k)][:4]) for k in (1, max(1, horizon_years))]
    projected_images = [
        {"date": str(y), "parameter": "temperature",
         "url": f"/imagery/projected?parameter=temperature&year={y}",
         "label": "Model-projected (Theil–Sen extrapolation) — not an observation"}
        for y in sorted(set(years_ahead))
    ]

    anomalies = anomalies_for_cell(store, cell, ["temperature", "precipitation", "ndvi"], window=61, threshold=3.5)
    for a in anomalies:
        a["z"] = r3(a["z"])
    # Optional Isolation Forest for multivariate tabular anomalies (configs/model.yaml)
    try:
        from sklearn.ensemble import IsolationForest
        import yaml
        cfg = yaml.safe_load(open('configs/model.yaml', 'r', encoding='utf-8')) or {}
        if_cfg = (cfg.get('anomaly', {}) or {}).get('isolation_forest', {})
        if if_cfg.get('enabled'):
            # build matrix of past timeseries for usable params
            usable_params = list(ts.keys())
            Xmat = np.column_stack([np.nan_to_num(store[p][:, cell], nan=0.0) for p in usable_params])
            # standardize
            mu = Xmat.mean(axis=0)
            std = Xmat.std(axis=0)
            std = np.where(std == 0, 1.0, std)
            Xs = (Xmat - mu) / std
            clf = IsolationForest(contamination=float(if_cfg.get('contamination', 0.02)), random_state=42)
            labels = clf.fit_predict(Xs)
            scores = clf.decision_function(Xs)
            for idx, (lab, score) in enumerate(zip(labels, scores)):
                if lab == -1:
                    d = dates[idx]
                    anomalies.append({'parameter': 'multivariate', 'date': d, 'z': round(float(score), 3),
                                      'severity': 'high', 'kind': 'high'})
    except Exception:
        pass

    anomaly_count = len(anomalies)
    anomalies = anomalies[-20:]


    opposite = svc.opposite_near(analysis, cell, limit=4)
    for o in opposite:
        o["note"] = "Neighboring cells trending in opposite directions — inspect local drivers (land use, irrigation, orography, microclimate)."

    twin = svc.twin_label(analysis, cell)
    gibs = ondemand.gibs_past(glat, glon)

    relevance = {
        "sst": "ocean" if is_ocean_cell else ("land" if is_ocean_cell is not None else "unknown"),
        "sea_level": "ocean" if is_ocean_cell else ("land" if is_ocean_cell is not None else "unknown"),
        "ndvi": "land" if is_ocean_cell is not None and not is_ocean_cell else ("ocean" if is_ocean_cell else "unknown"),
    }
    data_coverage = {
        "synthetic_demo": synthetic,
        "parameters_used": usable,
        "parameters_unavailable": dropped,
        "ocean_cell": is_ocean_cell,
        "parameter_relevance": relevance,
        "sources": {k: v for k, v in svc.source_map(synthetic).items() if k in usable},
        "time_range": time_range,
        "overlap_used_for_training": ["2000-01", dates[-1]],
        "gap_notes": (
            (["Bundled demo uses a deterministic SYNTHETIC store - replace with real products (docs/data-sources.md) for research use."]
             if synthetic else
             ["Served from real NASA POWER monthly data (1981 to present). NDVI/SST/sea level are not available from POWER and are intentionally NaN - never faked."])
            + [
                "NDVI/SST/sea level records start later than 1985 in reality (approx 2000/2002/1993 respectively).",
                "Sea level & SST are ocean parameters; NDVI is a land parameter. Shown only where relevant." if is_ocean_cell is not None else "",
                (f"Parameters unavailable at this cell (masked or non-finite): {', '.join(dropped)}" if dropped else ""),
            ]),

        "notes": "Tier A: served from precomputed store + engine artifacts. Tier B (POWER/FIRMS/CMR) is opt-in via /tier-b and cached in data/cache/.",
    }
    data_coverage["gap_notes"] = [n for n in data_coverage["gap_notes"] if n]

    forecast_temps = fc_timeseries.get("temperature", {}).get("mean", [])
    deltas = {}
    if forecast_temps:
        deltas["temperature"] = r3(forecast_temps[-1] - forecast_temps[0])
        deltas["precipitation"] = r3((fc_timeseries["precipitation"]["mean"][-1] - fc_timeseries["precipitation"]["mean"][0])) if "precipitation" in fc_timeseries else None
        deltas["ndvi"] = r3((fc_timeseries["ndvi"]["mean"][-1] - fc_timeseries["ndvi"]["mean"][0])) if "ndvi" in fc_timeseries else None

    facts = {
        "lat": lat, "lon": lon, "grid_lat": glat, "grid_lon": glon,
        "time_range": time_range, "trends": trends, "forecast_deltas": deltas,
        "forecast_model": fc.get("model"),
        "forecast_window": [fc["dates"][0], fc["dates"][-1]] if fc.get("dates") else [],
        "horizon_months": horizon_months,
        "anomalies_count": anomaly_count,
        "anomaly_samples": anomalies[-5:],
        "opposite_count": len(opposite),
        "opposite_parameters": sorted({o.get("parameter") for o in opposite if o.get("parameter")}),
        "parameters_used": usable,
        "parameters_unavailable": dropped,
        "synthetic": synthetic,
    }
    explanation = explainer.explain(facts)

    return {
        "schema_version": "1.0.0",
        "location": {"lat": lat, "lon": lon, "cell_index": int(cell), "grid_lat": r3(glat), "grid_lon": r3(glon), "name": None},
        "data_coverage": data_coverage,
        "past": {
            "dates": dates,
            "timeseries": ts,
            "imagery": gibs,
            "anomalies": anomalies,
        },
        "trends": trends,
        "forecast": {
            "horizon_months": horizon_months,
            "issued": issued,
            "model": fc["model"],
            "trained_artifact": bool(fc.get("artifact")),
            "artifact": fc.get("artifact"),
            "dates": fc["dates"],
            "timeseries": fc_timeseries,
            "backtest": backtest_out,
            "projected_images": projected_images,
            "scenarios": [],
        },
        "opposite_trends": opposite,
        "climate_twin": twin,
        "explanation": explanation,
    }
