// GIBS/WMTS tile overlays for MapLibre GL (no API key required).
// Layer ids + tile matrix sets verified against the live GIBS server on 2026-11-09.
// Fire/thermal-anomaly layers are VECTOR tiles — use the FIRMS API path, not img rasters.

export interface GibsLayerDef {
  id: string
  label: string
  urlTemplate: string
  format: string
}

export const GIBS_LAYERS: GibsLayerDef[] = [
  {
    id: 'gibs-ndvi',
    label: 'MODIS NDVI (vegetation)',
    urlTemplate:
      'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_NDVI_8Day/default/2025-06-01/GoogleMapsCompatible_Level9/{z}/{y}/{x}.png',
    format: 'image/png',
  },
  {
    id: 'gibs-snow',
    label: 'MODIS snow extent (8-day)',
    urlTemplate:
      'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_L3_Snow_Extent_8Day/default/2025-06-01/GoogleMapsCompatible_Level8/{z}/{y}/{x}.png',
    format: 'image/png',
  },
  {
    id: 'gibs-sst',
    label: 'MUR sea surface temperature',
    urlTemplate:
      'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/GHRSST_L4_MUR_Sea_Surface_Temperature/default/2025-06-01/GoogleMapsCompatible_Level7/{z}/{y}/{x}.png',
    format: 'image/png',
  },
  {
    id: 'gibs-truecolor',
    label: 'True color (corrected reflectance)',
    urlTemplate:
      'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_CorrectedReflectance_TrueColor/default/2025-06-01/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg',
    format: 'image/jpeg',
  },
]

export function gibsSourceDef(layer: GibsLayerDef) {
  return {
    type: 'raster' as const,
    tiles: [layer.urlTemplate],
    tileSize: 256,
    attribution: 'NASA GIBS / Worldview',
  }
}
