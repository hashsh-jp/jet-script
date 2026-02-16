import { execSync } from "child_process";
import fs from "fs";
import path from "path";

const BASE_VIDEO_DIR = process.cwd();
const BASE_VIDEO_PATTERN = /^base(\d*)\.mp4$/i;
const BASE_VIDEO_TMP = path.join(BASE_VIDEO_DIR, ".tmp");
export const TARGET_BASE_VIDEO = path.join(BASE_VIDEO_DIR, "base.mp4");

function listBaseVideos(): string[] {
  if (!fs.existsSync(BASE_VIDEO_DIR)) {
    throw new Error(`base 動画ディレクトリが存在しません: ${BASE_VIDEO_DIR}`);
  }

  const entries = fs.readdirSync(BASE_VIDEO_DIR);
  const bases: Array<{ name: string; index: number }> = [];

  for (const entry of entries) {
    const match = BASE_VIDEO_PATTERN.exec(entry);
    if (!match) {
      continue;
    }

    const numPart = match[1];
    const index = numPart ? parseInt(numPart, 10) : 1;
    bases.push({ name: entry, index });
  }

  bases.sort((a, b) => a.index - b.index);
  return bases.map((entry) => entry.name);
}

export function prepareCombinedBase() {
  const baseVideos = listBaseVideos();
  if (baseVideos.length === 0) {
    throw new Error(`base.mp4 または baseN.mp4 が ${BASE_VIDEO_DIR} に存在しません`);
  }

  if (baseVideos.length === 1) {
    const single = baseVideos[0];
    if (single.toLowerCase() === "base.mp4") {
      console.log("base.mp4 のみなので結合処理は不要");
      return;
    }

    console.log(`base.mp4 がないため ${single} をコピーして base.mp4 を用意します`);
    fs.copyFileSync(path.join(BASE_VIDEO_DIR, single), TARGET_BASE_VIDEO);
    return;
  }

  console.log(`複数の base 動画を検出: ${baseVideos.join(", ")}`);
  fs.mkdirSync(BASE_VIDEO_TMP, { recursive: true });
  const concatList = path.join(BASE_VIDEO_TMP, "base_concat.txt");
  const combinedVideo = path.join(BASE_VIDEO_TMP, "base_combined.mp4");
  const listContent = baseVideos
    .map((name) => {
      const filePath = path.join(BASE_VIDEO_DIR, name);
      const safePath = filePath.replace(/'/g, "'\\''");
      return `file '${safePath}'`;
    })
    .join("\n");

  fs.writeFileSync(concatList, listContent);

  console.log("ffmpeg で base 動画を連結中...");
  execSync(`ffmpeg -y -f concat -safe 0 -i "${concatList}" -c copy "${combinedVideo}"`, {
    stdio: "inherit",
  });

  fs.copyFileSync(combinedVideo, TARGET_BASE_VIDEO);
  console.log(`結合完了: base.mp4 を更新しました (${baseVideos.length} 本)`);

  try {
    fs.unlinkSync(concatList);
  } catch {}
  try {
    fs.unlinkSync(combinedVideo);
  } catch {}
}
