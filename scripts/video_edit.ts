import "dotenv/config";
import fs from "fs";
import path from "path";
import { execSync, spawnSync } from "child_process";
import OpenAI from "openai";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition, type RenderMediaOnProgress } from "@remotion/renderer";
import { prepareCombinedBase } from "./base-video";
import {
  buildJsonRepairDeveloperPrompt,
  buildLineFormatPrompt,
  buildNaturalizePrompt,
  buildRewritePrompt,
  buildTechnicalNormalizePrompt,
  PROFILES,
  SUBTITLE_DEVELOPER_PROMPT,
  VIDEO_EDIT_SETTINGS,
  type Profile,
  type Segment,
} from "./video_edit.constants";

const {
  ai,
  audioChunking,
  promptTuning,
  render,
  subtitleMerging,
  transcriptionFilters,
} = VIDEO_EDIT_SETTINGS;

function round01(n: number): number {
  return Math.round(n * 10) / 10;
}

function cleanText(text: string): string {
  return text.replace(/\s+/g, "");
}

function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

function resolveDownloadsDir(): string {
  const homeDir = process.env.HOME ?? process.env.USERPROFILE;
  if (!homeDir) {
    throw new Error("HOME ディレクトリを解決できません");
  }
  return path.join(homeDir, "Downloads");
}

function copyIfDifferent(sourcePath: string, destinationPath: string): void {
  const sourceBuffer = fs.readFileSync(sourcePath);
  if (fs.existsSync(destinationPath)) {
    const destinationBuffer = fs.readFileSync(destinationPath);
    if (sourceBuffer.equals(destinationBuffer)) {
      return;
    }
  }
  fs.copyFileSync(sourcePath, destinationPath);
}

type WorkspacePaths = {
  downloadsDir: string;
  inputDir: string;
  outputDir: string;
  workDir: string;
  assetsDir: string;
  remotionPublicDir: string;
};

function resolveWorkspacePaths(profile: Profile): WorkspacePaths {
  const downloadsDir = resolveDownloadsDir();
  const inputDir = downloadsDir;
  const outputDir = downloadsDir;
  const workDir = path.join(downloadsDir, ".tmp", "jet-script-work");
  const assetsDir = workDir;
  const remotionPublicDir = resolvePublicDir(profile.remotionEntry);

  for (const dir of [inputDir, outputDir, workDir, assetsDir, remotionPublicDir]) {
    ensureDir(dir);
  }

  return { downloadsDir, inputDir, outputDir, workDir, assetsDir, remotionPublicDir };
}

function syncInputVideos(inputDir: string, workDir: string): void {
  const entries = fs.readdirSync(inputDir);
  const matchedEntries = entries.filter((entry) => VIDEO_EDIT_SETTINGS.fileDetection.baseVideoPattern.test(entry));

  if (matchedEntries.length === 0) {
    throw new Error(
      `入力動画が見つかりません: ${inputDir}\nbase.mp4 または base1.mp4, base2.mp4... を配置してください`
    );
  }

  for (const entry of matchedEntries) {
    copyIfDifferent(path.join(inputDir, entry), path.join(workDir, entry));
  }
}

function syncBundledAssets(assetsDir: string): void {
  const bundledBgmPath = path.resolve(__dirname, "../assets/bgm.mp3");
  const targetBgmPath = path.join(assetsDir, "bgm.mp3");

  if (fs.existsSync(bundledBgmPath) && !fs.existsSync(targetBgmPath)) {
    fs.copyFileSync(bundledBgmPath, targetBgmPath);
    console.log(`初期BGMをコピー: ${targetBgmPath}`);
  }
}

function copyOutputsToOutputDir(profile: Profile, workspace: WorkspacePaths, includeTitle: boolean): void {
  for (const spec of profile.renders) {
    const sourcePath = path.join(workspace.workDir, spec.outputFile);
    if (!fs.existsSync(sourcePath)) continue;
    fs.copyFileSync(sourcePath, path.join(workspace.outputDir, spec.outputFile));
  }

  if (includeTitle) {
    const sourcePath = path.join(workspace.workDir, profile.title.outputFile);
    if (fs.existsSync(sourcePath)) {
      fs.copyFileSync(sourcePath, path.join(workspace.outputDir, profile.title.outputFile));
    }
  }
}

function hasAudioStream(videoPath: string): boolean {
  const result = spawnSync(
    "ffprobe",
    [
      "-v",
      "error",
      "-select_streams",
      "a",
      "-show_entries",
      "stream=codec_type",
      "-of",
      "csv=p=0",
      videoPath,
    ],
    { encoding: "utf8" }
  );

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`ffprobe failed with exit code: ${result.status ?? "unknown"}`);
  }

  return result.stdout.trim().length > 0;
}

