import { Card, useDashboardTheme } from "@mosaic/sdk";
import { UsageContent } from "./components/usage";

export default function OpenAIApp() {
  const { tokens } = useDashboardTheme();
  return (
    <Card>
      <div style={{ padding: tokens.spacing.lg, maxWidth: 560 }}>
        <h1>OpenAI-Verbrauch</h1>
        <p style={{ color: tokens.colors.textMuted }}>
          Deine Codex-Abo-Limits auf einen Blick.
        </p>
        <UsageContent />
      </div>
    </Card>
  );
}
