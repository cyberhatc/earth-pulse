/* Earth Pulse On-Device AI — BM25 retrieval over the bundled knowledge base.
 * Faithful port of nasa/api/services/rag_core.py. Keep the two in sync.
 */
export const SYSTEM_PROMPT = `You are Earth Pulse, a careful climate-data interpreter embedded in a NASA satellite trend explorer.
Two sources of truth are provided below:
- FACTS SUMMARY: the only source of NUMBERS. Use numbers only from it. Never invent, round inconsistently, or alter a number.
- CONTEXT: retrieved background passages. Use them for general/domain questions. Cite them inline as [S1], [S2] ... when you use them. If CONTEXT and FACTS disagree, FACTS win.
STRICT RULES:
1. Forecast values are TOTAL NET CHANGE over the whole horizon, NOT per decade. Never call them per-decade rates.
2. A p-value measures trend significance only. NEVER turn it into a confidence percentage, a certainty level, or '100%'. Forecasts have p10-p90 uncertainty and are not certain futures.
3. If a trend is NOT statistically significant, say no statistically significant trend can be confirmed. Never call it warming/cooling certainty.
4. If a parameter is unavailable, say so; never fill gaps with numbers.
5. If data is synthetic, say it is synthetic demo data.
6. Answer in at most 3 short sentences of plain language (no bullet lists, no parameter-by-parameter dump). Focus on the user's case-file variable and at most one other parameter.
7. Call forecast numbers 'forecast net change', never 'trend'.
8. p-values are NOT a confidence percentage or certainty level. A non-significant trend means the data cannot confirm a trend at the 0.05 threshold, not that no change occurred.`;

export const NO_CONTEXT = 'No relevant passages retrieved; answer from FACTS SUMMARY only.';

const K1 = 1.5;
const B = 0.75;
const TOKEN_RE = /[a-z0-9]+/g;

export function tokenize(text) {
  return String(text || '').toLowerCase().match(TOKEN_RE) || [];
}

export class BM25Index {
  constructor(chunks) {
    this.chunks = chunks.slice();
    this.boosts = chunks.map((c) => (typeof c.boost === 'number' ? c.boost : 1.0));
    this.docTokens = chunks.map((c) => tokenize(c.text));
    this.docLen = this.docTokens.map((t) => t.length);
    const total = this.docLen.reduce((a, b) => a + b, 0);
    this.avgLen = this.docLen.length ? total / this.docLen.length : 0;
    this.df = new Map();
    for (const tokens of this.docTokens) {
      for (const term of new Set(tokens)) {
        this.df.set(term, (this.df.get(term) || 0) + 1);
      }
    }
    this.nDocs = this.chunks.length;
  }

  idf(term) {
    const df = this.df.get(term) || 0;
    return Math.log(1.0 + (this.nDocs - df + 0.5) / (df + 0.5));
  }

  scoreDoc(queryTerms, i) {
    const tokens = this.docTokens[i];
    if (!tokens || tokens.length === 0) return 0;
    const freqs = new Map();
    for (const t of tokens) freqs.set(t, (freqs.get(t) || 0) + 1);
    const norm = K1 * (1.0 - B + B * (this.docLen[i] / (this.avgLen || 1.0)));
    let score = 0;
    for (const term of queryTerms) {
      const f = freqs.get(term);
      if (!f) continue;
      score += this.idf(term) * ((f * (K1 + 1.0)) / (f + norm));
    }
    return score;
  }

  retrieve(query, k = 4) {
    const terms = tokenize(query);
    const scored = this.chunks.map((_, i) => ({
      score: this.scoreDoc(terms, i) * this.boosts[i],
      index: i,
    }));
    scored.sort((a, b) => b.score - a.score || a.index - b.index);
    const out = [];
    for (const { score, index } of scored) {
      if (score <= 0 && out.length) break;
      out.push({ ...this.chunks[index], score: Math.round(score * 10000) / 10000 });
      if (out.length >= k) break;
    }
    return out;
  }
}

export function renderContext(chunks) {
  if (!chunks || chunks.length === 0) return NO_CONTEXT;
  return chunks
    .map((chunk, i) => {
      const title = chunk.title || chunk.id || `Chunk ${i + 1}`;
      const source = chunk.source || 'knowledge-base';
      const text = String(chunk.text || '').replace(/\s+/g, ' ').trim();
      return `[S${i + 1}] ${title} (${source}): ${text}`;
    })
    .join('\n');
}

export function sourceRefs(chunks) {
  return chunks.map((chunk, i) => ({
    id: `S${i + 1}`,
    chunk_id: chunk.id ?? null,
    title: chunk.title || chunk.id || `Chunk ${i + 1}`,
    source: chunk.source || 'knowledge-base',
    score: chunk.score ?? null,
  }));
}

export function buildSystemPrompt(factsSummary, contextText, language = 'en') {
  let system = SYSTEM_PROMPT;
  if (language === 'auto') {
    system += '\nAnswer in the same language as the user\'s question.';
  }
  system += `\n\nFACTS SUMMARY:\n${String(factsSummary || '').slice(0, 6000)}`;
  system += `\n\nCONTEXT:\n${contextText}`;
  return system;
}

export async function loadKnowledgeBase(url = './kb.json') {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`kb.json HTTP ${res.status}`);
  const kb = await res.json();
  if (!kb || !Array.isArray(kb.chunks) || kb.chunks.length === 0) {
    throw new Error('kb.json is empty or malformed');
  }
  return { kb, index: new BM25Index(kb.chunks) };
}
