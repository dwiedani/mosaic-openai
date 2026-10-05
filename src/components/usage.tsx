import { useEffect } from "react";
import {
  Button,
  EmptyState,
  ErrorState,
  LoadingState,
  useAppQuery,
  useDashboard,
  useDashboardTheme,
} from "@mosaic/sdk";
import { loadUsage, usageKey } from "../services/usage";
import type { UsageWindow } from "../domain/usage";

function UsageBar({
  window,
  compact,
}: {
  readonly window: UsageWindow;
  readonly compact: boolean;
}) {
  const { tokens } = useDashboardTheme();
  const percent = new Intl.NumberFormat("de-DE", {
    maximumFractionDigits: 1,
  }).format(window.usedPercent);
  const color =
    window.usedPercent >= 95
      ? tokens.colors.danger
      : window.usedPercent >= 80
        ? tokens.colors.warning
        : tokens.colors.accent;
  const reset =
    window.resetsAt === null ? null : new Date(window.resetsAt * 1000);
  const expired = reset !== null && reset.getTime() <= Date.now();
  return (
    <div style={{ display: "grid", gap: tokens.spacing.xs }}>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: tokens.spacing.sm,
          flexWrap: "wrap",
        }}
      >
        <span
          style={{
            fontSize: compact ? "0.75rem" : "0.875rem",
            color: tokens.colors.textMuted,
          }}
        >
          {window.label}
        </span>
        <strong
          style={{
            fontSize: compact ? "1rem" : "1.5rem",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {percent} %
        </strong>
      </div>
      <div
        role="progressbar"
        aria-label={`${window.label}: verbraucht`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={window.usedPercent}
        aria-valuetext={`${percent} Prozent verbraucht${expired ? ", Rücksetzung ausstehend" : ""}`}
        style={{
          height: compact ? 6 : 8,
          background: tokens.colors.border,
          borderRadius: tokens.radius.sm,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${window.usedPercent}%`,
            height: "100%",
            background: color,
          }}
        />
      </div>
      {!compact && (
        <span style={{ fontSize: "0.75rem", color: tokens.colors.textMuted }}>
          {expired
            ? "Rücksetzung ausstehend · bitte aktualisieren"
            : reset
              ? `Reset ${reset.toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}`
              : "Rücksetzzeit nicht verfügbar"}
        </span>
      )}
    </div>
  );
}

/** App and widget subscribe to the same app-scoped cache; timers are cleaned on unmount. */
export function UsageContent({
  compact = false,
}: {
  readonly compact?: boolean;
}) {
  const dashboard = useDashboard();
  const { tokens } = useDashboardTheme();
  const state = useAppQuery({ key: usageKey, query: loadUsage });
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible")
        dashboard.data.invalidate(usageKey);
    };
    const timer = setInterval(refresh, 60000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [dashboard.data]);
  if (state.status === "loading") return <LoadingState />;
  if (state.status === "error")
    return (
      <ErrorState
        message={state.error.message}
        onRetry={() => dashboard.data.invalidate(usageKey)}
      />
    );
  if (!state.data.windows.length)
    return (
      <EmptyState title="Keine Limits verfügbar">
        <p>Codex liefert für dieses Konto aktuell keine Verbrauchswerte.</p>
        <Button onClick={() => dashboard.data.invalidate(usageKey)}>
          Aktualisieren
        </Button>
      </EmptyState>
    );
  const age = Date.now() - Date.parse(state.data.updatedAt);
  return (
    <div
      style={{
        display: "grid",
        gap: tokens.spacing.md,
        color: tokens.colors.text,
      }}
    >
      <span style={{ color: tokens.colors.textMuted, fontSize: "0.75rem" }}>
        Verbraucht{age > 120000 ? " · Daten veraltet" : ""}
      </span>
      {state.data.windows.map((window) => (
        <UsageBar key={window.id} window={window} compact={compact} />
      ))}
      {!compact && (
        <div
          style={{
            display: "flex",
            gap: tokens.spacing.sm,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <span style={{ color: tokens.colors.textMuted, fontSize: "0.75rem" }}>
            Stand{" "}
            {new Date(state.data.updatedAt).toLocaleTimeString("de-DE", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
          <Button onClick={() => dashboard.data.invalidate(usageKey)}>
            Aktualisieren
          </Button>
        </div>
      )}
    </div>
  );
}
