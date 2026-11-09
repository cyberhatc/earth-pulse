import { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { GIBS_LAYERS, gibsSourceDef } from '../lib/mapLayers'

interface Props {
  onSelect: (lat: number, lon: number) => void
  selected: { lat: number; lon: number } | null
  gibsEnabled: Record<string, boolean>
}

const OSM_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors',
    },
  },
  layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
}

export default function MapView({ onSelect, selected, gibsEnabled }: Props) {
  const container = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const markerRef = useRef<maplibregl.Marker | null>(null)

  // init map once
  useEffect(() => {
    if (!container.current || mapRef.current) return
    const map = new maplibregl.Map({
      container: container.current,
      style: OSM_STYLE,
      center: [15, 25],
      zoom: 1.6,
      attributionControl: { compact: true },
    })
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right')
    map.on('click', (e) => onSelect(e.lngLat.lat, e.lngLat.lng))
    map.on('load', () => map.resize())
    mapRef.current = map
    // resize watcher (container may change on panel open)
    const ro = new ResizeObserver(() => map.resize())
    ro.observe(container.current)
    return () => {
      ro.disconnect()
      map.remove()
      mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // marker on selection
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (!selected) {
      markerRef.current?.remove()
      markerRef.current = null
      return
    }
    const el = document.createElement('div')
    el.className = 'pin'
    el.setAttribute('aria-label', `Selected ${selected.lat.toFixed(2)}, ${selected.lon.toFixed(2)}`)
    if (markerRef.current) markerRef.current.remove()
    markerRef.current = new maplibregl.Marker({ element: el })
      .setLngLat([selected.lon, selected.lat])
      .addTo(map)
  }, [selected])

  // GIBS overlays
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const apply = () => {
      for (const layer of GIBS_LAYERS) {
        const want = !!gibsEnabled[layer.id]
        const sourceId = `src-${layer.id}`
        const layerId = `lyr-${layer.id}`
        const hasSource = map.getSource(sourceId) !== undefined
        if (want && !hasSource) {
          map.addSource(sourceId, gibsSourceDef(layer))
          map.addLayer({ id: layerId, type: 'raster', source: sourceId, paint: { 'raster-opacity': 0.75 } })
        } else if (!want && hasSource) {
          if (map.getLayer(layerId)) map.removeLayer(layerId)
          map.removeSource(sourceId)
        }
      }
    }
    if (map.isStyleLoaded()) apply()
    else map.once('load', apply)
  }, [gibsEnabled])

  return <div ref={container} className="map" role="application" aria-label="Interactive world map. Click anywhere to inspect climate change at that location." />
}
