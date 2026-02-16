/**
 * video_transcribe.ts
 *
 * base.mp4 → Whisper API → scripts.json
 *
 * 実行: npm run all (video-edit ディレクトリ内で実行)
 */
import "dotenv/config";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import OpenAI from "openai";

// ── 設定 ──
const BASE_DIR = process.cwd();
const INPUT_VIDEO = path.join(BASE_DIR, "base.mp4");
const TMP_DIR = path.join(BASE_DIR, ".tmp");
const OUTPUT_JSON = path.join(BASE_DIR, "scripts.json");

const SETTINGS = {
  timeUnitSec: 0.1,
  mergeGapSec: 0.3,
  minSegmentDurationSec: 0.3,
};

// ノイズ表現のフィルタ
const NOISE_PATTERNS = /^\[.*\]$|^[\s\p{P}\p{S}]*$/u;

// ── ユーティリティ ──
function round01(n: number): number {
  return Math.round(n / SETTINGS.timeUnitSec) * SETTINGS.timeUnitSec;
}

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// ── AI 字幕整形 System Prompt ──
const SUBTITLE_SYSTEM_PROMPT = `
あなたはプロの字幕エディターです。
与えられる日本語字幕テキスト配列を「整形のみ」行い、必ず指定のJSONだけを返してください。

【厳守】
- 出力は **JSONのみ**。説明文、前置き、後書き、Markdown、コードフェンスは禁止。
- 必ず keys は {"formatted": [...]} のみ。追加キー禁止。
- formatted の要素数は入力 texts と完全一致。欠損・結合・分割禁止。
- 各要素は文字列。null/配列/オブジェクト禁止。

【基本方針（最優先）】
- 行数は「できる限り少なく」してください
- 1行で収まる場合は必ず1行にする
- 必要な場合のみ2行、さらに必要な場合のみ3行にする
（3行は最終手段）

【整形ルール】
1. 1行あたり全角27文字以内（目安）。超える場合のみ改行
2. 最大3行まで
3. 改行は "\\n" を使用（実際の改行ではなく文字列内エスケープ）
4. 意味・語彙・言い回しは変更しない（句読点追加や軽いスペース削除は可）
5. 音やノイズ表現（例: [笑]）は残す
6. 不自然な位置で改行しない（助詞直後・単語分断禁止）

【改行判断アルゴリズム】
- まず改行なしで27文字以内か判定
  → 収まるなら1行で確定
- 超える場合のみ文節の自然な区切りで2行化
- それでも27文字を超える行がある場合のみ3行化

【手順】
- 各 texts[i] を読む
- 最小行数になるように改行位置だけ決める
- formatted[i] に格納
`.trim();

const SUBTITLE_DEVELOPER_PROMPT = `
# 出力仕様（最優先）
あなたの出力は API により JSON としてパースされます。
したがって以下を絶対に守ってください。

- 出力は純粋なJSONのみ
- 先頭文字は { 、末尾文字は }
- Markdown・コードフェンス・説明文・改行のみの行は禁止
- 返すキーは formatted のみ
- formatted は文字列配列
- 要素数は入力 texts と完全一致
- 不明な場合も必ず空文字 "" を入れて長さを合わせる
- 文字列中の改行は \\n を使う

違反した場合、この処理は失敗します。
`.trim();


function makeSubtitleUserPrompt(batch: string[]) {
  // “余計な構造”を減らす方が安定するので文字列で渡す
  return `texts=${JSON.stringify(batch)}`;
}

