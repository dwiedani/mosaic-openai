import { defineApp, defineWidget } from "@mosaic/sdk";

export default defineApp({
  id: "openai",
  name: "OpenAI",
  description: "Codex-Verbrauch und verfügbare Abo-Limits auf einen Blick.",
  icon: "sun",
  requires: { dashboardApi: ">=1.0.0 <2.0.0" },
  app: { component: () => import("./src/app") },
  widgets: [
    defineWidget({
      id: "usage",
      title: "OpenAI-Verbrauch",
      icon: "sun",
      sizes: ["small", "medium", "large"],
      component: () => import("./src/widgets/usage"),
    }),
  ],
});
