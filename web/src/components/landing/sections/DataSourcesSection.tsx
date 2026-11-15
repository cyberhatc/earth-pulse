type SourceRow = { name: string; provides: string; use: string; link?: string; linkLabel?: string; attr: string };
type Group = { title: string; status: string; rows: SourceRow[] };

const GROUPS: Group[] = [
  {
    title: "Currently integrated",
    status: "Integrated in supported workflows / paths",
    rows: [
      {
        name: "NASA POWER",
        provides: "Point-based monthly climate parameters (e.g. temperature, precipitation, humidity, wind, solar radiation) for long historical spans where available.",
        use: "Used in real-data/point workflows and documented real-store paths; the bundled offline demo can run with deterministic synthetic data.",
        link: "https://power.larc.nasa.gov/",
        linkLabel: "NASA POWER",
        attr: "NASA POWER Project. Cite per POWER terms when using real outputs.",
      },
      {
        name: "NASA GIBS / Worldview",
        provides: "Global satellite imagery tiles/layers for map context and past imagery references.",
        use: "Used for imagery tile/thumbnail experiences where enabled/configured in the application.",
        link: "https://worldview.earthdata.nasa.gov/",
        linkLabel: "NASA Worldview / GIBS",
        attr: "NASA GIBS/Worldview imagery; follow NASA imagery and GIBS usage guidance.",
      },
      {
        name: "Microsoft Planetary Computer / Sentinel-2 (point-flow integration)",
        provides: "Sentinel-2 L2A scenes/band data enabling higher-resolution NDVI/imagery context for selected locations (availability-dependent).",
        use: "Integrated in the high-resolution point-store build path for recent-period vegetation/imagery context, subject to service availability.",
        link: "https://planetarycomputer.microsoft.com/",
        linkLabel: "Microsoft Planetary Computer",
        attr: "Sentinel data via Copernicus/ESA; accessed through Planetary Computer STAC/services.",
      },
    ],
  },
  {
    title: "Optional or on-demand",
    status: "Configuration / credential dependent",
    rows: [
      {
        name: "NASA FIRMS",
        provides: "Near-real-time active fire / thermal anomaly detections.",
        use: "Optional signal when configured (e.g. API key present); not required for core demo.",
        link: "https://firms.modaps.eosdis.nasa.gov/",
        linkLabel: "NASA FIRMS",
        attr: "NASA FIRMS; API key/terms apply for live access.",
      },
      {
        name: "NASA Earthdata / CMR-backed discovery",
        provides: "Discovery and access pathways to NASA DAAC products via Earthdata services.",
        use: "Opt-in/on-demand discovery paths where implemented; not required for precomputed demo responses.",
        link: "https://search.earthdata.nasa.gov/",
        linkLabel: "NASA Earthdata Search",
        attr: "NASA Earthdata; free Earthdata Login may be required for some products.",
      },
      {
        name: "MODIS / GPM / other DAAC products (pipeline modules)",
        provides: "Gridded vegetation, precipitation, temperature and related Earth observation products depending on module and credentials.",
        use: "Supported as pipeline/on-demand fetch targets in codebase where configured; availability depends on credentials and network.",
        link: "https://www.earthdata.nasa.gov/",
        linkLabel: "NASA Earthdata",
        attr: "Cite specific NASA products/DAACs used in any real analysis.",
      },
    ],
  },
  {
    title: "External scientific resources",
    status: "Not embedded runtime integrations",
    rows: [
      {
        name: "NASA Giovanni",
        provides: "Interactive analysis and visualization of many Earth science variables for validation and exploration.",
        use: "External scientific reference/tool; not embedded as a direct runtime dependency.",
        link: "https://giovanni.gsfc.nasa.gov/",
        linkLabel: "NASA Giovanni",
        attr: "NASA GES DISC Giovanni.",
      },
      {
        name: "NASA AppEEARS",
        provides: "Point/area extraction and subsetting for selected NASA products.",
        use: "External resource for data access workflows; not a direct in-app integration.",
        link: "https://appeears.earthdatacloud.nasa.gov/",
        linkLabel: "NASA AppEEARS",
        attr: "NASA LP DAAC AppEEARS.",
      },
      {
        name: "NASA Hydrology Time Series (where applicable)",
        provides: "Hydrology-related time-series resources in the NASA ecosystem.",
        use: "External scientific resource; verify product-specific applicability before use.",
        link: "https://www.earthdata.nasa.gov/",
        linkLabel: "NASA Earthdata",
        attr: "NASA Earthdata (product-specific terms apply).",
      },
      {
        name: "NOAA Climate Data Online",
        provides: "Historical weather and climate records from NOAA archives.",
        use: "External complementary data source; not claimed as integrated by default.",
        link: "https://www.ncei.noaa.gov/cdo-web/",
        linkLabel: "NOAA CDO",
        attr: "NOAA NCEI.",
      },
      {
        name: "KNMI Climate Explorer",
        provides: "Climate data exploration, indices, and statistical tools.",
        use: "External analysis/reference resource; not a direct application integration.",
        link: "https://climexp.knmi.nl/",
        linkLabel: "KNMI Climate Explorer",
        attr: "KNMI Climate Explorer.",
      },
    ],
  },
  {
    title: "Planned",
    status: "Roadmap / not active by default",
    rows: [
      {
        name: "Broader real-product coverage in default demo stores",
        provides: "More parameters/regions backed by real observations out-of-the-box.",
        use: "Planned/expandable via existing pipeline and configuration; current bundled quickstart prioritizes offline reproducibility.",
        link: "https://github.com/cyberhatc/earth-pulse",
        linkLabel: "Repository",
        attr: "Repository/docs reflect current status.",
      },
      {
        name: "Additional partner datasets and automated ingest presets",
        provides: "Richer multi-source comparisons and easier real-data setup.",
        use: "Potential future integrations; depends on credentials, quotas, and implementation work.",
        attr: "Source-specific terms would apply.",
      },
    ],
  },
];

export function DataSourcesSection() {
  return (
    <section id="sources" className="landing-section l-sources" data-section="sources" aria-label="Data sources">
      <div className="landing-shell">
        <div className="l-section-head" data-l-reveal>
          <p className="l-eyebrow" data-anime="mark">Data sources</p>
          <h2 className="l-section-title">Data sources</h2>
          <p className="l-section-lede">
            Accurate status categories based on repository-documented workflows. External resources are not embedded
            integrations; optional APIs are not active without configuration/credentials.
          </p>
        </div>

        <div className="l-source-groups" data-l-stagger>
          {GROUPS.map((g) => (
            <article key={g.title} className="l-source-group">
              <div className="l-source-group-head">
                <h3>{g.title}</h3>
                <p className="l-source-status">{g.status}</p>
              </div>
              <div className="l-source-table-wrap">
                <table className="l-source-table">
                  <thead>
                    <tr>
                      <th scope="col">Source</th>
                      <th scope="col">What it provides</th>
                      <th scope="col">How Earth Pulse uses it</th>
                      <th scope="col">Link / attribution</th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.rows.map((r) => (
                      <tr key={r.name}>
                        <th scope="row">{r.name}</th>
                        <td>{r.provides}</td>
                        <td>{r.use}</td>
                        <td>
                          {r.link ? (
                            <p>
                              <a href={r.link} target="_blank" rel="noreferrer">
                                {r.linkLabel || "Official link"}
                              </a>
                            </p>
                          ) : null}
                          <p>{r.attr}</p>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}