import type { Explanation } from '../types/payload'

export default function ExplainerBox({ explanation }: { explanation: Explanation }) {
  const styles: Record<string, string> = {
    templated: 'generator: templated (offline, deterministic)',
    hf_inference: 'generator: Hugging Face Inference API',
    gemini: 'generator: Gemini free tier',
  }
  return (
    <div className="card">
      <h3>Plain-English briefing</h3>
      <span className="gen">{styles[explanation.generator] ?? explanation.generator} · confidence: {explanation.confidence}</span>
      <p className="explainer">{explanation.text}</p>
    </div>
  )
}
