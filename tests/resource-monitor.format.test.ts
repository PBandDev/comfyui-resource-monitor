import { describe, expect, it } from "vitest";

import {
  formatMetricValue,
  formatPercent,
  formatTooltip,
  formatUsagePair,
} from "../src/resource-monitor/format";
import type { ResourceSnapshot } from "../src/resource-monitor/types";

const snapshot: ResourceSnapshot = {
  timestamp: 123,
  cpu_percent: 12.34,
  ram_percent: 50,
  ram_used_bytes: 2 * 1024 ** 3,
  ram_total_bytes: 4 * 1024 ** 3,
  gpu_available: false,
  gpu_name: "",
  gpu_percent: 0,
  vram_percent: 0,
  vram_used_bytes: 0,
  vram_total_bytes: 0,
  gpu_temp_celsius: 0,
};

describe("resource monitor formatters", () => {
  it("formats percentages as whole-number labels", () => {
    expect(formatPercent(12.34)).toBe("12%");
  });

  it("formats used and total bytes as GiB pairs", () => {
    expect(formatUsagePair(2 * 1024 ** 3, 4 * 1024 ** 3)).toBe("2.0 / 4.0 GiB");
  });

  it("shows N/A when gpu-backed metrics are unavailable", () => {
    expect(formatMetricValue("gpu", snapshot, "compact")).toBe("N/A");
    expect(formatMetricValue("vram", snapshot, "detailed")).toBe("N/A");
    expect(formatMetricValue("gpuTemp", snapshot, "compact")).toBe("N/A");
  });

  it("formats cpu and ram values from the shared snapshot shape", () => {
    expect(formatMetricValue("cpu", snapshot, "compact")).toBe("12%");
    expect(formatMetricValue("ram", snapshot, "detailed")).toBe("2.0 / 4.0 GiB");
  });

  it("formats gpu temp with degree symbol when available", () => {
    const gpuSnapshot: ResourceSnapshot = {
      ...snapshot,
      gpu_available: true,
      gpu_temp_celsius: 65,
    };
    expect(formatMetricValue("gpuTemp", gpuSnapshot, "compact")).toBe("65\u00B0C");
  });

  it("generates tooltips with full detail for each metric", () => {
    expect(formatTooltip("cpu", snapshot)).toBe("CPU Usage: 12.3%");
    expect(formatTooltip("ram", snapshot)).toBe("RAM: 2.0 / 4.0 GiB (50.0%)");
    expect(formatTooltip("gpu", snapshot)).toBe("GPU: Not available");
  });

  it("generates tooltips with GPU name when available", () => {
    const gpuSnapshot: ResourceSnapshot = {
      ...snapshot,
      gpu_available: true,
      gpu_name: "RTX 4090",
      gpu_percent: 42.5,
      vram_used_bytes: 8 * 1024 ** 3,
      vram_total_bytes: 24 * 1024 ** 3,
      vram_percent: 33.3,
      gpu_temp_celsius: 65.7,
    };
    expect(formatTooltip("gpu", gpuSnapshot)).toBe("RTX 4090: 42.5%");
    expect(formatTooltip("vram", gpuSnapshot)).toBe("VRAM: 8.0 / 24.0 GiB (33.3%)");
    expect(formatTooltip("gpuTemp", gpuSnapshot)).toBe("GPU Temperature: 65.7\u00B0C");
  });
});
