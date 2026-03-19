import { describe, expect, it } from "vitest";

import { DEFAULT_SETTINGS } from "../src/resource-monitor/settings";
import {
  reduceSnapshot,
  resolveExpandedState,
  selectMetricRows,
} from "../src/resource-monitor/store";
import type { ResourceSnapshot } from "../src/resource-monitor/types";

const baseSnapshot: ResourceSnapshot = {
  timestamp: 123,
  cpu_percent: 45,
  ram_percent: 50,
  ram_used_bytes: 2 * 1024 ** 3,
  ram_total_bytes: 4 * 1024 ** 3,
  gpu_available: true,
  gpu_name: "RTX",
  gpu_percent: 66,
  vram_percent: 25,
  vram_used_bytes: 3 * 1024 ** 3,
  vram_total_bytes: 12 * 1024 ** 3,
  gpu_temp_celsius: 58,
};

describe("resource monitor store", () => {
  it("retains the last good snapshot values when partial payloads arrive", () => {
    const next = reduceSnapshot(baseSnapshot, {
      timestamp: 124,
      gpu_available: false,
    });

    expect(next).toEqual({
      ...baseSnapshot,
      timestamp: 124,
      gpu_available: false,
      gpu_percent: 66,
      vram_percent: 25,
      gpu_temp_celsius: 58,
    });
  });

  it("selects metric rows in fixed order with gpu fallbacks", () => {
    const rows = selectMetricRows(
      {
        ...baseSnapshot,
        gpu_available: false,
      },
      {
        ...DEFAULT_SETTINGS,
        textDensity: "detailed",
      },
    );

    expect(rows.map((row) => row.key)).toEqual([
      "cpu",
      "ram",
      "gpu",
      "vram",
      "gpuTemp",
    ]);
    expect(rows.find((row) => row.key === "gpu")?.text).toBe("N/A");
    expect(rows.find((row) => row.key === "vram")?.text).toBe("N/A");
    expect(rows.find((row) => row.key === "gpuTemp")?.text).toBe("N/A");
    expect(rows.find((row) => row.key === "cpu")?.percent).toBe(45);
    expect(rows.find((row) => row.key === "cpu")?.tooltip).toBe("CPU Usage: 45.0%");
    expect(rows.find((row) => row.key === "gpu")?.tooltip).toBe("GPU: Not available");
  });

  it("collapsed always starts closed, top/bottom always starts expanded", () => {
    // Initial mount in collapsed mode -> closed
    expect(resolveExpandedState(false, null, "collapsed")).toBe(false);

    // User manually expanded -> stays expanded
    expect(resolveExpandedState(true, "collapsed", "collapsed")).toBe(true);

    // Switch from top to collapsed -> starts closed
    expect(resolveExpandedState(true, "top", "collapsed")).toBe(false);

    // Switch from collapsed to top -> starts expanded
    expect(resolveExpandedState(false, "collapsed", "top")).toBe(true);

    // Initial mount in top mode -> expanded
    expect(resolveExpandedState(false, null, "top")).toBe(true);
  });
});
