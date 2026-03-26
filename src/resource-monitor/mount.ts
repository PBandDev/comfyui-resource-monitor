import type { ComfyApp } from "@comfyorg/comfyui-frontend-types";

import { debugLog } from "../debug";
import { SETTINGS_IDS } from "../constants";
import { DEFAULT_SETTINGS } from "./settings";
import monitorStyles from "./styles.css?inline";
import {
  fetchInitialSnapshot,
  subscribeToSnapshots,
  type ResourceMonitorApiClient,
} from "./api";
import { createResourceMonitorDom, type ResourceMonitorDom } from "./dom";
import { resolveMonitorMountTarget } from "./hosts";
import {
  reduceSnapshot,
  resolveExpandedState,
  selectMetricRows,
} from "./store";
import {
  createClearControls,
  type ClearControlsDeps,
  type ClearControlsHandle,
} from "./clear-controls";
import type { ResourceMonitorSettingsValues, ResourceSnapshot } from "./types";

const STYLE_ELEMENT_ID = "resource-monitor-inline-styles";

function ensureMonitorStyles(): void {
  if (document.getElementById(STYLE_ELEMENT_ID)) {
    return;
  }

  const styleElement = document.createElement("style");
  styleElement.id = STYLE_ELEMENT_ID;
  styleElement.textContent = monitorStyles;
  document.head.appendChild(styleElement);
}

function readSetting<TValue>(app: ComfyApp, id: string, fallback: TValue): TValue {
  const value = app.extensionManager.setting.get<TValue | undefined>(id);
  return value ?? fallback;
}

function readMonitorSettings(app: ComfyApp): ResourceMonitorSettingsValues {
  return {
    displayMode: readSetting(app, SETTINGS_IDS.DISPLAY_MODE, DEFAULT_SETTINGS.displayMode),
    refreshRate: readSetting(app, SETTINGS_IDS.REFRESH_RATE, DEFAULT_SETTINGS.refreshRate),
    smoothTransitions: readSetting(
      app,
      SETTINGS_IDS.SMOOTH_TRANSITIONS,
      DEFAULT_SETTINGS.smoothTransitions,
    ),
    textDensity: readSetting(app, SETTINGS_IDS.TEXT_DENSITY, DEFAULT_SETTINGS.textDensity),
    showCpu: readSetting(app, SETTINGS_IDS.SHOW_CPU, DEFAULT_SETTINGS.showCpu),
    showRam: readSetting(app, SETTINGS_IDS.SHOW_RAM, DEFAULT_SETTINGS.showRam),
    showGpu: readSetting(app, SETTINGS_IDS.SHOW_GPU, DEFAULT_SETTINGS.showGpu),
    showVram: readSetting(app, SETTINGS_IDS.SHOW_VRAM, DEFAULT_SETTINGS.showVram),
    showGpuTemp: readSetting(
      app,
      SETTINGS_IDS.SHOW_GPU_TEMP,
      DEFAULT_SETTINGS.showGpuTemp,
    ),
    showClearButtons: readSetting(
      app,
      SETTINGS_IDS.SHOW_CLEAR_BUTTONS,
      DEFAULT_SETTINGS.showClearButtons,
    ),
    debugLogging: readSetting(
      app,
      SETTINGS_IDS.DEBUG_LOGGING,
      DEFAULT_SETTINGS.debugLogging,
    ),
  };
}

export interface MountResourceMonitorOptions {
  clearControlsDeps?: Omit<ClearControlsDeps, "showClearButtons">;
}

function renderMonitor(
  settings: ResourceMonitorSettingsValues,
  dom: ResourceMonitorDom,
  snapshot: ResourceSnapshot | null,
  expanded: boolean,
  clearControls: ClearControlsHandle | null,
): void {
  const target = resolveMonitorMountTarget(settings.displayMode);
  dom.attachTo(target);
  dom.setMode(settings.displayMode);
  dom.setExpanded(expanded);
  dom.setSmoothTransitions(settings.smoothTransitions);
  dom.renderRows(selectMetricRows(snapshot, settings));

  if (clearControls && target && clearControls.root.parentElement !== target) {
    target.appendChild(clearControls.root);
  }
}

export interface ResourceMonitorHandle {
  dispose: () => void;
  refresh: () => void;
}

export function mountResourceMonitor(
  app: ComfyApp,
  api: ResourceMonitorApiClient,
  options: MountResourceMonitorOptions = {},
): ResourceMonitorHandle {
  ensureMonitorStyles();

  let currentSnapshot: ResourceSnapshot | null = null;
  let currentSettings = readMonitorSettings(app);
  let currentDisplayMode: ResourceMonitorSettingsValues["displayMode"] | null = null;
  let isExpanded = resolveExpandedState(false, null, currentSettings.displayMode);
  let layoutRefreshQueued = false;
  let clearControls: ClearControlsHandle | null = null;
  let isDisposed = false;

  function rebuildClearControls(): ClearControlsHandle | null {
    clearControls?.dispose();
    clearControls = null;

    if (!options.clearControlsDeps) return null;

    clearControls = createClearControls({
      ...options.clearControlsDeps,
      showClearButtons: currentSettings.showClearButtons,
    });
    return clearControls;
  }

  const dom = createResourceMonitorDom({
    onExpandedChange(expanded) {
      isExpanded = expanded;
    },
  });

  const refreshView = (): void => {
    if (isDisposed) return;

    const prevShowClearButtons = currentSettings.showClearButtons;
    currentSettings = readMonitorSettings(app);

    if (currentSettings.showClearButtons !== prevShowClearButtons) {
      const rebuilt = rebuildClearControls();
      if (rebuilt) {
        dom.attachTooltip(rebuilt.root);
      }
    }

    isExpanded = resolveExpandedState(
      isExpanded,
      currentDisplayMode,
      currentSettings.displayMode,
    );
    currentDisplayMode = currentSettings.displayMode;
    renderMonitor(currentSettings, dom, currentSnapshot, isExpanded, clearControls);
  };

  const requestLayoutRefresh = (): void => {
    if (layoutRefreshQueued || isDisposed) {
      return;
    }

    layoutRefreshQueued = true;
    requestAnimationFrame(() => {
      layoutRefreshQueued = false;
      if (!isDisposed) refreshView();
    });
  };

  const applyPatch = (patch: Partial<ResourceSnapshot> | null): void => {
    if (isDisposed) return;
    currentSnapshot = reduceSnapshot(currentSnapshot, patch);
    refreshView();
  };

  const layoutObserver = new MutationObserver(() => {
    const nextTarget = resolveMonitorMountTarget(currentSettings.displayMode);
    if (dom.root.parentElement !== nextTarget) {
      requestLayoutRefresh();
    }
  });

  layoutObserver.observe(document.body, {
    childList: true,
    subtree: true,
  });

  void fetchInitialSnapshot(api)
    .then((patch) => {
      applyPatch(patch);
    })
    .catch((error: Error) => {
      debugLog("resource monitor bootstrap failed", error.message);
    });

  const unsubscribe = subscribeToSnapshots(api, (patch) => {
    applyPatch(patch);
  });

  const initialClearControls = rebuildClearControls();
  if (initialClearControls) {
    dom.attachTooltip(initialClearControls.root);
  }
  refreshView();

  return {
    dispose() {
      isDisposed = true;
      unsubscribe();
      layoutObserver.disconnect();
      clearControls?.dispose();
      dom.dispose();
      dom.attachTo(null);
      dom.root.remove();
    },
    refresh: refreshView,
  };
}