// ── メイン処理 ──
async function main() {
  console.log("=== video_transcribe ===");

  // 1. 入力チェック
  if (!fs.existsSync(INPUT_VIDEO)) {
    throw new Error(`入力ファイルが見つかりません: ${INPUT_VIDEO}`);
  }

  // 2. 音声抽出
  ensureDir(TMP_DIR);
  const wavPath = path.join(TMP_DIR, "base.wav");
  console.log("音声抽出中...");
  execSync(`ffmpeg -y -i "${INPUT_VIDEO}" -ar 16000 -ac 1 -vn "${wavPath}"`, {
    stdio: "pipe",
  });
  console.log(`音声抽出完了: ${wavPath}`);

  // 3. Whisper API
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY 環境変数が設定されていません");
  }

  const openai = new OpenAI({ apiKey });

  console.log("Whisper API 呼び出し中...");

  // ファイルサイズチェック — Whisper APIは25MB制限
  const wavStat = fs.statSync(wavPath);
  const wavSizeMB = wavStat.size / (1024 * 1024);
  console.log(`音声ファイルサイズ: ${wavSizeMB.toFixed(1)} MB`);

  let whisperSegments: Array<{ start: number; end: number; text: string }>;

  if (wavSizeMB > 24) {
    // 大きなファイルは分割して処理
    console.log("ファイルが大きいため分割して処理します...");
    whisperSegments = await transcribeLargeFile(openai, wavPath);
  } else {
    whisperSegments = await transcribeSingleFile(openai, wavPath);
  }

  if (!whisperSegments || whisperSegments.length === 0) {
    throw new Error("Whisper API からセグメントが取得できませんでした");
  }
  console.log(`Whisper セグメント数: ${whisperSegments.length}`);

  // 4. フィルタリング（空テキスト・ノイズ除外）
  let segments = whisperSegments.filter((s) => {
    const trimmed = (s.text ?? "").trim();
    if (!trimmed) return false;
    if (NOISE_PATTERNS.test(trimmed)) return false;
    return true;
  });

  if (segments.length === 0) {
    throw new Error("有効なセリフが見つかりませんでした（全てノイズまたは空）");
  }

  // 5. 0.1秒丸め & 最小時間保証
  let processed = segments.map((s) => ({
    origStart: round01(s.start),
    origEnd: round01(s.end),
    text: (s.text ?? "").trim(),
  }));

  // 最小時間保証（次セグメント開始を侵害しない）
  for (let i = 0; i < processed.length; i++) {
    const seg = processed[i];
    const duration = seg.origEnd - seg.origStart;

    if (duration < SETTINGS.minSegmentDurationSec) {
      const nextStart = i + 1 < processed.length ? processed[i + 1].origStart : Infinity;
      seg.origEnd = Math.min(
        round01(seg.origStart + SETTINGS.minSegmentDurationSec),
        nextStart
      );

      // 万一 nextStart と同値で duration が0になる場合の保険
      if (seg.origEnd <= seg.origStart) {
        seg.origEnd = round01(seg.origStart + SETTINGS.timeUnitSec);
      }
    }
  }

  // 6. 近接マージ
  const merged: typeof processed = [processed[0]];
  for (let i = 1; i < processed.length; i++) {
    const prev = merged[merged.length - 1];
    const curr = processed[i];
    const gap = curr.origStart - prev.origEnd;

    if (gap <= SETTINGS.mergeGapSec) {
      // マージ
      prev.origEnd = Math.max(prev.origEnd, curr.origEnd);
      prev.text = `${prev.text} ${curr.text}`.replace(/\s+/g, " ").trim();
    } else {
      merged.push(curr);
    }
  }

  // 6.5 AI 字幕整形（GPT-5.2） + 壊れたJSON修復
  console.log("AI 字幕整形中...");
  const textList = merged.map((s) => s.text);
  const refinedTexts = await refineSubtitles(openai, textList);

  for (let i = 0; i < merged.length; i++) {
    if (refinedTexts[i] && typeof refinedTexts[i] === "string") {
      merged[i].text = refinedTexts[i];
    }
  }

  // 7. cut タイムライン付与（セリフの無い区間は詰めるが、カット間に1秒のゆとりを持たせる）
  let cursor = 0;
  const finalSegments = merged.map((s, i) => {
    const duration = round01(s.origEnd - s.origStart);
    const cutStart = round01(cursor);
    const cutEnd = round01(cursor + duration);

    // 次のセグメントへの間隔を計算
    let intervalToNext = 1.0; // デフォルト1秒のゆとり
    if (i + 1 < merged.length) {
      const nextSegment = merged[i + 1];
      const naturalGap = nextSegment.origStart - s.origEnd;
      // 元動画で1秒以下の間隔の場合は、その自然な間隔を使う（自然につなげる）
      if (naturalGap < 1.0) {
        intervalToNext = Math.max(0, round01(naturalGap));
      }
    } else {
      // 最後のセグメントには間隔不要
      intervalToNext = 0;
    }

    cursor = round01(cutEnd + intervalToNext);

    return {
      id: `seg_${String(i).padStart(4, "0")}`,
      text: s.text,
      orig: { start: s.origStart, end: s.origEnd },
      cut: { start: cutStart, end: cutEnd },
    };
  });

  // 8. scripts.json 生成
  const scriptsJson = {
    source: { videoPath: "base.mp4" },
    settings: SETTINGS,
    segments: finalSegments,
  };

  fs.writeFileSync(OUTPUT_JSON, JSON.stringify(scriptsJson, null, 2), "utf-8");
  console.log(`scripts.json 生成完了: ${OUTPUT_JSON}`);
  console.log(`最終セグメント数: ${finalSegments.length}`);
  const totalDuration = finalSegments[finalSegments.length - 1]?.cut.end ?? 0;
  console.log(`カット後合計時間: ${totalDuration.toFixed(1)} 秒`);
}

