import type { ComfyApi, ComfyApp } from "@comfyorg/comfyui-frontend-types";
import { EXTENSION_NAME, SETTINGS_IDS } from "./constants";
import { debugLog } from "./debug";
import {
  configureResourceMonitor,
  disconnectResourceMonitor,
  type ResourceMonitorApiClient,
  RESOURCE_MONITOR_EVENT_NAME,
} from "./resource-monitor/api";
import { mountResourceMonitor } from "./resource-monitor/mount";
import {
  DEFAULT_SETTINGS,
  createResourceMonitorSettings,
} from "./resource-monitor/settings";

declare global {
  const app: ComfyApp;
  const api: ComfyApi;

  interface Window {
    app: ComfyApp;
  }
}

let disposeResourceMonitor: (() => void) | null = null;
let currentApp: ComfyApp | null = null;
let configureSequence = 0;
let pendingConfigure: Promise<void> = Promise.resolve();
let keepaliveTimer: number | null = null;

const KEEPALIVE_INTERVAL_MS = 15_000;
const DISCONNECT_API_ROUTE = "/api/resource-monitor/disconnect";

(api as ResourceMonitorApiClient).addEventListener?.(
  RESOURCE_MONITOR_EVENT_NAME,
  () => undefined,
);

function readRefreshRate(app: ComfyApp): number {
  return (
    app.extensionManager.setting.get<number | undefined>(SETTINGS_IDS.REFRESH_RATE) ??
    DEFAULT_SETTINGS.refreshRate
  );
}

function clearKeepaliveTimer(): void {
  if (keepaliveTimer !== null) {
    window.clearInterval(keepaliveTimer);
    keepaliveTimer = null;
  }
}

function disconnectCurrentClient(): void {
  const clientId = api.clientId ?? api.initialClientId;
  if (clientId === undefined || clientId === null) {
    return;
  }

  if (typeof navigator.sendBeacon === "function") {
    const payload = new Blob(
      [JSON.stringify({ client_id: clientId })],
      { type: "application/json" },
    );
    navigator.sendBeacon(DISCONNECT_API_ROUTE, payload);
    return;
  }

  void disconnectResourceMonitor(api);
}

function queueConfigure(forceRefresh: boolean): void {
  if (currentApp === null) {
    return;
  }

  const app = currentApp;
  const hasClientId = (api.clientId ?? api.initialClientId) != null;
  const refreshRate = readRefreshRate(app);
  const sequence = ++configureSequence;

  pendingConfigure = pendingConfigure
    .catch(() => undefined)
    .then(async () => {
      const result = await configureResourceMonitor(api, refreshRate, {
        forceRefresh,
      });
      if (sequence !== configureSequence) {
        return;
      }

      if (result === null) {
        debugLog("resource monitor configure failed");
        return;
      }

      if (forceRefresh && hasClientId && !result.started) {
        debugLog("resource monitor service did not start");
      }
    })
    .catch((error: Error) => {
      if (sequence === configureSequence) {
        debugLog("resource monitor configure failed", error.message);
      }
    });
}

function remountResourceMonitor(): void {
  if (currentApp === null) {
    return;
  }

  clearKeepaliveTimer();
  disposeResourceMonitor?.();
  disposeResourceMonitor = mountResourceMonitor(currentApp, api, {
    clearControlsDeps: {
      fetchApi: (path: string, options?: RequestInit) => api.fetchApi(path, options),
      toastAdd: (msg) => currentApp?.extensionManager.toast.add(msg),
    },
  });
  queueConfigure(true);
  keepaliveTimer = window.setInterval(() => {
    queueConfigure(false);
  }, KEEPALIVE_INTERVAL_MS);
}

app.registerExtension({
  name: EXTENSION_NAME,
  settings: createResourceMonitorSettings(() => {
    remountResourceMonitor();
  }),
  setup(app: ComfyApp) {
    currentApp = app;
    api.addEventListener("reconnected", () => {
      queueConfigure(true);
    });
    window.addEventListener("focus", () => {
      queueConfigure(true);
    });
    window.addEventListener("pagehide", () => {
      disconnectCurrentClient();
    });
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        queueConfigure(true);
      }
    });
    remountResourceMonitor();
  },
});
