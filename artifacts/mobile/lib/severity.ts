import type { Severity } from "@/context/AppContext";
import type { useColors } from "@/hooks/useColors";

export function severityColor(severity: Severity, colors: ReturnType<typeof useColors>): string {
  switch (severity) {
    case "high": return colors.danger;
    case "medium": return colors.warning;
    case "low": return colors.success;
  }
}

export function severityLabel(severity: Severity): string {
  switch (severity) {
    case "high": return "High";
    case "medium": return "Medium";
    case "low": return "Low";
  }
}