function attachBgmToVideo(videoPath: string, bgmPath: string, tempDir: string): void {
  if (!fs.existsSync(videoPath) || !fs.existsSync(bgmPath)) {
    return;
  }

  const mixedOutputPath = path.join(tempDir, `${path.parse(videoPath).name}-with-bgm.mp4`);
  const sourceHasAudio = hasAudioStream(videoPath);
  const bgmVolume = "0.3";

  const args = sourceHasAudio
    ? [
        "-y",
        "-i",
        videoPath,
        "-stream_loop",
        "-1",
        "-i",
        bgmPath,
        "-filter_complex",
        `[1:a]volume=${bgmVolume}[bgm];[0:a][bgm]amix=inputs=2:duration=first:dropout_transition=2:normalize=0[a]`,
        "-map",
        "0:v:0",
        "-map",
        "[a]",
        "-c:v",
        "copy",
        "-c:a",
        "aac",
        "-shortest",
        mixedOutputPath,
      ]
    : [
        "-y",
        "-i",
        videoPath,
        "-stream_loop",
        "-1",
        "-i",
        bgmPath,
        "-filter:a",
        `volume=${bgmVolume}`,
        "-map",
        "0:v:0",
        "-map",
        "1:a:0",
        "-c:v",
        "copy",
        "-c:a",
        "aac",
        "-shortest",
        mixedOutputPath,
      ];

  const result = spawnSync("ffmpeg", args, { stdio: "inherit" });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`ffmpeg (BGM attach) failed with exit code: ${result.status ?? "unknown"}`);
  }

  fs.copyFileSync(mixedOutputPath, videoPath);
}

