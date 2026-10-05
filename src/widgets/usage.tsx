import {
  Widget,
  WidgetBody,
  WidgetHeader,
  useDashboardTheme,
  type WidgetProps,
} from "@mosaic/sdk";
import { UsageContent } from "../components/usage";

export default function UsageWidget({ size }: WidgetProps) {
  const { tokens } = useDashboardTheme();
  return (
    <Widget>
      <WidgetHeader>
        <h2>OpenAI</h2>
      </WidgetHeader>
      <WidgetBody>
        <div
          style={{
            overflowY: "auto",
            maxHeight: "100%",
            paddingBottom: tokens.spacing.xs,
          }}
        >
          <UsageContent compact={size === "small" || size === "medium"} />
        </div>
      </WidgetBody>
    </Widget>
  );
}
