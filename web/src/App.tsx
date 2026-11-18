import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { InvestigationProvider } from "./lib/context";
import { LandingPage } from "./pages/LandingPage";
import { RegionChatPage } from "./pages/RegionChatPage";
import { RegionHubPage } from "./pages/RegionHubPage";
import { RegionMapPage } from "./pages/RegionMapPage";
import { RegionNotebookPage } from "./pages/RegionNotebookPage";
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
            <Route path="/" element={<LandingPage />} />
            <Route path="/regions" element={<RegionsPage />} />
            <Route path="/region/:slug" element={<RegionHubPage />} />
            <Route path="/region/:slug/chat" element={<RegionChatPage />} />
            <Route path="/region/:slug/map" element={<RegionMapPage />} />
            <Route path="/region/:slug/videos" element={<RegionVideosPage />} />
            <Route path="/region/:slug/visualizations" element={<RegionVisualizationsPage />} />
            <Route path="/region/:slug/notebook" element={<RegionNotebookPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </BrowserRouter>
    </InvestigationProvider>
  );
}
