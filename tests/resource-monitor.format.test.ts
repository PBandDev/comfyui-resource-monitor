import { describe, expect, it } from "vitest";

import {
  formatMetricValue,
  formatPercent,
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
});