function applyBgmToOutputs(profile: Profile, workspace: WorkspacePaths, includeTitle: boolean): void {
  const bgmPath = path.join(workspace.assetsDir, "bgm.mp3");
  if (!fs.existsSync(bgmPath)) {
    console.log("ℹ  BGM なし: bgm.mp3 が見つからないためスキップ");
    return;
  }

  const tempDir = fs.mkdtempSync(path.join(workspace.workDir, "bgm-"));
  try {
    for (const spec of profile.renders) {
      const targetPath = path.join(workspace.outputDir, spec.outputFile);
      if (!fs.existsSync(targetPath)) continue;
      console.log(`BGM 合成: ${spec.outputFile}`);
      attachBgmToVideo(targetPath, bgmPath, tempDir);
    }

    if (includeTitle) {
      const targetPath = path.join(workspace.outputDir, profile.title.outputFile);
      if (fs.existsSync(targetPath)) {
        console.log(`BGM 合成: ${profile.title.outputFile}`);
        attachBgmToVideo(targetPath, bgmPath, tempDir);
      }
    }
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function probeDuration(videoPath: string): number {
  const raw = execSync(
    `ffprobe -v error -show_entries format=duration -of csv=p=0 "${videoPath}"`,
    { encoding: "utf-8" }
  ).trim();
  const dur = parseFloat(raw);
  if (!Number.isFinite(dur) || dur <= 0) {
    throw new Error(`ffprobe で duration を取得できませんでした: ${videoPath}`);
  }
  return dur;
}

function resolvePublicDir(remotionEntry: string): string {
  const remotionRoot = path.dirname(path.dirname(path.resolve(remotionEntry)));
  return path.join(remotionRoot, "public");
}

type RenderProgressPayload = Parameters<RenderMediaOnProgress>[0];

function formatDurationMs(ms: number | null): string {
  if (ms === null || !Number.isFinite(ms) || ms < 0) return "--:--";

  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function buildProgressBar(progress: number, width = 28): string {
  const clamped = Math.min(Math.max(progress, 0), 1);
  const filled = Math.round(clamped * width);
  return `${"=".repeat(filled)}${"-".repeat(width - filled)}`;
}

function createRenderProgressReporter(label: string, totalFrames: number): {
  onProgress: (payload: RenderProgressPayload) => void;
  finish: (success: boolean) => void;
} {
  const progressFrameStep = 100;
  const startTime = Date.now();
  const isTTY = Boolean(process.stdout.isTTY);
  let lastStage = "";
  let lastRenderedBucket = -1;
  let lastEncodedBucket = -1;
  let lastLineLength = 0;
  let lastPayload: RenderProgressPayload | null = null;

  const writeLine = (line: string) => {
    if (!isTTY) {
      console.log(line);
      return;
    }

    const paddedLine = line.padEnd(lastLineLength, " ");
    process.stdout.write(`\r${paddedLine}`);
    lastLineLength = paddedLine.length;
  };

  const renderLine = (payload: RenderProgressPayload, force: boolean) => {
    const now = Date.now();
    const progress = Math.min(Math.max(payload.progress, 0), 1);
    const percent = Math.round(progress * 100);
    const stageLabel = payload.stitchStage === "encoding" ? "render" : "mux";
    const renderedFrames = Math.min(payload.renderedFrames, totalFrames);
    const encodedFrames = Math.min(payload.encodedFrames, totalFrames);
    const renderedBucket = Math.floor(renderedFrames / progressFrameStep);
    const encodedBucket = Math.floor(encodedFrames / progressFrameStep);
    const crossedFrameBoundary =
      renderedBucket !== lastRenderedBucket || encodedBucket !== lastEncodedBucket;

    if (!force && !crossedFrameBoundary && stageLabel === lastStage && percent < 100) {
      return;
    }

    const elapsedMs = now - startTime;
    const etaMs =
      progress > 0 && progress < 1
        ? Math.round((elapsedMs / progress) * (1 - progress))
        : progress >= 1
          ? 0
          : null;

    writeLine(
      `  進捗 ${label} ` +
        `[${buildProgressBar(progress)}] ${String(percent).padStart(3, " ")}%` +
        ` | ${stageLabel}` +
        ` | frame ${renderedFrames}/${totalFrames}` +
        ` | encode ${encodedFrames}/${totalFrames}` +
        ` | ETA ${formatDurationMs(etaMs)}`
    );

    lastStage = stageLabel;
    lastRenderedBucket = renderedBucket;
    lastEncodedBucket = encodedBucket;
    lastPayload = payload;
  };

  return {
    onProgress: (payload) => renderLine(payload, false),
    finish: (success) => {
      if (lastPayload) {
        const finalPayload = success
          ? {
              ...lastPayload,
              progress: 1,
              renderedFrames: totalFrames,
              encodedFrames: totalFrames,
              stitchStage: "muxing" as const,
            }
          : lastPayload;
        renderLine(finalPayload, true);
      }

      if (isTTY && lastLineLength > 0) {
        process.stdout.write("\n");
      }
    },
  };
}

async function transcribeSingleFile(
  openai: OpenAI,
  wavPath: string,
  timeUnitSec: number
): Promise<Array<{ start: number; end: number; text: string }>> {
  const response = await openai.audio.transcriptions.create({
    model: ai.transcriptionModel,
    file: fs.createReadStream(wavPath),
    response_format: "verbose_json",
    timestamp_granularities: ["word"],
    language: "ja",
  });

  const result = response as {
    words?: Array<{ word: string; start: number; end: number }>;
  };
  const words = result.words;

  if (!words || words.length === 0) {
    throw new Error("Whisper API: words が返されませんでした");
  }

  const factor = 1 / timeUnitSec;

  return words.map((w) => ({
    start: Math.round(w.start * factor) / factor,
    end: Math.round(w.end * factor) / factor,
    text: cleanText(w.word),
  }));
}

async function transcribeLargeFile(
  openai: OpenAI,
  wavPath: string,
  tmpDir: string,
  timeUnitSec: number
): Promise<Array<{ start: number; end: number; text: string }>> {
  const totalDuration = probeDuration(wavPath);
  console.log(`音声長さ: ${totalDuration.toFixed(1)} 秒`);

  const chunks: string[] = [];
  let offset = 0;
  while (offset < totalDuration) {
    const chunkPath = path.join(tmpDir, `chunk_${chunks.length.toString().padStart(3, "0")}.wav`);
    const dur = Math.min(audioChunking.whisperChunkSec, totalDuration - offset);
    execSync(
      `ffmpeg -y -i "${wavPath}" -ss ${offset} -t ${dur} -ar 16000 -ac 1 "${chunkPath}"`,
      { stdio: "pipe" }
    );
    chunks.push(chunkPath);
    offset += audioChunking.whisperChunkSec;
  }
  console.log(`${chunks.length} チャンクに分割`);

  const allSegments: Array<{ start: number; end: number; text: string }> = [];
  let chunkOffset = 0;

  for (let i = 0; i < chunks.length; i++) {
    console.log(`チャンク ${i + 1}/${chunks.length} 処理中...`);
    const chunkDur = probeDuration(chunks[i]);
    const segs = await transcribeSingleFile(openai, chunks[i], timeUnitSec);
    for (const seg of segs) {
      allSegments.push({
        start: seg.start + chunkOffset,
        end: seg.end + chunkOffset,
        text: seg.text,
      });
    }
    chunkOffset += chunkDur;
  }

  for (const chunk of chunks) {
    try { fs.unlinkSync(chunk); } catch {}
  }

  return allSegments;
}

type LineTarget = 2 | 3 | "rewrite";
type ClassifyTarget = "skip" | LineTarget;

function canOverflowForNaturalBoundary(
  prevText: string,
  currText: string,
  mergedText: string,
  maxMergeChars: number
): boolean {
  if (mergedText.length <= maxMergeChars) return true;
  if (mergedText.length > maxMergeChars + subtitleMerging.mergeBoundaryOverflowChars) return false;

  const prevTail = prevText.slice(-1);
  const currHead = currText.slice(0, 1);
  return (
    subtitleMerging.continuationHeadPattern.test(currText) ||
    (/[ァ-ヶー]/u.test(prevTail) && /[ァ-ヶー]/u.test(currHead))
  );
}

function shouldAbsorbIntoPrevious(
  prevText: string,
  currText: string,
  gapSec: number,
  maxMergeChars: number
): boolean {
  if (gapSec > subtitleMerging.tailMergeGapSec) return false;

  const mergedText = cleanText(prevText + currText);
  if (mergedText.length > maxMergeChars + subtitleMerging.mergeBoundaryOverflowChars) return false;

  return (
    subtitleMerging.shortTailSegmentPattern.test(currText) ||
    subtitleMerging.continuationHeadPattern.test(currText)
  );
}

function shouldMergeAwkwardBoundary(
  prevText: string,
  currText: string,
  gapSec: number,
  maxBoundaryMergeChars: number
): boolean {
  if (gapSec > subtitleMerging.awkwardBoundaryMergeGapSec) return false;
  if (subtitleMerging.terminalSegmentEndPattern.test(prevText)) return false;
  if (!subtitleMerging.awkwardSegmentHeadPattern.test(currText)) return false;

  const mergedText = cleanText(prevText + currText);
  return mergedText.length <= maxBoundaryMergeChars;
}

function classifyText(text: string, maxLineChars: number): ClassifyTarget {
  const len = text.length;
  if (len <= maxLineChars) return "skip";
  if (len <= Math.floor(maxLineChars * 2 * subtitleMerging.lineOverflowFactor)) return 2;
  if (len <= Math.floor(maxLineChars * 3 * subtitleMerging.lineOverflowFactor)) return 3;
  return "rewrite";
}

function validateFormattedPayload(obj: unknown, expectedLen: number): string[] | null {
  if (!obj || typeof obj !== "object") return null;
  const record = obj as Record<string, unknown>;
  if (!Array.isArray(record.formatted)) return null;
  if (record.formatted.length !== expectedLen) return null;
  if (!record.formatted.every((value) => typeof value === "string")) return null;
  return record.formatted as string[];
}

async function parseOrRepairFormatted(
  openai: OpenAI,
  raw: string,
  expectedLen: number
): Promise<string[] | null> {
  try {
    const result = validateFormattedPayload(JSON.parse(raw), expectedLen);
    if (result) return result;
  } catch {}

  const stripped = raw.replace(/^```(?:json)?\s*/i, "").replace(/```$/i, "").trim();
  try {
    const result = validateFormattedPayload(JSON.parse(stripped), expectedLen);
    if (result) return result;
  } catch {}

  const repair = await openai.chat.completions.create({
    model: ai.jsonRepairModel,
    messages: [
      {
        role: "system",
        content: "あなたは厳格なJSON修復ツールです。与えられたテキストを修復し、指定スキーマのJSONのみを返します。",
      },
      {
        role: "developer",
        content: buildJsonRepairDeveloperPrompt(expectedLen),
      },
      {
        role: "user",
        content: raw,
      },
    ],
    response_format: { type: "json_object" },
    temperature: 0,
  });

  const fixed = repair.choices[0].message.content ?? "";
  try {
    return validateFormattedPayload(JSON.parse(fixed), expectedLen);
  } catch {
    return null;
  }
}

async function processSingle(
  openai: OpenAI,
  text: string,
  systemPrompt: string
): Promise<string> {
  let rawForRepair = "";
  let lastError: unknown = null;

  for (let attempt = 0; attempt <= ai.maxRetries; attempt++) {
    try {
      const completion = await openai.chat.completions.create({
        model: ai.subtitleModel,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `texts=${JSON.stringify([text])}` },
          { role: "developer", content: SUBTITLE_DEVELOPER_PROMPT },
        ],
        response_format: { type: "json_object" },
        temperature: 0,
      });

      rawForRepair = completion.choices[0].message.content ?? "";
      const result = validateFormattedPayload(JSON.parse(rawForRepair), 1);
      if (result) return result[0];

      if (attempt < ai.maxRetries) {
        console.warn(`    警告: JSON不正。再試行 (${attempt + 1}/${ai.maxRetries})`);
      }
    } catch (error) {
      lastError = error;
      if (attempt < ai.maxRetries) {
        console.warn(`    警告: API失敗。再試行 (${attempt + 1}/${ai.maxRetries})`);
      }
    }
  }

  if (rawForRepair) {
    try {
      const repaired = await parseOrRepairFormatted(openai, rawForRepair, 1);
      if (repaired) return repaired[0];
    } catch (error) {
      console.warn(`    警告: JSON修復API失敗: ${(error as Error)?.message ?? error}`);
    }
  }

  console.warn(
    `    警告: 字幕処理失敗。元テキストを使用: "${text.slice(0, 20)}..."`,
    (lastError as Error)?.message ?? ""
  );
  return text;
}

async function processTextsParallel(
  openai: OpenAI,
  texts: string[],
  systemPrompt: string,
  label: string
): Promise<string[]> {
  const results: string[] = new Array(texts.length);
  const total = texts.length;

  for (let i = 0; i < total; i += ai.subtitleConcurrency) {
    const chunk = texts.slice(i, i + ai.subtitleConcurrency);
    const chunkNum = Math.floor(i / ai.subtitleConcurrency) + 1;
    const chunkTotal = Math.ceil(total / ai.subtitleConcurrency);
    console.log(`  [${label}] ${chunkNum}/${chunkTotal} (${chunk.length}件 並列処理中...)`);

    const chunkResults = await Promise.all(
      chunk.map((text) => processSingle(openai, text, systemPrompt))
    );

    for (let j = 0; j < chunkResults.length; j++) {
      results[i + j] = chunkResults[j];
    }
  }

  return results;
}

async function processSubtitles(
  openai: OpenAI,
  texts: string[],
  maxLineChars: number
): Promise<string[]> {
  const results = [...texts];

  const technicalNormalized = await processTextsParallel(
    openai,
    texts,
    buildTechnicalNormalizePrompt(maxLineChars, promptTuning.technicalTermPriorityExamples),
    "技術用語補正"
  );

  const naturalized = await processTextsParallel(
    openai,
    technicalNormalized,
    buildNaturalizePrompt(maxLineChars),
    "自然化"
  );

  const groups = new Map<ClassifyTarget, number[]>([
    ["skip", []],
    [2, []],
    [3, []],
    ["rewrite", []],
  ]);

  for (let i = 0; i < naturalized.length; i++) {
    groups.get(classifyText(naturalized[i], maxLineChars))!.push(i);
  }

  console.log(
    `  分類結果: 1行スキップ ${groups.get("skip")!.length}件` +
      ` / 2行整形 ${groups.get(2)!.length}件` +
      ` / 3行整形 ${groups.get(3)!.length}件` +
      ` / リライト ${groups.get("rewrite")!.length}件`
  );

  const processGroup = async (target: LineTarget, systemPrompt: string) => {
    const indices = groups.get(target)!;
    if (indices.length === 0) return;

    const label = target === "rewrite" ? "リライト" : `${target}行整形`;
    const inputTexts = indices.map((idx) => naturalized[idx]);
    const refined = await processTextsParallel(openai, inputTexts, systemPrompt, label);

    for (let j = 0; j < indices.length; j++) {
      results[indices[j]] = refined[j] ?? naturalized[indices[j]];
    }
  };

  await processGroup(2, buildLineFormatPrompt(2, maxLineChars));
  await processGroup(3, buildLineFormatPrompt(3, maxLineChars));
  await processGroup("rewrite", buildRewritePrompt(maxLineChars));

  for (const idx of groups.get("skip")!) {
    results[idx] = naturalized[idx];
  }

  return results;
}

async function stepTranscribe(profile: Profile, videoDir: string, workDir: string): Promise<void> {
  const { settings, maxLineChars } = profile;
  const inputVideo = path.join(videoDir, "base.mp4");
  const tmpDir = path.join(workDir, ".tmp");
  const outputJson = path.join(tmpDir, "scripts.json");

  if (!fs.existsSync(inputVideo)) {
    throw new Error(`入力ファイルが見つかりません: ${inputVideo}`);
  }

  ensureDir(tmpDir);
  const wavPath = path.join(tmpDir, "base.wav");
  console.log("音声抽出中...");
  execSync(`ffmpeg -y -i "${inputVideo}" -ar 16000 -ac 1 -vn "${wavPath}"`, { stdio: "pipe" });
  console.log(`音声抽出完了: ${wavPath}`);

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY 環境変数が設定されていません");
  const openai = new OpenAI({ apiKey });

  const wavSizeMB = fs.statSync(wavPath).size / (1024 * 1024);
  console.log(`音声ファイルサイズ: ${wavSizeMB.toFixed(1)} MB`);
  console.log("Whisper API 呼び出し中...");

  const whisperSegments =
    wavSizeMB > 24
      ? await transcribeLargeFile(openai, wavPath, tmpDir, settings.timeUnitSec)
      : await transcribeSingleFile(openai, wavPath, settings.timeUnitSec);

  if (whisperSegments.length === 0) {
    throw new Error("Whisper API からセグメントが取得できませんでした");
  }
  console.log(`Whisper セグメント数: ${whisperSegments.length}`);

  const filtered = whisperSegments.filter((segment) => {
    const text = (segment.text ?? "").trim();
    return (
      text &&
      !transcriptionFilters.noisePattern.test(text) &&
      !transcriptionFilters.fillerPattern.test(text)
    );
  });

  if (filtered.length === 0) {
    throw new Error("有効なセリフが見つかりませんでした（全てノイズまたは空）");
  }

  fs.writeFileSync(
    path.join(tmpDir, "scripts_base.json"),
    JSON.stringify({ source: { videoPath: "base.mp4" }, settings, segments: whisperSegments }, null, 2),
    "utf-8"
  );

  const processed = filtered.map((segment) => ({
    origStart: round01(segment.start),
    origEnd: round01(segment.end),
    text: (segment.text ?? "").trim(),
  }));

  for (let i = 0; i < processed.length; i++) {
    const seg = processed[i];
    if (seg.origEnd - seg.origStart < settings.minSegmentDurationSec) {
      const nextStart = i + 1 < processed.length ? processed[i + 1].origStart : Infinity;
      seg.origEnd = Math.min(round01(seg.origStart + settings.minSegmentDurationSec), nextStart);
      if (seg.origEnd <= seg.origStart) {
        seg.origEnd = round01(seg.origStart + settings.timeUnitSec);
      }
    }
  }

  const maxMergeChars = Math.floor(maxLineChars * subtitleMerging.mergeCharFactor);
  const merged: typeof processed = [processed[0]];
  for (let i = 1; i < processed.length; i++) {
    const prev = merged[merged.length - 1];
    const curr = processed[i];
    const mergedText = cleanText(prev.text + curr.text);
    if (
      curr.origStart - prev.origEnd <= settings.mergeGapSec &&
      canOverflowForNaturalBoundary(prev.text, curr.text, mergedText, maxMergeChars)
    ) {
      prev.origEnd = Math.max(prev.origEnd, curr.origEnd);
      prev.text = mergedText;
    } else {
      merged.push(curr);
    }
  }

  const normalizedMerged: typeof merged = [merged[0]];
  for (let i = 1; i < merged.length; i++) {
    const prev = normalizedMerged[normalizedMerged.length - 1];
    const curr = merged[i];
    const gapSec = round01(curr.origStart - prev.origEnd);

    if (shouldAbsorbIntoPrevious(prev.text, curr.text, gapSec, maxMergeChars)) {
      prev.origEnd = Math.max(prev.origEnd, curr.origEnd);
      prev.text = cleanText(prev.text + curr.text);
      continue;
    }

    normalizedMerged.push(curr);
  }

  const maxBoundaryMergeChars = Math.floor(maxLineChars * 3 * subtitleMerging.lineOverflowFactor);
  const boundarySmoothed: typeof normalizedMerged = [normalizedMerged[0]];
  for (let i = 1; i < normalizedMerged.length; i++) {
    const prev = boundarySmoothed[boundarySmoothed.length - 1];
    const curr = normalizedMerged[i];
    const gapSec = round01(curr.origStart - prev.origEnd);

    if (shouldMergeAwkwardBoundary(prev.text, curr.text, gapSec, maxBoundaryMergeChars)) {
      prev.origEnd = Math.max(prev.origEnd, curr.origEnd);
      prev.text = cleanText(prev.text + curr.text);
      continue;
    }

    boundarySmoothed.push(curr);
  }

  fs.writeFileSync(
    path.join(tmpDir, "scripts_merged.json"),
    JSON.stringify(
      {
        source: { videoPath: "base.mp4" },
        settings,
        maxMergeChars,
        maxBoundaryMergeChars,
        segments: boundarySmoothed.map((segment, i) => ({
          id: `merged_${String(i).padStart(4, "0")}`,
          text: segment.text,
          orig: { start: segment.origStart, end: segment.origEnd },
        })),
      },
      null,
      2
    ),
    "utf-8"
  );

  console.log("AI 字幕整形中...");
  const refinedAll = await processSubtitles(
    openai,
    boundarySmoothed.map((segment) => segment.text),
    maxLineChars
  );

  for (let i = 0; i < boundarySmoothed.length; i++) {
    if (typeof refinedAll[i] === "string" && refinedAll[i]) {
      boundarySmoothed[i].text = refinedAll[i];
    }
  }

  const videoDuration = (() => {
    try {
      return probeDuration(inputVideo);
    } catch {
      return Infinity;
    }
  })();

  for (let i = 0; i < boundarySmoothed.length; i++) {
    const seg = boundarySmoothed[i];
    const prevEnd = i > 0 ? boundarySmoothed[i - 1].origEnd : 0;
    const nextStart = i + 1 < boundarySmoothed.length ? boundarySmoothed[i + 1].origStart : videoDuration;
    seg.origStart = round01(Math.max(prevEnd, seg.origStart - settings.marginBeforeSec));
    seg.origEnd = round01(Math.min(nextStart, seg.origEnd + settings.marginAfterSec));
  }

  let cursor = 0;
  const finalSegments: Segment[] = boundarySmoothed.map((segment, i) => {
    const duration = round01(segment.origEnd - segment.origStart);
    const cutStart = round01(cursor);
    const cutEnd = round01(cursor + duration);
    cursor = cutEnd;
    return {
      id: `seg_${String(i).padStart(4, "0")}`,
      text: segment.text,
      orig: { start: segment.origStart, end: segment.origEnd },
      cut: { start: cutStart, end: cutEnd },
    };
  });

  fs.writeFileSync(
    outputJson,
    JSON.stringify({ source: { videoPath: "base.mp4" }, settings, segments: finalSegments }, null, 2),
    "utf-8"
  );

  const totalCutDuration = finalSegments[finalSegments.length - 1]?.cut.end ?? 0;
  console.log(`scripts.json 生成完了: ${outputJson}`);
  console.log(`最終セグメント数: ${finalSegments.length}`);
  console.log(`カット後合計時間: ${totalCutDuration.toFixed(1)} 秒`);
}

async function stepRender(
  profile: Profile,
  videoDir: string,
  workDir: string,
  publicDir: string
): Promise<void> {
  const scriptsJsonPath = path.join(workDir, ".tmp", "scripts.json");
  if (!fs.existsSync(scriptsJsonPath)) {
    throw new Error(`scripts.json が見つかりません: ${scriptsJsonPath}`);
  }

  const { segments } = JSON.parse(fs.readFileSync(scriptsJsonPath, "utf-8")) as { segments: Segment[] };
  if (!segments || segments.length === 0) {
    throw new Error("scripts.json にセグメントがありません");
  }

  ensureDir(publicDir);

  const baseVideoSrc = path.join(videoDir, "base.mp4");
  if (!fs.existsSync(baseVideoSrc)) {
    throw new Error(`base.mp4 が見つかりません: ${baseVideoSrc}`);
  }

  const baseVideoDst = path.join(publicDir, "base.mp4");
  try { fs.unlinkSync(baseVideoDst); } catch {}
  fs.copyFileSync(baseVideoSrc, baseVideoDst);
  console.log("base.mp4 → public/ にコピー完了");

  console.log("Remotion バンドル中...");
  const bundleLocation = await bundle({
    entryPoint: path.resolve(profile.remotionEntry),
    publicDir,
  });

  const totalFrames = Math.ceil(segments[segments.length - 1].cut.end * render.fps);

  for (const spec of profile.renders) {
    const outputPath = path.join(videoDir, spec.outputFile);
    const inputProps = spec.getInputProps(segments, render.fps);

    console.log(`\nレンダリング: ${spec.compositionId} → ${spec.outputFile}`);
    console.log(`  ${totalFrames} フレーム (${(totalFrames / render.fps).toFixed(1)} 秒)`);

    const composition = await selectComposition({
      serveUrl: bundleLocation,
      id: spec.compositionId,
      inputProps,
    });
    composition.durationInFrames = totalFrames;
    const progress = createRenderProgressReporter(spec.outputFile, totalFrames);

    try {
      await renderMedia({
        composition,
        serveUrl: bundleLocation,
        codec: "h264",
        outputLocation: outputPath,
        inputProps,
        onProgress: progress.onProgress,
      });
      progress.finish(true);
    } catch (error) {
      progress.finish(false);
      throw error;
    }

    console.log(`  完了: ${outputPath}`);
  }
}

async function stepTitle(
  profile: Profile,
  videoDir: string,
  title: string,
  publicDir: string
): Promise<void> {
  const spec = profile.title;
  const inputVideoPath = path.join(videoDir, spec.inputVideoFile);
  const outputPath = path.join(videoDir, spec.outputFile);

  if (!fs.existsSync(inputVideoPath)) {
    throw new Error(`タイトルオーバーレイの入力ファイルが見つかりません: ${inputVideoPath}`);
  }

  ensureDir(publicDir);

  const publicInputPath = path.join(publicDir, spec.inputVideoFile);
  try { fs.unlinkSync(publicInputPath); } catch {}
  fs.copyFileSync(inputVideoPath, publicInputPath);
  console.log(`${spec.inputVideoFile} → public/ にコピー完了`);

  const durationSec = probeDuration(inputVideoPath);
  const durationInFrames = Math.ceil(durationSec * render.fps);

  console.log("Remotion バンドル中 (title)...");
  const bundleLocation = await bundle({
    entryPoint: path.resolve(profile.remotionEntry),
    publicDir,
  });

  const inputProps = { title };
  const composition = await selectComposition({
    serveUrl: bundleLocation,
    id: spec.compositionId,
    inputProps,
  });
  composition.durationInFrames = durationInFrames;

  console.log(`タイトルレンダリング: ${durationInFrames} フレーム (${durationSec.toFixed(2)} 秒)`);
  const progress = createRenderProgressReporter(spec.outputFile, durationInFrames);

  try {
    await renderMedia({
      composition,
      serveUrl: bundleLocation,
      codec: "h264",
      outputLocation: outputPath,
      inputProps,
      onProgress: progress.onProgress,
    });
    progress.finish(true);
  } catch (error) {
    progress.finish(false);
    throw error;
  }

  console.log(`タイトル付き動画完了: ${outputPath}`);
}

type StepName = "transcribe" | "render" | "title";
const STEP_ORDER: StepName[] = ["transcribe", "render", "title"];

function parseArgs(): {
  profileName: string;
  fromStep: StepName;
  toStep: StepName;
  title: string | null;
  noTitle: boolean;
} {
  const args = process.argv.slice(2);
  const get = (prefix: string) => args.find((arg) => arg.startsWith(prefix))?.slice(prefix.length) ?? null;

  const profileName = get("--profile=") ?? "long";
  const fromStepRaw = get("--from-step=") ?? "transcribe";
  const toStepRaw = get("--to-step=") ?? "title";
  const title = get("--title=");
  const noTitle = args.includes("--no-title");

  if (!PROFILES[profileName]) {
    throw new Error(`不明なプロファイル: "${profileName}" / 使用可能: ${Object.keys(PROFILES).join(", ")}`);
  }
  if (!STEP_ORDER.includes(fromStepRaw as StepName)) {
    throw new Error(`不明な開始ステップ: "${fromStepRaw}" / 使用可能: ${STEP_ORDER.join(", ")}`);
  }
  if (!STEP_ORDER.includes(toStepRaw as StepName)) {
    throw new Error(`不明な終了ステップ: "${toStepRaw}" / 使用可能: ${STEP_ORDER.join(", ")}`);
  }

  const fromStep = fromStepRaw as StepName;
  const toStep = toStepRaw as StepName;

  if (STEP_ORDER.indexOf(fromStep) > STEP_ORDER.indexOf(toStep)) {
    throw new Error(`開始ステップ (${fromStep}) は終了ステップ (${toStep}) より後ろに指定できません`);
  }

  return { profileName, fromStep, toStep, title, noTitle };
}

async function main(): Promise<void> {
  const { profileName, fromStep, toStep, title, noTitle } = parseArgs();
  const profile = PROFILES[profileName];
  const workspace = resolveWorkspacePaths(profile);
  const videoDir = workspace.workDir;
  const workDir = workspace.workDir;
  const tmpDir = path.join(workDir, ".tmp");
  const fromIdx = STEP_ORDER.indexOf(fromStep);
  const toIdx = STEP_ORDER.indexOf(toStep);
  const includeTitle = !noTitle && Boolean(title) && toIdx >= STEP_ORDER.indexOf("title");

  console.log("\n=== video_edit ===");
  console.log(`  プロファイル : ${profileName}`);
  console.log(`  開始ステップ : ${fromStep}`);
  console.log(`  終了ステップ : ${toStep}`);
  if (title) console.log(`  タイトル     : ${title}`);
  console.log(`  downloadsDir : ${workspace.downloadsDir}`);
  console.log(`  inputDir     : ${workspace.inputDir}`);
  console.log(`  outputDir    : ${workspace.outputDir}`);
  console.log(`  assetsDir    : ${workspace.assetsDir}`);
  console.log(`  workDir      : ${workDir}`);
  console.log(`  tmpDir       : ${tmpDir}\n`);

  ensureDir(workDir);
  ensureDir(tmpDir);
  syncBundledAssets(workspace.assetsDir);

  if (fromIdx <= STEP_ORDER.indexOf("transcribe")) {
    syncInputVideos(workspace.inputDir, workspace.workDir);
  }

  if (fromIdx <= STEP_ORDER.indexOf("transcribe") && toIdx >= STEP_ORDER.indexOf("transcribe")) {
    console.log("▶ STEP 0: base 動画準備");
    prepareCombinedBase(videoDir);
    console.log("✅ STEP 0 完了\n");
  }

  if (fromIdx <= STEP_ORDER.indexOf("transcribe") && toIdx >= STEP_ORDER.indexOf("transcribe")) {
    console.log("▶ STEP 1: 文字起こし・セグメント生成");
    await stepTranscribe(profile, videoDir, workDir);
    console.log("✅ STEP 1 完了\n");
  }

  if (fromIdx <= STEP_ORDER.indexOf("render") && toIdx >= STEP_ORDER.indexOf("render")) {
    console.log("▶ STEP 2: Remotion レンダリング");
    await stepRender(profile, videoDir, workDir, workspace.remotionPublicDir);
    console.log("✅ STEP 2 完了\n");
  }

  if (!noTitle && title && fromIdx <= STEP_ORDER.indexOf("title") && toIdx >= STEP_ORDER.indexOf("title")) {
    console.log("▶ STEP 3: タイトルオーバーレイ");
    await stepTitle(profile, videoDir, title, workspace.remotionPublicDir);
    console.log("✅ STEP 3 完了\n");
  } else if (!noTitle && !title && toIdx >= STEP_ORDER.indexOf("title")) {
    console.log("ℹ  タイトルなし: --title=\"テキスト\" を指定するとオーバーレイを追加できます");
  }

  copyOutputsToOutputDir(profile, workspace, includeTitle);
  if (toIdx >= STEP_ORDER.indexOf("render")) {
    applyBgmToOutputs(profile, workspace, includeTitle);
  }

  console.log("=== 完了 ===");
  console.log("生成物:");
  if (toIdx >= STEP_ORDER.indexOf("render")) {
    for (const spec of profile.renders) {
      console.log(`  - ${path.join(workspace.outputDir, spec.outputFile)}`);
    }
  }
  if (!noTitle && title && toIdx >= STEP_ORDER.indexOf("title")) {
    console.log(`  - ${path.join(workspace.outputDir, profile.title.outputFile)}`);
  }
  if (toIdx >= STEP_ORDER.indexOf("transcribe")) {
    console.log("途中ファイル:");
    console.log(`  - ${path.join(tmpDir, "scripts_base.json")}`);
    console.log(`  - ${path.join(tmpDir, "scripts_merged.json")}`);
    console.log(`  - ${path.join(tmpDir, "scripts.json")}`);
  }
}

main().catch((error) => {
  console.error("エラー:", error instanceof Error ? error.message : String(error));
  process.exit(1);
});
