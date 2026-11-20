"use client";

import { useEffect, useRef } from "react";
import type * as LeafletTypes from "leaflet";
import { useNavigate } from "react-router-dom";
import type { Region } from "../lib/types";
import { getVariable } from "../lib/data";
import { formatSlope } from "../lib/trend";
import type { LiveAnalysis } from "../lib/live";

type LocationsMapProps = {
  regions: Region[];
  analyses: Record<string, LiveAnalysis | undefined>;
  onSelect: (region: Region) => void;
};

export function LocationsMap({ regions, analyses, onSelect }: LocationsMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletTypes.Map | null>(null);
  const leafletRef = useRef<typeof LeafletTypes | null>(null);
  const navigate = useNavigate();
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  useEffect(() => {
    let cancelled = false;

    async function init() {
      const L = await import("leaflet");
      if (cancelled || !containerRef.current) return;
      leafletRef.current = L;

      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }

      // Fit all 3 regions with padding
      const allBounds = L.latLngBounds(
        regions.flatMap((r) => [L.latLng(r.bounds[0][0], r.bounds[0][1]), L.latLng(r.bounds[1][0], r.bounds[1][1])]),
      );

      const map = L.map(containerRef.current, {
        scrollWheelZoom: true,
        zoomControl: true,
        attributionControl: true,
      });
      mapRef.current = map;

      const primaryTiles = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
        crossOrigin: true,
      });
      const fallbackTiles = L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
        {
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
          subdomains: "abcd",
          maxZoom: 19,
        },
      );

      primaryTiles.addTo(map);
      let switched = false;
      primaryTiles.on("tileerror", () => {
        if (switched || cancelled) return;
        switched = true;
        if (map.hasLayer(primaryTiles)) map.removeLayer(primaryTiles);
        fallbackTiles.addTo(map);
      });

      map.fitBounds(allBounds.pad(0.18));
      // Ensure correct sizing after layout/paint (common Leaflet issue in dynamic containers)
      map.whenReady(() => {
        if (!cancelled && mapRef.current) mapRef.current.invalidateSize();
      });
      setTimeout(() => {
        if (!cancelled && mapRef.current) mapRef.current.invalidateSize();
      }, 0);
      setTimeout(() => {
        if (!cancelled && mapRef.current) mapRef.current.invalidateSize();
      }, 250);
      requestAnimationFrame(() => {
        if (!cancelled && mapRef.current) mapRef.current.invalidateSize();
      });

      regions.forEach((region) => {
        const variable = getVariable(region.variable);
        const analysis = analyses[region.slug];
        const stats = analysis?.stats;
        const trend = stats ? formatSlope(stats) : "trend loading…";
        const sig = stats ? (stats.significant ? "significant" : "not significant") : "";
        const status = analysis?.status ?? "loading";
        const source = analysis?.sourceLabel ?? "Connecting";
        const color = region.trendShape === "up" ? "var(--trend-up)" : "var(--trend-down)";
        const accent = "var(--accent)";

        // Subtle bounds rectangle for context
        L.rectangle(region.bounds, {
          color,
          weight: 1.5,
          opacity: 0.55,
          fillColor: color,
          fillOpacity: 0.07,
          interactive: false,
        }).addTo(map);

        const marker = L.circleMarker(region.center, {
          radius: 11,
          color: "#ffffff",
          weight: 3,
          fillColor: color,
          fillOpacity: 0.95,
        }).addTo(map);

        const popupHtml = `
          <div style="min-width:230px;font-family:system-ui,-apple-system,Segoe UI,sans-serif;line-height:1.4;border-radius:12px;overflow:hidden;box-shadow:0 20px 50px rgba(0,0,0,0.45),0 0 0 1px rgba(255,255,255,0.06);background:linear-gradient(180deg,rgba(10,10,10,0.92),rgba(5,5,5,0.96));border:1px solid rgba(215,210,198,0.25);color:#f2f0ea">
            <div style="padding:10px 12px 8px;border-bottom:1px solid rgba(215,210,198,0.2);display:flex;align-items:center;justify-content:space-between;gap:8px">
              <div style="font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:#d7d2c6;font-weight:700">${region.plate}</div>
              <span style="display:inline-flex;align-items:center;gap:6px;width:8px;height:8px;border-radius:50%;background:${color};box-shadow:0 0 10px ${color}"></span>
            </div>
            <div style="padding:10px 12px">
              <div style="font-size:15px;font-weight:700;color:#ffffff;margin-bottom:3px">${region.name}</div>
              <div style="font-size:11.5px;color:rgba(242,240,234,0.7);margin-bottom:7px">${region.area} · ${region.climate}</div>
              <div style="font-size:12px;color:#ffffff;margin-bottom:2px"><strong>${variable.shortName}:</strong> <span style="color:${color}">${trend}</span>${sig ? ` · <span style="color:#d7d2c6">(${sig})</span>` : ""}</div>
              <div style="font-size:11px;color:rgba(242,240,234,0.55);margin-bottom:9px">${source} · ${status === "live" ? "live backend" : status === "demo" || status === "partial" ? "demo fallback" : status}</div>
              <div style="font-size:11px;color:rgba(242,240,234,0.8);margin-bottom:10px">${region.teaser}</div>
              <button data-open-region="${region.slug}" style="display:inline-flex;align-items:center;justify-content:center;padding:7px 11px;border-radius:8px;border:1px solid rgba(215,210,198,0.45);background:${accent};color:#050505;font-weight:700;cursor:pointer">Inspect location →</button>
            </div>
          </div>`;
        marker.bindPopup(popupHtml, { closeButton: true, maxWidth: 320 });
        marker.bindTooltip(`<strong>${region.name}</strong><br/><span style="font-size:12px">${variable.shortName}: ${trend}</span>`, {
          direction: "top",
          offset: [0, -8],
          opacity: 0.95,
        });

        marker.on("click", (e) => {
          // Navigate directly on marker click (popup button remains as an additional affordance)
          L.DomEvent.stopPropagation(e);
          onSelectRef.current(region);
          navigate(`/region/${region.slug}`);
        });

        marker.on("popupopen", () => {
          const btn = document.querySelector(`[data-open-region="${region.slug}"]`) as HTMLButtonElement | null;
          if (btn) {
            btn.onclick = () => {
              onSelectRef.current(region);
              navigate(`/region/${region.slug}`);
            };
          }
        });
      });

      map.on("click", () => {
        map.closePopup();
      });
    }

    init();

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [
    regions.map((r) => r.slug).join("|"),
    regions.map((r) => {
      const a = analyses[r.slug];
      return `${r.slug}:${a?.status ?? "none"}:${a?.stats?.slope ?? ""}:${a?.sourceLabel ?? ""}`;
    }).join("|"),
  ]);

  // Update tooltips/popups content when analyses arrive? simple approach: rebuild not necessary now;
  // markers capture initial analyses snapshot; acceptable as previews load quickly and click still works.
  // For better UX we could store markers in ref and update - skip for brevity.

  return (
    <div
      ref={containerRef}
      className="locations-map"
      style={{ width: "100%", minHeight: 360 }}
      aria-label="Map of 3 case-study locations"
    />
  );
}
