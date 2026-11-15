import { getVariable } from "./data";
import {
  computeFingerprint,
  detectAnomalies,
} from "./intelligence";
import { formatP, formatSlope, generateSeries } from "./trend";
import type { CardKind, Region, TrendStats } from "./types";

export const SUGGESTIONS: string[] = [
  "Show the 5-year forecast",
  "Is the trend statistically significant?",
  "What changed unusually in this region?",
  "Where is it changing?",
  "Show the trend fingerprint",
  "Find Earth twins across continents",
  "Tell the local story in Hindi / Kannada",
  "Check data coverage and limitations",
  "Show the opposite trends nearby",
  "Show the trend over time",
];

// REPLACE THIS FUNCTION WITH A REAL LLM CALL LATER — the UI contract is { text: string, cardKind: CardKind } and nothing else.
export function generateReply(
  userText: string,
  region: Region,
  stats: TrendStats,
): { text: string; cardKind: CardKind } {
  const q = userText.toLowerCase();
  const variable = getVariable(region.variable);
  const slopeStr = formatSlope(stats);
  const pStr = formatP(stats.pValue);

  if (/fingerprint|all four|variables together|coupled|combine/.test(q)) {
    const fp = computeFingerprint(region);
    return {
      cardKind: "fingerprint",
      text: `${fp.coupledInsight} (${fp.significantCount}/4 indicators significant). This is the offline demonstration fingerprint — the live backend produces the NASA POWER fingerprint.`,
    };
  }

  if (/unusual|anomal|spike|outlier|depart|weird/.test(q)) {
    const anomalies = detectAnomalies(region, generateSeries(region));
    return {
      cardKind: "anomaly",
      text: `Offline demonstration scan of ${region.name}'s monthly series against its seasonal cycle. ${anomalies.summary} Note: an anomaly is not automatically a disaster or a long-term climate trend. Connect the backend for NASA POWER anomalies at your pinned cell.`,
    };
  }

  if (/twin|similar|other region|continent|compare/.test(q)) {
    return {
      cardKind: "earth-twins",
      text: `Earth twins are computed by the backend: k-means clustering of NASA POWER cell climatology, plus its opposite-trend detector for neighbouring cells that move against each other. That requires the live backend — nothing here fabricates a cross-continent match.`,
    };
  }

  if (/story|hindi|kannada|english|student|journalist|western ghats|translate|local/.test(q)) {
    return {
      cardKind: "story",
      text: `Here is the accessible Local Earth Story for ${region.name}. Switch between English, हिन्दी, and ಕನ್ನಡ — or preview Student, Journalist, Researcher, and Western Ghats lenses inside the card.`,
    };
  }

  if (/evidence|provenance|audit|missing data|resolution|dataset/.test(q)) {
    return {
      cardKind: "evidence",
      text: `Here is the full Evidence & Confidence card tracing ${region.name}'s ${variable.shortName} findings back to their source, spatial resolution, missing data, and limitations. With the backend offline the card shows demonstration labels; live it shows NASA POWER provenance.`,
    };
  }

  if (/where|map|distribution|spatial|where is/.test(q)) {
    return {
      cardKind: "slope-map",
      text: `Here's the spatial picture of ${variable.shortName} trend across ${region.name}. Orange = increasing, blue = decreasing. Click any point to investigate it individually.`,
    };
  }

  if (
    /significan|caveat|trust|confiden|p-value|p value|reliable|how sure/.test(q)
  ) {
    return {
      cardKind: "caveat",
      text: `The trend here has ${pStr}. ${
        stats.significant
          ? "That clears the conventional 0.05 threshold — so we can be fairly confident it's real."
          : "That's above the 0.05 threshold, so we can't confidently call this significant yet."
      } Let me lay out what that does and doesn't mean.`,
    };
  }

  if (/what is|explain|define|meaning|what does.*mean/.test(q)) {
    return {
      cardKind: "variable",
      text: `${variable.name} — ${variable.description}`,
    };
  }

  if (/show|chart|graph|series|over time|plot|data/.test(q)) {
    return {
      cardKind: "trend-chart",
      text: `Here is the full monthly series for ${variable.shortName} over ${region.name}, with the fitted linear trend and 95% confidence band.`,
    };
  }

  if (
    /trend|changing|change|warmer|cooler|increas|decreas|warming|cooling/.test(q)
  ) {
    return {
      cardKind: "finding",
      text: `Across ${region.name}, ${variable.shortName} is changing at ${slopeStr} (${pStr}). ${
        stats.significant
          ? "Statistically significant."
          : "Not statistically significant at the conventional threshold."
      }`,
    };
  }

  return {
    cardKind: "finding",
    text: `Good question. Here's the headline: ${variable.shortName} over ${region.name} has been changing at ${slopeStr} (${pStr}). Want me to show the fingerprint, anomalies, Earth twins, or a local story?`,
  };
}
