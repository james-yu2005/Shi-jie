import { backendFetch } from "@/lib/backend";

const DEFAULT_TEXT = "gpt-4o-mini";
const DEFAULT_VISION = "gpt-4o-mini";

type HealthResponse = {
  models?: {
    text: string;
    vision: string;
  };
};

export async function FooterModelInfo() {
  let textModel = DEFAULT_TEXT;
  let visionModel = DEFAULT_VISION;

  try {
    const health = await backendFetch<HealthResponse>("/health");
    if (health.models?.text) textModel = health.models.text;
    if (health.models?.vision) visionModel = health.models.vision;
  } catch {
    // Backend unreachable — show defaults.
  }

  return (
    <p className="text-ink/50">
      AI models:{" "}
      <span className="text-ink/60">
        reader &amp; study <b className="font-medium text-ink/70">{textModel}</b>
      </span>
      <span className="mx-1.5 text-ink/30">·</span>
      <span className="text-ink/60">
        daily image <b className="font-medium text-ink/70">{visionModel}</b>
      </span>
    </p>
  );
}
