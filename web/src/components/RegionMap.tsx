"use client";

import { useEffect, useRef, useState } from "react";
import type * as LeafletTypes from "leaflet";
import type { Region } from "../lib/types";
import { fetchGridTrends, type GridCellTrend } from "../lib/api";
import { colorForSlope, formatCoords, formatSignedNumber } from "../lib/trend";

type RegionMapProps = {
  region: Region;
  selectedPoint: [number, number] | null;
  /** Backend POWER parameter for the marker colours (e.g. "precipitation"). Null = backend offline. */
  gridParam: string | null;
  onSelectPoint: (point: [number, number]) => void;
};

type GridState = "idle" | "loading" | "ready" | "unavailable";

export function RegionMap({
  region,
  selectedPoint,
  gridParam,
  onSelectPoint,
}: RegionMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletTypes.Map | null>(null);
  const leafletRef = useRef<typeof LeafletTypes | null>(null);
  const markersRef = useRef<LeafletTypes.CircleMarker[]>([]);
  const selectedMarkerRef = useRef<LeafletTypes.CircleMarker | null>(null);
  const onSelectRef = useRef(onSelectPoint);

  const [gridCells, setGridCells] = useState<GridCellTrend[] | null>(null);
  const [gridState, setGridState] = useState<GridState>("idle");
  const [mapReady, setMapReady] = useState(false);

  onSelectRef.current = onSelectPoint;

  // Fetch the measured per-cell slopes from the backend (NASA POWER grid).
  useEffect(() => {
    if (!gridParam) {
      setGridCells(null);
      setGridState("idle");
      return;
    }
    const controller = new AbortController();
    setGridState("loading");
    fetchGridTrends(gridParam, controller.signal)
      .then((g) => {
        setGridCells(g.cells);
        setGridState("ready");
      })
      .catch(() => {
        setGridCells(null);
        setGridState("unavailable");
      });
    return () => controller.abort();
  }, [gridParam]);

  // Create the map shell once per region.
  useEffect(() => {
    let cancelled = false;
    const container = containerRef.current;
    if (!container) return;

    async function initMap() {
      const L = await import("leaflet");
      if (cancelled || !containerRef.current) return;

      leafletRef.current = L;

      const map = L.map(containerRef.current, {
        center: region.center,
        zoom: region.zoom,
        zoomControl: true,
        attributionControl: true,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap contributors",
        maxZoom: 18,
      }).addTo(map);

      map.on("click", (e: LeafletTypes.LeafletMouseEvent) => {
        onSelectRef.current([e.latlng.lat, e.latlng.lng]);
      });

      L.rectangle(region.bounds, {
        color: "#0e5a63",
        weight: 1.5,
        dashArray: "6 5",
        fill: false,
        interactive: false,
      }).addTo(map);

      map.fitBounds(region.bounds, { padding: [18, 18] });
      mapRef.current = map;
      setMapReady(true);
    }

    void initMap();

    return () => {
      cancelled = true;
      markersRef.current = [];
      setMapReady(false);
      if (selectedMarkerRef.current) {
        selectedMarkerRef.current.remove();
        selectedMarkerRef.current = null;
      }
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [region]);

  // Paint markers: nearest measured 15° POWER cell per marker tile.
  useEffect(() => {
    const map = mapRef.current;
    const L = leafletRef.current;
    if (!map || !L || !mapReady) return;

    for (const marker of markersRef.current) marker.remove();
    markersRef.current = [];

    const [[south, west], [north, east]] = region.bounds;
    const safeNorth = Math.min(84, north);
    const rows = 6;
    const cols = 8;

    const nearestCell = (lat: number, lng: number) => {
      if (!gridCells || gridCells.length === 0) return null;
      let best: GridCellTrend | null = null;
      let bestD = Infinity;
      for (const cell of gridCells) {
        const d = (cell.lat - lat) ** 2 + (cell.lon - lng) ** 2;
        if (d < bestD) {
          bestD = d;
          best = cell;
        }
      }
      return best;
    };

    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        const lat = south + ((r + 0.5) / rows) * (safeNorth - south);
        const lng = west + ((c + 0.5) / cols) * (east - west);
        const cell = nearestCell(lat, lng);
        const title = cell
          ? `nearest measured cell ${formatCoords(cell.lat, cell.lon, 0)}: ${formatSignedNumber(cell.slope_per_decade)} per decade (p = ${cell.p_value.toFixed(3)}${cell.significant ? ", significant" : ""})`
          : "Backend offline — no measured slope";

        const marker = L.circleMarker([lat, lng], {
          radius: 16,
          weight: 0,
          fillColor: cell ? colorForSlope(cell.slope_per_decade) : "#9aa3a0",
          fillOpacity: cell ? 0.9 : 0.45,
        }).addTo(map);

        marker.bindTooltip(title);
        marker.on("click", (e) => {
          L.DomEvent.stopPropagation(e);
          onSelectRef.current(cell ? [cell.lat, cell.lon] : [lat, lng]);
        });

        markersRef.current.push(marker);
      }
    }
  }, [region, gridCells, mapReady]);

  // Selected-point marker.
  useEffect(() => {
    const map = mapRef.current;
    const L = leafletRef.current;
    if (!map || !L) return;

    if (selectedMarkerRef.current) {
      selectedMarkerRef.current.remove();
      selectedMarkerRef.current = null;
    }

    if (selectedPoint) {
      selectedMarkerRef.current = L.circleMarker(selectedPoint, {
        radius: 9,
        weight: 2,
        color: "#14181A",
        fillColor: "#FFFFFF",
        fillOpacity: 1,
      }).addTo(map);
    }
  }, [selectedPoint]);

  return (
    <div
      id="leaflet-map"
      ref={containerRef}
      data-testid="region-map"
      role="region"
      data-grid-state={gridState}
      aria-label={`${region.name} spatial trend map — measured NASA POWER cells`}
    />
  );
}
