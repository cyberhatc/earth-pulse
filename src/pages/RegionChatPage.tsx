import { ArtifactCanvas } from "../components/ArtifactCanvas";
import { ChatPanel } from "../components/ChatPanel";
import { ContextChipBar } from "../components/ContextChipBar";
import { TopBar } from "../components/TopBar";
import { useRegionRoute } from "../lib/useRegionRoute";

export function RegionChatPage() {
  const { region } = useRegionRoute();

  return (
    <div className="workspace-page">
      <TopBar
        backHref={region ? `/region/${region.slug}` : "/regions"}
        backLabel={region ? region.name : "Regions"}
      />
      <ContextChipBar mode="chat" />
      <main className="chat-layout">
        <ChatPanel />
        <ArtifactCanvas />
      </main>
    </div>
  );
}