// ── Whisper 単一ファイル処理 ──
async function transcribeSingleFile(
  openai: OpenAI,
  wavPath: string
): Promise<Array<{ start: number; end: number; text: string }>> {
  const response = await openai.audio.transcriptions.create({
    model: "whisper-1",
    file: fs.createReadStream(wavPath),
    response_format: "verbose_json",
    timestamp_granularities: ["segment"],
    language: "ja",
  });

  const result = response as any;
  if (!result?.segments) {
    throw new Error("Whisper API: segments が返されませんでした");
  }
  return result.segments as Array<{ start: number; end: number; text: string }>;
}

// ── 大きなファイルの分割処理 ──
async function transcribeLargeFile(
  openai: OpenAI,
  wavPath: string
): Promise<Array<{ start: number; end: number; text: string }>> {
  // ffprobe で音声の長さを取得
  const durationStr = execSync(
    `ffprobe -v error -show_entries format=duration -of csv=p=0 "${wavPath}"`,
    { encoding: "utf-8" }
  ).trim();

  const totalDuration = parseFloat(durationStr);
  if (!Number.isFinite(totalDuration) || totalDuration <= 0) {
    throw new Error(`ffprobe で duration を取得できませんでした: "${durationStr}"`);
  }
  console.log(`音声長さ: ${totalDuration.toFixed(1)} 秒`);

  // 10分ごとに分割（余裕のあるサイズ）
  const chunkDuration = 600; // 10分
  const chunks: string[] = [];
  let offset = 0;

  while (offset < totalDuration) {
    const chunkPath = path.join(
      TMP_DIR,
      `chunk_${chunks.length.toString().padStart(3, "0")}.wav`
    );
    const dur = Math.min(chunkDuration, totalDuration - offset);

    execSync(
      `ffmpeg -y -i "${wavPath}" -ss ${offset} -t ${dur} -ar 16000 -ac 1 "${chunkPath}"`,
      { stdio: "pipe" }
    );

    chunks.push(chunkPath);
    offset += chunkDuration;
  }

  console.log(`${chunks.length} チャンクに分割`);

  // 各チャンクを処理
  const allSegments: Array<{ start: number; end: number; text: string }> = [];
  let chunkOffset = 0;

  for (let i = 0; i < chunks.length; i++) {
    console.log(`チャンク ${i + 1}/${chunks.length} 処理中...`);
    const chunkSegments = await transcribeSingleFile(openai, chunks[i]);

    for (const seg of chunkSegments) {
      allSegments.push({
        start: seg.start + chunkOffset,
        end: seg.end + chunkOffset,
        text: seg.text,
      });
    }

    chunkOffset += chunkDuration;
  }

  // 一時チャンクファイルを削除（失敗しても処理は続ける）
  for (const chunk of chunks) {
    try {
      fs.unlinkSync(chunk);
    } catch {}
  }

  return allSegments;
}

function validateFormattedPayload(obj: any, expectedLen: number): string[] | null {
  if (!obj?.formatted || !Array.isArray(obj.formatted)) return null;
  if (obj.formatted.length !== expectedLen) return null;
  if (!obj.formatted.every((x: any) => typeof x === "string")) return null;
  return obj.formatted as string[];
}

function parseFormattedPayload(raw: string, expectedLen: number): string[] | null {
  try {
    return validateFormattedPayload(JSON.parse(raw), expectedLen);
  } catch {
    return null;
  }
}

