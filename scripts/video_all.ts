/**
 * video_all.ts
 *
 * 統合ランナー: transcribe → render jet → render script を順に実行
 *
 * 実行: npm run all (video-edit ディレクトリ内で実行)
 */
import { execSync } from "child_process";
import path from "path";
import { prepareCombinedBase } from "./base-video";

const SCRIPTS_DIR = __dirname;

const steps = [
  { name: "video_transcribe", file: "video_transcribe.ts" },
  { name: "video_render_jet", file: "video_render_jet.ts" },
];

async function main() {
  console.log("=== video_all: 統合パイプライン開始 ===\n");

  prepareCombinedBase();

  for (const step of steps) {
    const scriptPath = path.join(SCRIPTS_DIR, step.file);
    console.log(`\n▶ ${step.name} 実行中...`);
    console.log(`  ${scriptPath}\n`);

    try {
      execSync(`npx tsx "${scriptPath}"`, {
        stdio: "inherit",
        cwd: path.resolve("."),
      });
      console.log(`✅ ${step.name} 完了\n`);
    } catch (err) {
      console.error(`❌ ${step.name} 失敗`);
      process.exit(1);
    }
  }

  console.log("\n=== 全ステップ完了 ===");
  console.log("生成物:");
  console.log("  - scripts.json");
  console.log("  - jet.mp4");
  console.log("  - script.mp4");
}

main();
