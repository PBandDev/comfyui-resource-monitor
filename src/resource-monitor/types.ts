export type DisplayMode = "top" | "bottom" | "collapsed";
export type TextDensity = "compact" | "detailed";
export type MetricKey = "cpu" | "ram" | "gpu" | "vram" | "gpuTemp";

export interface ResourceSnapshot {
  timestamp: number;
  cpu_percent: number;
  ram_percent: number;
  ram_used_bytes: number;
  ram_total_bytes: number;
  gpu_available: boolean;
  gpu_name: string;
  gpu_percent: number;
  vram_percent: number;
  vram_used_bytes: number;
  vram_total_bytes: number;
  gpu_temp_celsius: number;
}

export interface ResourceMonitorSettingsValues {
  displayMode: DisplayMode;
  refreshRate: number;
  smoothTransitions: boolean;
  textDensity: TextDensity;
  showCpu: boolean;
  showRam: boolean;
  showGpu: boolean;
  showVram: boolean;
  showGpuTemp: boolean;
  debugLogging: boolean;
}