// ── JSONパース or 修復 ──
async function parseOrRepairFormatted(
  openai: OpenAI,
  raw: string,
  expectedLen: number
): Promise<string[] | null> {
  // 1) そのまま parse
  try {
    return validateFormattedPayload(JSON.parse(raw), expectedLen);
  } catch {}

  // 2) コードフェンス剥がし
  const stripped = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```$/i, "")
    .trim();
  try {
    return validateFormattedPayload(JSON.parse(stripped), expectedLen);
  } catch {}

  // 3) 修復専用でもう一回
  const repair = await openai.chat.completions.create({
    model: "gpt-5.2",
    messages: [
      {
        role: "system",
        content: `
あなたはJSON修復ツールです。
入力は壊れた可能性のある出力です。
必ず次の形式の **JSONのみ** を返してください:
{"formatted":[...]}
- formatted は文字列配列
- 要素数は ${expectedLen} に必ず一致
- 説明文やMarkdownは禁止
`.trim(),
      },
      { role: "user", content: raw },
    ],
    response_format: { type: "json_object" },
    temperature: 0,
  });

  const fixed = repair.choices[0].message.content ?? "";
  try {
    return validateFormattedPayload(JSON.parse(fixed), expectedLen);
  } catch {}

  return null;
}

// ── AI 字幕整形 ──
async function refineSubtitles(openai: OpenAI, texts: string[]): Promise<string[]> {
  // 迷ったら小さめの方が安定（コストは増える）
  const BATCH_SIZE = 10;
  const MAX_COMPLETION_RETRIES_BEFORE_REPAIR = 3;
  const results: string[] = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    console.log(
      `  字幕整形バッチ: ${i + 1}〜${Math.min(i + BATCH_SIZE, texts.length)} / ${texts.length}`
    );

    try {
      let strictFormatted: string[] | null = null;
      let rawForRepair = "";
      let lastCompletionError: unknown = null;

      for (
        let attempt = 0;
        attempt <= MAX_COMPLETION_RETRIES_BEFORE_REPAIR;
        attempt++
      ) {
        try {
          const completion = await openai.chat.completions.create({
            model: "gpt-5.2",
            messages: [
              { role: "system", content: SUBTITLE_SYSTEM_PROMPT },
              { role: "user", content: makeSubtitleUserPrompt(batch) },
              { role: "developer", content: SUBTITLE_DEVELOPER_PROMPT },
            ],
            response_format: { type: "json_object" },
            temperature: 0,
          });

          rawForRepair = completion.choices[0].message.content ?? "";
          strictFormatted = parseFormattedPayload(rawForRepair, batch.length);

          if (strictFormatted) {
            break;
          }

          if (attempt < MAX_COMPLETION_RETRIES_BEFORE_REPAIR) {
            console.warn(
              `  警告: 字幕整形のJSONが不正です。再試行します (${attempt + 1}/${MAX_COMPLETION_RETRIES_BEFORE_REPAIR})`
            );
          }
        } catch (completionError) {
          lastCompletionError = completionError;
          if (attempt < MAX_COMPLETION_RETRIES_BEFORE_REPAIR) {
            console.warn(
              `  警告: 字幕整形API呼び出しに失敗しました。再試行します (${attempt + 1}/${MAX_COMPLETION_RETRIES_BEFORE_REPAIR})`
            );
          }
        }
      }

      if (strictFormatted) {
        results.push(...strictFormatted);
        continue;
      }

      if (!rawForRepair) {
        console.error(
          "  エラー: 字幕整形に失敗しました。元のテキストを使用します。",
          (lastCompletionError as any)?.message ?? lastCompletionError ?? "response is empty"
        );
        results.push(...batch);
        continue;
      }

      const formatted = await parseOrRepairFormatted(openai, rawForRepair, batch.length);

      if (!formatted) {
        console.warn("  警告: JSON修復も失敗。元のテキストを使用します。");
        results.push(...batch);
        continue;
      }

      results.push(...formatted);
    } catch (e: any) {
      console.error("  エラー: 字幕整形に失敗しました。元のテキストを使用します。", e?.message ?? e);
      results.push(...batch);
    }
  }

  return results;
}

main().catch((err) => {
  console.error("エラー:", err?.message ?? err);
  process.exit(1);
});
