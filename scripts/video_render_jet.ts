/**
 * video_render_jet.ts
 *
 * scripts.json → Remotion render → jet.mp4
 *
 * 実行: npm run all (video-edit ディレクトリ内で実行)
 */
import "dotenv/config";
import fs from "fs";
import path from "path";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { prepareCombinedBase } from "./base-video";

const BASE_DIR = process.cwd();
const SCRIPTS_JSON = path.join(BASE_DIR, "scripts.json");
const OUTPUT = path.join(BASE_DIR, "jet.mp4");
const REMOTION_ENTRY = path.join(BASE_DIR, "remotion/src/index.ts");
const PUBLIC_DIR = path.join(BASE_DIR, "remotion/public");

const FPS = 30;

async function main() {
  console.log("=== video_render_jet ===");

  // 1. scripts.json 読み込み
  if (!fs.existsSync(SCRIPTS_JSON)) {
    throw new Error(`scripts.json が見つかりません: ${SCRIPTS_JSON}`);
  }
  const scriptsJson = JSON.parse(fs.readFileSync(SCRIPTS_JSON, "utf-8"));
  const { segments } = scriptsJson;

  if (!segments || segments.length === 0) {
    throw new Error("scripts.json にセグメントがありません");
  }

  // base*.mp4 を確認して必要なら ffmpeg で結合・コピー
  prepareCombinedBase();

  // base.mp4 を public/ にコピー（staticFile() 用）
  const baseVideoSrc = path.join(BASE_DIR, "base.mp4");
  const baseVideoDst = path.join(PUBLIC_DIR, "base.mp4");
  if (!fs.existsSync(baseVideoSrc)) {
    throw new Error(`base.mp4 が見つかりません: ${baseVideoSrc}`);
  }
  fs.mkdirSync(PUBLIC_DIR, { recursive: true });
  // 既存ファイル/シンボリックリンクを削除してコピー
  try { fs.unlinkSync(baseVideoDst); } catch { }
  fs.copyFileSync(baseVideoSrc, baseVideoDst);
  console.log("base.mp4 → public/ にコピー完了");

  // 2. Remotion バンドル
  console.log("Remotion バンドル中...");
  const bundleLocation = await bundle({
    entryPoint: REMOTION_ENTRY,
    publicDir: PUBLIC_DIR,
  });

  // 3. コンポジション取得
  const lastSeg = segments[segments.length - 1];
  const totalDuration = Math.ceil(lastSeg.cut.end * FPS);

  const inputProps = {
    segments: segments,
    fps: FPS,
  };

  const composition = await selectComposition({
    serveUrl: bundleLocation,
    id: "JetComposition",
    inputProps,
  });

  // durationを上書き
  composition.durationInFrames = totalDuration;

  // 4. レンダリング
  console.log(`レンダリング開始: ${totalDuration} フレーム (${(totalDuration / FPS).toFixed(1)}秒)`);
  await renderMedia({
    composition,
    serveUrl: bundleLocation,
    codec: "h264",
    outputLocation: OUTPUT,
    inputProps,
  });

  console.log(`jet.mp4 生成完了: ${OUTPUT}`);
}

main().catch((err) => {
  console.error("エラー:", err.message);
  process.exit(1);
});
