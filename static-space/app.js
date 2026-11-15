/* Earth Pulse On-Device AI — fully client-side, no servers.
 * BM25 retrieval over the bundled knowledge base + a 0.5B instruct model
 * (WebGPU via transformers.js, WASM fallback). The model never computes
 * numbers; a deterministic guard subset substitutes on failure.
 */
import {
  loadKnowledgeBase,
  buildSystemPrompt,
  renderContext,
  sourceRefs,
} from './rag.js';
import { guardedText, templatedAnswer } from './guards.js';

const MODEL_ID = 'onnx-community/Qwen2.5-0.5B-Instruct';
const TRANSFORMERS_URL = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.3.3';

// ------------------------------------------------------------------ facts (URL)
const params = new URLSearchParams(window.location.search);
const facts = {
  region_name: params.get('region') || '',
  variable: params.get('variable') || 'Temperature',
  unit: params.get('unit') || '°C',
  slope: params.get('slope') ?? '',
  pvalue: params.get('pvalue') ?? '',
  sig: params.get('sig') ?? '',
  direction: params.get('direction') || 'unknown',
  forecast_delta: params.get('delta') ?? '',
  horizon_months: params.get('horizon') || '60',
  synthetic: params.get('synth') === '1',
  anomalies: params.get('anomalies') ?? '',
  record_start: params.get('rec_start') || '1981-01',
  record_end: params.get('rec_end') || '2026-11',
  lat: params.get('lat') || '',
  lon: params.get('lon') || '',
};
const hasContext = Boolean(facts.region_name && facts.slope !== '');

function factsSummary() {
  if (!hasContext) {
    return 'No location facts provided. If asked about a specific place or number, say you lack its data and point to general Earth Pulse knowledge.';
  }
  const sig = String(facts.sig) === 'true' ? 'statistically significant' : 'NOT statistically significant';
  const synth = facts.synthetic
    ? 'SYNTHETIC DEMO DATA (not observations).'
    : 'Real NASA POWER monthly observations/model output.';
  const slopeStr = Number.isFinite(Number(facts.slope)) ? `${Number(facts.slope) >= 0 ? '+' : ''}${facts.slope}` : 'n/a';
  const delta = facts.forecast_delta !== '' ? `${facts.forecast_delta} over ${facts.horizon_months} months` : 'not available';
  return [
    `Place: ${facts.region_name}${facts.lat ? ` (${facts.lat}°, ${facts.lon}°)` : ''}.`,
    `Record period: ${facts.record_start} to ${facts.record_end}.`,
    `Data type: ${synth}`,
    `Case-file variable: ${facts.variable}.`,
    'Trends (Theil–Sen slope per decade; p-value = trend significance only):',
    `- ${facts.variable.toLowerCase()}: ${slopeStr} ${facts.unit}/decade, p=${facts.pvalue}, ${sig}, direction=${facts.direction}.`,
    `Forecast (ridge rollout, next ${facts.horizon_months} months). Each forecast value is the TOTAL NET CHANGE across the whole horizon, NOT a per-decade rate:`,
    `- ${facts.variable.toLowerCase()}: ${delta}.`,
    `Anomalies: ${facts.anomalies || '0'} unusual month(s) flagged.`,
    'Reminder: p-values are NOT a confidence percentage or certainty level.',
  ].join('\n');
}

// -------------------------------------------------------------------- state
const state = {
  index: null,
  kbChunks: 0,
  generator: null,
  loading: false,
  modelReady: false,
  messages: [],
};

const $ = (sel) => document.querySelector(sel);
const chatLog = $('#chat-log');
const input = $('#chat-input');
const sendBtn = $('#send-btn');
const loadBtn = $('#load-model-btn');
const progressWrap = $('#model-progress');
const progressBar = $('#model-progress-bar');
const progressLabel = $('#model-progress-label');
const statusEl = $('#device-status');

const webgpu = typeof navigator !== 'undefined' && !!navigator.gpu;
statusEl.textContent = webgpu ? 'WebGPU detected — model will run on your GPU'
                             : 'No WebGPU — model will run on CPU (slow; Chrome/Edge 113+ recommended)';

function addBubble(role, text, meta = {}) {
  const el = document.createElement('div');
  el.className = `bubble bubble-${role}`;
  const content = document.createElement('p');
  content.textContent = text;
  el.appendChild(content);
  if (meta.sources || meta.generator) {
    const metaEl = document.createElement('span');
    metaEl.className = 'meta';
    metaEl.textContent = [meta.generator, meta.model && `· ${meta.model}`, meta.guard && `· guard: ${meta.guard}`]
      .filter(Boolean).join(' ');
    el.appendChild(metaEl);
  }
  if (meta.sources && meta.sources.length) {
    const src = document.createElement('span');
    src.className = 'sources';
    src.textContent = 'Sources · ' + meta.sources.slice(0, 3).map((s) => s.title).join(' · ');
    el.appendChild(src);
  }
  chatLog.appendChild(el);
  chatLog.scrollTop = chatLog.scrollHeight;
  return el;
}

function setBusy(busy) {
  sendBtn.disabled = busy;
  input.disabled = busy;
  $('#suggestions').classList.toggle('disabled', busy);
}

