import { describe, expect, it } from "vitest";

import {
  DEFAULT_SETTINGS,
  SETTINGS_IDS,
  createResourceMonitorSettings,
} from "../src/resource-monitor/settings";

describe("resource monitor settings", () => {
  it("uses stable ids and defaults for the monitor configuration", () => {
    expect(SETTINGS_IDS.DISPLAY_MODE).toBe("Resource Monitor.Display Mode");
    expect(SETTINGS_IDS.REFRESH_RATE).toBe("Resource Monitor.Refresh Rate");
    expect(SETTINGS_IDS.SHOW_GPU_TEMP).toBe("Resource Monitor.Show GPU Temp");

    expect(DEFAULT_SETTINGS.displayMode).toBe("top");
    expect(DEFAULT_SETTINGS.refreshRate).toBe(1);
    expect(DEFAULT_SETTINGS.showGpuTemp).toBe(true);
  });

  it("creates the expected settings collection", () => {
    const settings = createResourceMonitorSettings();

    expect(settings.map((setting) => setting.id)).toEqual([
      SETTINGS_IDS.VERSION,
      SETTINGS_IDS.DEBUG_LOGGING,
      SETTINGS_IDS.DISPLAY_MODE,
      SETTINGS_IDS.EXPANDED_BY_DEFAULT,
      SETTINGS_IDS.REFRESH_RATE,
      SETTINGS_IDS.SMOOTH_TRANSITIONS,
      SETTINGS_IDS.TEXT_DENSITY,
      SETTINGS_IDS.SHOW_CPU,
      SETTINGS_IDS.SHOW_RAM,
      SETTINGS_IDS.SHOW_GPU,
      SETTINGS_IDS.SHOW_VRAM,
      SETTINGS_IDS.SHOW_GPU_TEMP,
    ]);
    expect(settings.find((setting) => setting.id === SETTINGS_IDS.DISPLAY_MODE))
      .toMatchObject({
        defaultValue: "top",
        type: "combo",
      });
    expect(settings.find((setting) => setting.id === SETTINGS_IDS.REFRESH_RATE))
      .toMatchObject({
        defaultValue: 1,
        type: "slider",
      });
  });

  it("wires setting changes to an immediate refresh callback", () => {
    let refreshCalls = 0;
    const settings = createResourceMonitorSettings(() => {
      refreshCalls += 1;
    });

    const displayModeSetting = settings.find(
      (setting) => setting.id === SETTINGS_IDS.DISPLAY_MODE,
    );
    const gpuSetting = settings.find(
      (setting) => setting.id === SETTINGS_IDS.SHOW_GPU_TEMP,
    );

    if (!displayModeSetting || !("onChange" in displayModeSetting)) {
      throw new Error("Display mode setting should expose onChange");
    }

    if (!gpuSetting || !("onChange" in gpuSetting)) {
      throw new Error("GPU temp setting should expose onChange");
    }

    displayModeSetting.onChange?.("bottom", "top");
    gpuSetting.onChange?.(false, true);

    expect(refreshCalls).toBe(2);
  });
});
