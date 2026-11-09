// GIBS/WMTS tile overlays for MapLibre GL (no API key required).
// Layer ids occasionally change — see docs/data-sources.md §3.

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
    id: 'gibs-fires',
    label: 'Thermal anomalies (fires)',
    urlTemplate:
      'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Combined_Thermal_Anomalies_All/default/2025-06-01/GoogleMapsCompatible_Level9/{z}/{y}/{x}.png',
    format: 'image/png',
  },
  {
    id: 'gibs-snow',
    label: 'MODIS snow cover',
    urlTemplate:
      'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_Snow_Cover/default/2025-06-01/GoogleMapsCompatible_Level9/{z}/{y}/{x}.png',
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
