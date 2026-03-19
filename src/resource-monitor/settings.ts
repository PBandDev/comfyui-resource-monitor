import {
  CURRENT_VERSION,
  REPOSITORY_URL,
  SETTINGS_IDS,
  SETTINGS_PREFIX,
} from "../constants";
import type { DisplayMode, ResourceMonitorSettingsValues, TextDensity } from "./types";

type SettingCategory = string[];

interface SettingBase {
  id: string;
  name: string;
  tooltip?: string;
  category?: SettingCategory;
  onChange?: (
    newValue: string | number | boolean | undefined,
    oldValue: string | number | boolean | undefined,
  ) => void;
}

interface AboutSettingDefinition extends SettingBase {
  type: () => HTMLElement;
  defaultValue: undefined;
}

interface BooleanSettingDefinition extends SettingBase {
  type: "boolean";
  defaultValue: boolean;
}

interface SliderSettingDefinition extends SettingBase {
  type: "slider";
  defaultValue: number;
  attrs: {
    min: number;
    max: number;
    step: number;
  };
}

interface ComboOption<TValue extends string> {
  text: string;
  value: TValue;
}

interface ComboSettingDefinition<TValue extends string> extends SettingBase {
  type: "combo";
  defaultValue: TValue;
  options: ComboOption<TValue>[];
}

export type ResourceMonitorSettingDefinition =
  | AboutSettingDefinition
  | BooleanSettingDefinition
  | SliderSettingDefinition
  | ComboSettingDefinition<DisplayMode | TextDensity>;

export const DEFAULT_SETTINGS: ResourceMonitorSettingsValues = {
  displayMode: "top",
  refreshRate: 1,
  smoothTransitions: true,
  textDensity: "compact",
  showCpu: true,
  showRam: true,
  showGpu: true,
  showVram: true,
  showGpuTemp: true,
  debugLogging: false,
};

const DISPLAY_MODE_OPTIONS: ComboOption<DisplayMode>[] = [
  { text: "Top", value: "top" },
  { text: "Bottom", value: "bottom" },
  { text: "Collapsed", value: "collapsed" },
];

const TEXT_DENSITY_OPTIONS: ComboOption<TextDensity>[] = [
  { text: "Compact", value: "compact" },
  { text: "Detailed", value: "detailed" },
];

export { SETTINGS_IDS };

function createSettingChangeHandler(
  onSettingsChange?: () => void,
): SettingBase["onChange"] {
  if (!onSettingsChange) {
    return undefined;
  }

  return () => {
    onSettingsChange();
  };
}

function createAboutSetting(): AboutSettingDefinition {
  return {
    id: SETTINGS_IDS.VERSION,
    name: `Version ${CURRENT_VERSION}`,
    category: [SETTINGS_PREFIX, "About", "Version"],
    type: () => {
      const spanEl = document.createElement("span");
      const homepageLink = document.createElement("a");
      homepageLink.href = REPOSITORY_URL;
      homepageLink.target = "_blank";
      homepageLink.rel = "noopener noreferrer";
      homepageLink.style.paddingRight = "12px";
      homepageLink.textContent = "Homepage";
      spanEl.appendChild(homepageLink);
      return spanEl;
    },
    defaultValue: undefined,
  };
}

export function createResourceMonitorSettings(
  onSettingsChange?: () => void,
): ResourceMonitorSettingDefinition[] {
  const handleSettingChange = createSettingChangeHandler(onSettingsChange);

  return [
    createAboutSetting(),
    {
      id: SETTINGS_IDS.DEBUG_LOGGING,
      name: "Enable Debug Logging",
      category: [SETTINGS_PREFIX, "Advanced", "Debug Logging"],
      type: "boolean",
      tooltip: "Show detailed debug logs in browser console during operation",
      defaultValue: DEFAULT_SETTINGS.debugLogging,
      onChange: handleSettingChange,
    },
    {
      id: SETTINGS_IDS.DISPLAY_MODE,
      name: "Display Mode",
      category: [SETTINGS_PREFIX, "Display", "Mode"],
      type: "combo",
      defaultValue: DEFAULT_SETTINGS.displayMode,
      options: DISPLAY_MODE_OPTIONS,
      onChange: handleSettingChange,
    },
    {
      id: SETTINGS_IDS.REFRESH_RATE,
      name: "Refresh Rate",
      category: [SETTINGS_PREFIX, "Display", "Refresh Rate"],
      type: "slider",
      tooltip: "Seconds between monitor updates.",
      defaultValue: DEFAULT_SETTINGS.refreshRate,
      attrs: {
        min: 0.5,
        max: 2,
        step: 0.5,
      },
      onChange: handleSettingChange,
    },
    {
      id: SETTINGS_IDS.SMOOTH_TRANSITIONS,
      name: "Smooth Transitions",
      category: [SETTINGS_PREFIX, "Display", "Smooth Transitions"],
      type: "boolean",
      defaultValue: DEFAULT_SETTINGS.smoothTransitions,
      onChange: handleSettingChange,
    },
    {
      id: SETTINGS_IDS.TEXT_DENSITY,
      name: "Text Density",
      category: [SETTINGS_PREFIX, "Display", "Text Density"],
      type: "combo",
      defaultValue: DEFAULT_SETTINGS.textDensity,
      options: TEXT_DENSITY_OPTIONS,
      onChange: handleSettingChange,
    },
    {
      id: SETTINGS_IDS.SHOW_CPU,
      name: "Show CPU",
      category: [SETTINGS_PREFIX, "Metrics", "CPU"],
      type: "boolean",
      defaultValue: DEFAULT_SETTINGS.showCpu,
      onChange: handleSettingChange,
    },
    {
      id: SETTINGS_IDS.SHOW_RAM,
      name: "Show RAM",
      category: [SETTINGS_PREFIX, "Metrics", "RAM"],
      type: "boolean",
      defaultValue: DEFAULT_SETTINGS.showRam,
      onChange: handleSettingChange,
    },
    {
      id: SETTINGS_IDS.SHOW_GPU,
      name: "Show GPU",
      category: [SETTINGS_PREFIX, "Metrics", "GPU"],
      type: "boolean",
      defaultValue: DEFAULT_SETTINGS.showGpu,
      onChange: handleSettingChange,
    },
    {
      id: SETTINGS_IDS.SHOW_VRAM,
      name: "Show VRAM",
      category: [SETTINGS_PREFIX, "Metrics", "VRAM"],
      type: "boolean",
      defaultValue: DEFAULT_SETTINGS.showVram,
      onChange: handleSettingChange,
    },
    {
      id: SETTINGS_IDS.SHOW_GPU_TEMP,
      name: "Show GPU Temp",
      category: [SETTINGS_PREFIX, "Metrics", "GPU Temp"],
      type: "boolean",
      defaultValue: DEFAULT_SETTINGS.showGpuTemp,
      onChange: handleSettingChange,
    },
  ];
}
