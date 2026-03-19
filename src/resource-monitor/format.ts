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

export function formatTooltip(
  metric: MetricKey,
  snapshot: ResourceSnapshot,
): string {
  switch (metric) {
    case "cpu":
      return `CPU Usage: ${snapshot.cpu_percent.toFixed(1)}%`;
    case "ram":
      return `RAM: ${formatUsagePair(snapshot.ram_used_bytes, snapshot.ram_total_bytes)} (${snapshot.ram_percent.toFixed(1)}%)`;
    case "gpu":
      return snapshot.gpu_available
        ? `${snapshot.gpu_name}: ${snapshot.gpu_percent.toFixed(1)}%`
        : "GPU: Not available";
    case "vram":
      return snapshot.gpu_available
        ? `VRAM: ${formatUsagePair(snapshot.vram_used_bytes, snapshot.vram_total_bytes)} (${snapshot.vram_percent.toFixed(1)}%)`
        : "VRAM: Not available";
    case "gpuTemp":
      return snapshot.gpu_available
        ? `GPU Temperature: ${snapshot.gpu_temp_celsius.toFixed(1)}\u00B0C`
        : "GPU Temperature: Not available";
  }
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
        ? `${Math.round(snapshot.gpu_temp_celsius)}\u00B0C`
        : "N/A";
  }
}
