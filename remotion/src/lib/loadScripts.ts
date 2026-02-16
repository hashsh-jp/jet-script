// Type definitions for scripts.json

export interface Segment {
  id: string;
  text: string;
  orig: { start: number; end: number };
  cut: { start: number; end: number };
  confidence?: number;
  words?: Array<{ word: string; start: number; end: number }>;
}

export interface ScriptsJson {
  source: { videoPath: string };
  settings: {
    timeUnitSec: number;
    mergeGapSec: number;
    minSegmentDurationSec: number;
  };
  segments: Segment[];
}

export function loadScripts(json: unknown): ScriptsJson {
  const data = json as ScriptsJson;
  if (!data.segments || !Array.isArray(data.segments)) {
    throw new Error("scripts.json: segments が見つかりません");
  }
  if (data.segments.length === 0) {
    throw new Error("scripts.json: segments が空です");
  }
  return data;
}
