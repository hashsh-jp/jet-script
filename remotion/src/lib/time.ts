/**
 * 秒 → フレーム変換
 */
export function secToFrames(sec: number, fps: number): number {
  return Math.round(sec * fps);
}

/**
 * 0.1秒単位に丸める
 */
export function roundToUnit(n: number, unit: number = 0.1): number {
  return Math.round(n / unit) * unit;
}
