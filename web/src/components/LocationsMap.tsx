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
        const color = region.trendShape === "up" ? "#b44318" : "#1e40af";

        // Subtle bounds rectangle for context
        L.rectangle(region.bounds, {
          color,
          weight: 1.25,
          opacity: 0.5,
          fillColor: color,
          fillOpacity: 0.06,
          interactive: false,
        }).addTo(map);

        const marker = L.circleMarker(region.center, {
          radius: 10,
          color: "#ffffff",
          weight: 3,
          fillColor: color,
          fillOpacity: 0.95,
        }).addTo(map);

        const popupHtml = `
          <div style="min-width:220px;font-family:system-ui,-apple-system,Segoe UI,sans-serif;line-height:1.35">
            <div style="font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#5b6470;margin-bottom:4px">${region.plate} · ${region.bboxLabel}</div>
            <div style="font-size:16px;font-weight:700;color:#111827;margin-bottom:4px">${region.name}</div>
            <div style="font-size:12.5px;color:#374151;margin-bottom:6px">${region.area} · ${region.climate}</div>
            <div style="font-size:12.5px;color:#111827;margin-bottom:2px"><strong>${variable.shortName}:</strong> ${trend}${sig ? ` (${sig})` : ""}</div>
            <div style="font-size:11.5px;color:#6b7280;margin-bottom:8px">${source} · ${status === "live" ? "live data" : status === "demo" || status === "partial" ? "demo fallback" : status}</div>
            <div style="font-size:11.5px;color:#374151;margin-bottom:8px">${region.teaser}</div>
            <button data-open-region="${region.slug}" style="display:inline-flex;align-items:center;justify-content:center;padding:7px 10px;border-radius:8px;border:1px solid #0e5a63;background:#0e5a63;color:#fff;font-weight:600;cursor:pointer">Inspect location →</button>
          </div>`;
        marker.bindPopup(popupHtml, { closeButton: true, maxWidth: 320 });
        marker.bindTooltip(`<strong>${region.name}</strong><br/><span style="font-size:12px">${variable.shortName}: ${trend}</span>`, {
          direction: "top",
          offset: [0, -8],
          opacity: 0.95,
        });

        marker.on("click", () => {
          marker.openPopup();
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

      map.on("click", () => {});
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
