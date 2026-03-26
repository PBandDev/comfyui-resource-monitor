import {
  triggerResourceClearAction,
  type ResourceMonitorApiClient,
  type ResourceClearAction,
} from "./api";

interface ButtonConfig {
  readonly tooltip: string;
  readonly success: string;
  readonly failure: string;
  readonly icon: string;
}

const BUTTON_CONFIGS: Record<ResourceClearAction, ButtonConfig> = {
  unloadModels: {
    tooltip: "Unload models from VRAM",
    success: "Models unloaded",
    failure: "Failed to unload models",
    icon: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4",
  },
  freeMemory: {
    tooltip: "Free all memory, models, and VRAM",
    success: "Memory cleared",
    failure: "Failed to free memory",
    icon: "M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16",
  },
};

type ToastSeverity = "success" | "info" | "warn" | "error";

interface ToastMessage {
  severity: ToastSeverity;
  summary: string;
  life: number;
}

export interface ClearControlsDeps {
  showClearButtons: boolean;
  fetchApi: ResourceMonitorApiClient["fetchApi"];
  toastAdd: (message: ToastMessage) => void;
}

export interface ClearControlsHandle {
  root: HTMLDivElement;
  dispose: () => void;
}

function createSvgIcon(pathD: string): SVGSVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("width", "16");
  svg.setAttribute("height", "16");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");

  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", pathD);
  svg.appendChild(path);

  return svg;
}

function createClearButton(
  action: ResourceClearAction,
  config: ButtonConfig,
  deps: ClearControlsDeps,
): HTMLButtonElement {
  const button = document.createElement("button");
  button.className = "rm-clear-btn";
  button.setAttribute("data-tooltip", config.tooltip);
  button.setAttribute("data-rm-clear-action", action);
  button.setAttribute("aria-label", config.tooltip);
  button.appendChild(createSvgIcon(config.icon));

  button.addEventListener("click", () => {
    const apiClient: ResourceMonitorApiClient = { fetchApi: deps.fetchApi };
    void triggerResourceClearAction(apiClient, action).then((ok) => {
      deps.toastAdd({
        severity: ok ? "success" : "error",
        summary: ok ? config.success : config.failure,
        life: 3000,
      });
    });
  });

  return button;
}

export function createClearControls(deps: ClearControlsDeps): ClearControlsHandle {
  const root = document.createElement("div");
  root.className = "rm-clear-controls";

  if (deps.showClearButtons) {
    for (const action of Object.keys(BUTTON_CONFIGS) as ResourceClearAction[]) {
      root.appendChild(createClearButton(action, BUTTON_CONFIGS[action], deps));
    }
  }

  return {
    root,
    dispose: () => {
      root.remove();
    },
  };
}
