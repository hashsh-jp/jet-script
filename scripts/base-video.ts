import { execSync } from "child_process";
import fs from "fs";
import path from "path";

const BASE_VIDEO_PATTERN = /^base(\d*)\.mp4$/i;

export function prepareCombinedBase(baseDir: string = process.cwd()): void {
  if (!fs.existsSync(baseDir)) {
    throw new Error(`base 動画ディレクトリが存在しません: ${baseDir}`);
  }

  const entries = fs.readdirSync(baseDir);
  const numbered: Array<{ name: string; index: number }> = [];
  let hasPlainBase = false;

  for (const entry of entries) {
    const match = BASE_VIDEO_PATTERN.exec(entry);
    if (!match) continue;

    const numPart = match[1];
    if (!numPart) {
      hasPlainBase = true;
    } else {
      numbered.push({ name: entry, index: parseInt(numPart, 10) });
    }
  }

  numbered.sort((a, b) => a.index - b.index);
  const targetBase = path.join(baseDir, "base.mp4");

  if (numbered.length === 0) {
    if (hasPlainBase) {
      console.log("base.mp4 のみなので結合処理は不要");
      return;
    }
    throw new Error(`base.mp4 または baseN.mp4 が ${baseDir} に存在しません`);
  }

  if (numbered.length === 1) {
    console.log(`${numbered[0].name} を base.mp4 としてコピーします`);
    fs.copyFileSync(path.join(baseDir, numbered[0].name), targetBase);
    return;
  }

  console.log(`複数の base 動画を検出: ${numbered.map((b) => b.name).join(", ")}`);
  const tmpDir = path.join(baseDir, ".tmp");
  fs.mkdirSync(tmpDir, { recursive: true });

  const concatList = path.join(tmpDir, "base_concat.txt");
  const combined = path.join(tmpDir, "base_combined.mp4");
  const listContent = numbered
    .map((b) => `file '${path.join(baseDir, b.name).replace(/'/g, "'\\''")}'`)
    .join("\n");

  fs.writeFileSync(concatList, listContent);
  console.log("ffmpeg で base 動画を連結中...");
  execSync(`ffmpeg -y -f concat -safe 0 -i "${concatList}" -c copy "${combined}"`, {
    stdio: "inherit",
  });
  fs.copyFileSync(combined, targetBase);
  console.log(`結合完了: base.mp4 を更新しました (${numbered.length} 本)`);

  try { fs.unlinkSync(concatList); } catch {}
  try { fs.unlinkSync(combined); } catch {}
}

if (require.main === module) {
  try {
    prepareCombinedBase();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("エラー:", message);
    process.exit(1);
  }
}
