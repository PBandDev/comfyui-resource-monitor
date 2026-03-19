import type { MetricKey, ResourceSnapshot, TextDensity } from "./types";

function formatGiB(bytes: number): string {
  return (bytes / 1024 ** 3).toFixed(1);
}

export function formatPercent(value: number): string {
  return `${Math.round(value)}%`;
}

export function formatUsagePair(usedBytes: number, totalBytes: number): string {
  return `${formatGiB(usedBytes)} / ${formatGiB(totalBytes)} GiB`;
}

export function formatMetricValue(
  metric: MetricKey,
  snapshot: ResourceSnapshot,
  density: TextDensity,
): string {
  switch (metric) {
    case "cpu":
      return formatPercent(snapshot.cpu_percent);
    case "ram":
      return density === "detailed"
        ? formatUsagePair(snapshot.ram_used_bytes, snapshot.ram_total_bytes)
        : formatPercent(snapshot.ram_percent);
    case "gpu":
      return snapshot.gpu_available ? formatPercent(snapshot.gpu_percent) : "N/A";
    case "vram":
      if (!snapshot.gpu_available) {
        return "N/A";
      }
      return density === "detailed"
        ? formatUsagePair(snapshot.vram_used_bytes, snapshot.vram_total_bytes)
        : formatPercent(snapshot.vram_percent);
    case "gpuTemp":
      return snapshot.gpu_available
        ? `${Math.round(snapshot.gpu_temp_celsius)}C`
        : "N/A";
  }
}
