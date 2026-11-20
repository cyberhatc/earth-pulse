import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { InvestigationProvider } from "./lib/context";
import { LandingPage } from "./pages/LandingPage";
import { EarthPedia } from "./pages/EarthPedia";
import { ConceptArticle } from "./pages/ConceptArticle";
import { RegionChatPage } from "./pages/RegionChatPage";
import { RegionHubPage } from "./pages/RegionHubPage";
import { RegionMapPage } from "./pages/RegionMapPage";
import { RegionNotebookPage } from "./pages/RegionNotebookPage";
import { RegionPointPage } from "./pages/RegionPointPage";
import { RegionReportPage } from "./pages/RegionReportPage";
import { TrendPage } from "./pages/TrendPage";
import { RegionVideosPage } from "./pages/RegionVideosPage";
import { RegionVisualizationsPage } from "./pages/RegionVisualizationsPage";
import { RegionsPage } from "./pages/RegionsPage";

export default function App() {
  return (
    <InvestigationProvider>
      <BrowserRouter>
        <a href="#main-content" className="skip-link">
          Skip to content
        </a>
        <div id="main-content" tabIndex={-1}>
          <Routes>
            <Route path="/earthpedia" element={<EarthPedia />} />
            <Route path="/earthpedia/:concept" element={<ConceptArticle />} />
            <Route path="/" element={<LandingPage />} />
            <Route path="/regions" element={<RegionsPage />} />
            <Route path="/region/:slug" element={<RegionHubPage />} />
            <Route path="/region/:slug/chat" element={<RegionChatPage />} />
            <Route path="/region/:slug/map" element={<RegionMapPage />} />
            <Route path="/region/:slug/point" element={<RegionPointPage />} />
            <Route path="/region/:slug/videos" element={<RegionVideosPage />} />
            <Route path="/region/:slug/visualizations" element={<RegionVisualizationsPage />} />
            <Route
              path="/region/:slug/notebook"
              element={<RegionNotebookPage />}
            />
            <Route
              path="/region/:slug/report"
              element={<RegionReportPage />}
            />
            <Route path="/trend" element={<TrendPage />} />
            <Route path="/report" element={<TrendPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </BrowserRouter>
    </InvestigationProvider>
  );
}
