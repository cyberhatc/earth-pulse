/* On-device subset of the backend fact guards (api/services/explainer.py).
 * Mirrors: certainty_claim, significance_misread, unverified_numbers.
 * Not ported (documented limitation): p_value_misuse (probability framing),
 * band_misuse (p10–p90 as "10–90% chance"). The fallback is deterministic:
 * never publishes an unverified or over-claimed answer.
 */
export const GUARD = {
  CERTAINTY: /\bcertainty\b|\b100\s*%|\bone hundred percent\b/i,
  CITATION_RE: /\[S\d{1,2}\]/g,
  NUMBER_RE: /-?\d[\d,]*(?:\.\d+)?/g,
  SIG_CLAIM_RE: /statistically significant|significant\s+(?:trend|increase|decrease|warming|cooling|change)/i,
  NEGATION_RE: /\b(?:not|no|never|cannot|can't|insufficient|fails? to|failed to|without)\b/i,
};

function normalise(text) {
  return String(text || '').replace(/−/g, '-').replace(GUARD.CITATION_RE, ' ');
}

export function numberSet(text) {
  const out = new Set();
  for (const match of normalise(text).match(GUARD.NUMBER_RE) || []) {
    const v = Number.parseFloat(match.replace(/,/g, ''));
    if (!Number.isNaN(v)) out.add(Math.round(v * 1e6) / 1e6);
  }
  return out;
}

function round3(v) { return Math.round(v * 1000) / 1000; }

// Allowed numbers: everything derivable from the passed facts (slope, p-value,
// forecast delta, horizon, anomaly count, cluster id, cell/grid coords, the
// record window years) plus harmless constants and 3-decimal roundings.
export function allowedNumbers(facts) {
  const allowed = numberSet(JSON.stringify(facts || {}));
  const horizon = Number(facts.horizon_months) || 60;
  if (horizon > 0 && horizon % 12 === 0) allowed.add(horizon / 12);
  for (const c of [10, 90, 80, 95, 0.05]) allowed.add(c);
  for (const v of [...allowed]) allowed.add(round3(v));
  return allowed;
}

export function unverifiedNumbers(text, facts) {
  const allowed = allowedNumbers(facts);
  return [...numberSet(text)].filter((v) => !allowed.has(v));
}

export function certaintyClaim(text) {
  return GUARD.CERTAINTY.test(text || '');
}

// Mirror of the backend's focus-param rule: an un-negated significance claim is
// only legitimate when the case-file variable itself is significant.
export function significanceMisread(text, facts) {
  if (String(facts && facts.sig) !== 'false') return false;
  const sentences = String(text || '').split(/(?<=[.!?])\s+/);
  for (const sentence of sentences) {
    if (GUARD.SIG_CLAIM_RE.test(sentence) && !GUARD.NEGATION_RE.test(sentence)) {
      return true;
    }
  }
  return false;
}

// Deterministic fallback prose — same role as templated_chat in the backend.
export function templatedAnswer(facts) {
  const f = facts || {};
  const where = f.region_name ? ` for ${f.region_name}` : '';
  const slope = Number.isFinite(Number(f.slope)) ? Number(f.slope).toFixed(3) : 'n/a';
  const p = Number.isFinite(Number(f.pvalue)) ? Number(f.pvalue).toFixed(3) : 'n/a';
  const sig = String(f.significant) === 'true';
  const synth = String(f.synthetic) === 'true';
  const trange = [f.record_start, f.record_end].filter(Boolean).join(' → ');
  const lines = [];
  lines.push(
    `${f.variable || 'The case-file variable'}${where}: ${slope} per decade` +
    ` (${sig ? 'statistically significant' : 'not statistically significant'}, p=${p}).`
  );
  if (trange) {
    lines.push(`Record: ${trange} — ${synth ? 'synthetic demo data' : 'NASA POWER satellite+model record'}.`);
  }
  if (f.forecast_delta !== undefined && f.forecast_delta !== '') {
    lines.push(`Forecast net change over ${f.horizon_months || 60} months: ${Number(f.forecast_delta) >= 0 ? '+' : ''}${f.forecast_delta}.`);
    lines.push('Forecast bands are probabilistic p10–p90 outlooks, not a certain future.');
  }
  lines.push('Numbers here come only from the request parameters — never from the model’s imagination.');
  return lines.join(' ');
}

export function guardedText(text, facts) {
  const safe = String(text || '').trim();
  if (!safe) return { text: templatedAnswer(facts), guard: 'empty_model_output' };
  if (certaintyClaim(safe)) return { text: templatedAnswer(facts), guard: 'certainty_claim' };
  if (significanceMisread(safe, facts)) return { text: templatedAnswer(facts), guard: 'significance_misread' };
  const unverified = unverifiedNumbers(safe, facts);
  if (unverified.length) return { text: templatedAnswer(facts), guard: 'unverified_numbers' };
  return { text: safe, guard: null };
}