// ------------------------------------------------------------- knowledge base
async function ensureKB() {
  if (state.index) return true;
  try {
    const { kb, index } = await loadKnowledgeBase('./kb.json');
    state.index = index;
    state.kbChunks = kb.chunks.length;
    $('#kb-status').textContent = `${kb.chunks.length} passages indexed`;
    return true;
  } catch (err) {
    $('#kb-status').textContent = 'Knowledge base failed to load — facts-only mode';
    console.warn('KB load failed:', err);
    return false;
  }
}

// --------------------------------------------------------------------- model
async function loadModel() {
  if (state.modelReady || state.loading) return;
  state.loading = true;
  loadBtn.disabled = true;
  loadBtn.textContent = 'Loading…';
  progressWrap.hidden = false;
  try {
    const { pipeline, env } = await import(TRANSFORMERS_URL);
    env.allowLocalModels = false;
    env.useBrowserCache = true;
    const device = webgpu ? 'webgpu' : 'wasm';
    state.generator = await pipeline('text-generation', MODEL_ID, {
      dtype: 'q4',
      device,
      progress_callback: (p) => {
        if (p && typeof p.progress === 'number') {
          progressBar.style.width = `${Math.min(100, p.progress)}%`;
          progressLabel.textContent = `${p.file || 'model'} — ${p.progress.toFixed(0)}%`;
        }
      },
    });
    state.modelReady = true;
    loadBtn.textContent = webgpu ? 'On-device model ready (WebGPU)' : 'On-device model ready (CPU)';
    progressWrap.hidden = true;
    sendBtn.disabled = false;
    input.disabled = false;
  } catch (err) {
    console.error(err);
    loadBtn.textContent = 'Model failed — Retry';
    loadBtn.disabled = false;
    state.loading = false;
    progressLabel.textContent = `Load failed: ${err && err.message ? err.message.slice(0, 120) : err}. Check your connection (≈400 MB download).`;
    return;
  }
  state.loading = false;
}

// ---------------------------------------------------------------------- chat
async function generate(userText) {
  await ensureKB();
  const query = userText.trim();
  const chunks = state.index ? state.index.retrieve(query, 4) : [];
  const system = buildSystemPrompt(factsSummary(), renderContext(chunks), 'en');
  const messages = [
    { role: 'system', content: system },
    ...state.messages.slice(-8),
    { role: 'user', content: query },
  ];
  const output = await state.generator(messages, {
    max_new_tokens: 190,
    do_sample: false,
    repetition_penalty: 1.05,
  });
  const flat = output?.[0]?.generated_text;
  let text = '';
  if (typeof flat === 'string') {
    text = flat;
  } else if (Array.isArray(flat)) {
    text = flat[flat.length - 1]?.content || '';
  }
  const guarded = guardedText(String(text).trim(), facts);
  return {
    text: guarded.text,
    guard: guarded.guard,
    sources: sourceRefs(chunks),
    model: MODEL_ID.split('/').pop(),
  };
}

addBubble('assistant',
  hasContext
    ? `Hi — I'm the on-device Earth Pulse assistant for ${facts.region_name}. I run entirely in your browser: answers re-word the numbers you passed in (never invented) plus retrieved notes from the local knowledge base. Ask away — and note this is a small 0.5B model, so verify before publishing.`
    : 'Hi — open me from the Earth Pulse app with a region selected and I can ground answers in its trend facts. Without that, I can still answer general questions from the bundled Earth Pulse knowledge base.'
);

async function handleSend(raw) {
  const text = String(raw || '').trim();
  if (!text) return;
  if (!state.modelReady) {
    addBubble('assistant', 'Load the on-device model first — then I can answer. If the download is too heavy for your network, the Earth Pulse app’s server chat works without it.');
    return;
  }
  addBubble('user', text);
  state.messages.push({ role: 'user', content: text });
  setBusy(true);
  const busy = addBubble('assistant', 'Thinking on-device…');
  try {
    const result = await generate(text);
    busy.remove();
    state.messages.push({ role: 'assistant', content: result.text });
    addBubble('assistant', result.text, {
      generator: 'on-device',
      model: result.model,
      guard: result.guard,
      sources: result.sources,
    });
  } catch (err) {
    console.error(err);
    busy.remove();
    const fallback = guardedText('', facts); // empty → deterministic fallback
    addBubble('assistant', fallback.text, { generator: 'on-device', guard: 'generation_error' });
  } finally {
    setBusy(false);
    input.focus();
  }
}

loadBtn.addEventListener('click', () => void loadModel());
sendBtn.addEventListener('click', () => handleSend(input.value));
input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    void handleSend(input.value);
  }
});
$('#suggestions').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-q]');
  if (btn && !btn.disabled) void handleSend(btn.dataset.q);
});

// Context chips + synthetic warning
if (hasContext) {
  $('#context-chips').innerHTML = [
    facts.region_name,
    `${facts.variable}`,
    `${facts.slope} ${facts.unit}/decade`,
    `p=${facts.pvalue}`,
    String(facts.sig) === 'true' ? 'significant' : 'not significant',
  ].map((t) => `<span class="chip">${t}</span>`).join('');
  if (facts.synthetic) {
    const warn = document.createElement('div');
    warn.className = 'warn-chip';
    warn.textContent = 'Synthetic demo data — not measured climate.';
    $('#context-chips').after(warn);
  }
} else {
  $('#context-chips').innerHTML = '<span class="chip chip-muted">No region context — general KB mode</span>';
}

void ensureKB();
