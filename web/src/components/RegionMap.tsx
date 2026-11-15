"use client";

import { useEffect, useRef } from "react";
import type * as LeafletTypes from "leaflet";
import type { Region } from "../lib/types";
import { colorForSlope, slopeAtPoint } from "../lib/trend";

type RegionMapProps = {
  region: Region;
  selectedPoint: [number, number] | null;
  onSelectPoint: (point: [number, number]) => void;
};

export function RegionMap({
  region,
  selectedPoint,
  onSelectPoint,
}: RegionMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletTypes.Map | null>(null);
  const leafletRef = useRef<typeof LeafletTypes | null>(null);
  const selectedMarkerRef = useRef<LeafletTypes.CircleMarker | null>(null);
  const onSelectRef = useRef(onSelectPoint);

  onSelectRef.current = onSelectPoint;

  useEffect(() => {
    let cancelled = false;
    const container = containerRef.current;
    if (!container) return;

    const markers: LeafletTypes.CircleMarker[] = [];

    async function initMap() {
      const L = await import("leaflet");
      if (cancelled || !container) return;

      leafletRef.current = L;

      const map = L.map(container, {
        center: region.center,
        zoom: region.zoom,
        zoomControl: true,
        attributionControl: true,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap contributors",
        maxZoom: 18,
      }).addTo(map);

      const [[south, west], [north, east]] = region.bounds;
      const safeNorth = Math.min(84, north);
      const rows = 6;
      const cols = 8;

      for (let r = 0; r < rows; r += 1) {
        for (let c = 0; c < cols; c += 1) {
          const lat = south + ((r + 0.5) / rows) * (safeNorth - south);
          const lng = west + ((c + 0.5) / cols) * (east - west);
          const slope = slopeAtPoint(lat, lng, region);

          const marker = L.circleMarker([lat, lng], {
            radius: 18,
            weight: 0,
            fillColor: colorForSlope(slope),
            fillOpacity: 1,
          }).addTo(map);

          marker.on("click", (e) => {
            L.DomEvent.stopPropagation(e);
            onSelectRef.current([lat, lng]);
          });

          markers.push(marker);
        }
      }

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

      if (selectedPoint) {
        selectedMarkerRef.current = L.circleMarker(selectedPoint, {
          radius: 9,
          weight: 2,
          color: "#14181A",
          fillColor: "#FFFFFF",
          fillOpacity: 1,
        }).addTo(map);
      }
    }

    void initMap();

    return () => {
      cancelled = true;
      for (const marker of markers) {
        marker.remove();
      }
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
      aria-label={`${region.name} spatial trend map. Illustrative grid layer; select a point on the map to fetch that location’s computed trend.`}
    />
  );
}
