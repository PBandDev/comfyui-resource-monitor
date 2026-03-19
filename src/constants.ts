export const SETTINGS_PREFIX = "Resource Monitor";
export const LOGGING_PREFIX = `[${SETTINGS_PREFIX}]`;
export const EXTENSION_NAME = "ComfyUI Resource Monitor";
export const REPOSITORY_URL =
  "https://github.com/PBandDev/comfyui-resource-monitor";
export const CURRENT_VERSION = "1.0.0";
export const SETTINGS_IDS = {
  VERSION: `${SETTINGS_PREFIX}.About`,
  DEBUG_LOGGING: `${SETTINGS_PREFIX}.Debug Logging`,
  DISPLAY_MODE: `${SETTINGS_PREFIX}.Display Mode`,
  REFRESH_RATE: `${SETTINGS_PREFIX}.Refresh Rate`,
  SMOOTH_TRANSITIONS: `${SETTINGS_PREFIX}.Smooth Transitions`,
  TEXT_DENSITY: `${SETTINGS_PREFIX}.Text Density`,
  SHOW_CPU: `${SETTINGS_PREFIX}.Show CPU`,
  SHOW_RAM: `${SETTINGS_PREFIX}.Show RAM`,
  SHOW_GPU: `${SETTINGS_PREFIX}.Show GPU`,
  SHOW_VRAM: `${SETTINGS_PREFIX}.Show VRAM`,
  SHOW_GPU_TEMP: `${SETTINGS_PREFIX}.Show GPU Temp`,
} as const;
