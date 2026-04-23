import { SUBTITLE_PRIORITY_PHRASES } from "./subtitle-priority-phrases";

export interface Segment {
  id: string;
  text: string;
  orig: { start: number; end: number };
  cut: { start: number; end: number };
}

export interface TranscribeSettings {
  timeUnitSec: number;
  mergeGapSec: number;
  minSegmentDurationSec: number;
  marginBeforeSec: number;
  marginAfterSec: number;
}

export interface RenderSpec {
  compositionId: string;
  outputFile: string;
  publishToDownloads?: boolean;
  getInputProps: (segments: Segment[], fps: number) => Record<string, unknown>;
}

export interface TitleSpec {
  compositionId: string;
  inputVideoFile: string;
  outputFile: string;
}

export interface Profile {
  baseDir: string;
  maxLineChars: number;
  settings: TranscribeSettings;
  remotionEntry: string;
  renders: RenderSpec[];
  title: TitleSpec;
}

export const PROFILES: Record<string, Profile> = {
  long: {
    baseDir: ".",
    maxLineChars: 27,
    settings: {
      timeUnitSec: 0.1,
      mergeGapSec: 0.1,
      minSegmentDurationSec: 0.4,
      marginBeforeSec: 0.3,
      marginAfterSec: 0.3,
    },
    remotionEntry: "remotion/src/index.ts",
    renders: [
      {
        compositionId: "JetComposition",
        outputFile: "jet.mp4",
        publishToDownloads: false,
        getInputProps: (segments, fps) => ({ segments, fps }),
      },
      {
        compositionId: "ScriptComposition",
        outputFile: "script.mp4",
        publishToDownloads: true,
        getInputProps: (segments, fps) => ({ segments, fps }),
      },
    ],
    title: {
      compositionId: "TitleComposition",
      inputVideoFile: "script.mp4",
      outputFile: "titled.mp4",
    },
  },
};

export const VIDEO_EDIT_SETTINGS = {
  render: {
    fps: 30,
  },
  audioChunking: {
    whisperChunkSec: 600,
  },
  ai: {
    subtitleConcurrency: 5,
    scriptDraftBatchSize: 20,
    maxRetries: 3,
    transcriptionModel: "whisper-1",
    scriptDraftModel: "gpt-5.2",
    subtitleModel: "gpt-5.2",
    jsonRepairModel: "gpt-5.2",
  },
  fileDetection: {
    baseVideoPattern: /^base(\d*)\.mp4$/i,
  },
  transcriptionFilters: {
    noisePattern: /^\[.*\]$|^[\s\p{P}\p{S}]*$/u,
    fillerPattern: /^(えー+|えっと|えーと|えーっと|あのー+|あのう|うーん+|うん|うー+|んー+|ん|まあ|はい)[。、！？]?$/,
  },
  subtitleMerging: {
    lineOverflowFactor: 1.2,
    mergeCharFactor: 1.5,
    mergeBoundaryOverflowChars: 4,
    tailMergeGapSec: 0.5,
    awkwardBoundaryMergeGapSec: 0.3,
    continuationHeadPattern: /^[ーァィゥェォッャュョヮヵヶぁぃぅぇぉっゃゅょゎんン]/u,
    shortTailSegmentPattern: /^(です|ます|でした|ですよ|ですね|でしょう|ください|下さい|ましょう|ました|ません|って|ので|から|けど|んで|ですか|ますか)$/u,
    awkwardSegmentHeadPattern: /^(を|です|ます|でした|ですよ|ですね|でしょう|ください|下さい|ましょう|ました|ません|ます|が|に|で|と|は|も|の|へ|や|か|って|から|ので|けど|し|だと|、|。)/u,
    terminalSegmentEndPattern: /[。！？!?]$/u,
  },
  promptTuning: {
    subtitlePriorityPhrases: SUBTITLE_PRIORITY_PHRASES,
  },
} as const;

export const SUBTITLE_DEVELOPER_PROMPT = `
# 出力仕様（最優先・厳守）
あなたの出力は API により JSON としてパースされます。
以下を **絶対に** 守ってください。

- 出力は純粋なJSONのみ
- 先頭文字は { 、末尾文字は }
- Markdown・コードフェンス・説明文・改行のみの行は禁止
- 返すキーは formatted のみ
- formatted は文字列配列
- 要素数は入力 texts と完全一致
- 不明な場合も必ず空文字 "" を入れて長さを合わせる
- 文字列中の改行は \\n を使う

## 順序・分割・結合の禁止（最重要）
- formatted[i] は必ず texts[i] の変換結果のみを入れる
- 1つの入力要素を複数の出力要素に分割しない
- 複数の入力要素を1つの出力要素にまとめない
- 要素の順序を入れ替えない

違反した場合、この処理は失敗します。
`.trim();

export function buildLineFormatPrompt(lines: 2 | 3, maxLineChars: number): string {
  if (lines === 2) {
    return `
あなたはプロの字幕エディターです。
与えられる日本語テキスト配列を、それぞれ「自然な2行の字幕」に整形し、JSONで返してください。

【厳守】
- 出力は {"formatted": [...]} のJSONのみ。説明文・Markdown禁止。
- formatted の要素数は入力 texts と完全一致
- 各要素は "1行目\\n2行目" の形式（改行は \\n）
- 各行は全角${maxLineChars}文字以内
- 意味の改変は禁止（句読点追加・軽微な語尾補正・字幕向けの自然化は可）
- 助詞直後・単語の分断での改行は禁止
- 単語途中で終わる不自然な字幕にしない
- 前後文脈がなくても読める自然な字幕として成立させる
- 固有名詞、作品名、人物名、地名、商品名、英単語はできるだけ自然で正式な表記を保つ
- 2行の長さがなるべく均等になる位置で改行する
- formatted[i] は必ず texts[i] の内容のみを変換する。分割・結合・並び替えは禁止
`.trim();
  }

  return `
あなたはプロの字幕エディターです。
与えられる日本語テキスト配列を、それぞれ「自然な最大3行の字幕」に整形し、JSONで返してください。

【厳守】
- 出力は {"formatted": [...]} のJSONのみ。説明文・Markdown禁止。
- formatted の要素数は入力 texts と完全一致
- 各要素は改行 \\n で区切った2〜3行の文字列
- 各行は全角${maxLineChars}文字以内
- 意味の改変は禁止（句読点追加・軽微な語尾補正・字幕向けの自然化は可）
- 助詞直後・単語の分断での改行は禁止
- 単語途中で終わる不自然な字幕にしない
- 前後文脈がなくても読める自然な字幕として成立させる
- 固有名詞、作品名、人物名、地名、商品名、英単語はできるだけ自然で正式な表記を保つ
- 各行の長さがなるべく均等になるよう改行位置を選ぶ
- formatted[i] は必ず texts[i] の内容のみを変換する。分割・結合・並び替えは禁止
`.trim();
}

export function buildNaturalizePrompt(maxLineChars: number): string {
  return `
あなたはプロの動画字幕エディターです。
与えられる日本語テキスト配列を、それぞれ「字幕として自然に読みやすい1要素」に軽く整え、JSONで返してください。

【厳守】
- 出力は {"formatted": [...]} のJSONのみ。説明文・Markdown禁止。
- formatted の要素数は入力 texts と完全一致
- 各要素は1つの文字列で返し、改行は入れない
- 各要素はおおむね全角${Math.floor(maxLineChars * 3)}文字以内

【自然化ルール】
- 元の意味は変えない
- フィラーや言い淀み、冗長な繰り返しは削ってよい
- 句読点の追加や軽微な語尾補正は可
- 音声のニュアンスは残しつつ、字幕として自然な言い回しを優先する
- 単語途中で終わる不自然な表現は避ける
- 助詞や助動詞だけが浮いた不自然な字幕は避ける
- 前後文脈なしでも読める短文に寄せる
- 隣接要素の内容を丸ごと移動しない。各要素は元の要素の範囲内で最小限に整える
- formatted[i] は必ず texts[i] の内容のみを変換する。分割・結合・並び替えは禁止
`.trim();
}

export function buildScriptDraftPrompt(maxLineChars: number): string {
  return `
あなたは動画全体の流れを整える台本エディターです。
時系列順に並んだ日本語テキスト配列を見て、配列全体の流れを踏まえながら、それぞれを「動画の台本として自然な1要素」に整形し、JSONで返してください。

【厳守】
- 出力は {"formatted": [...]} のJSONのみ。説明文・Markdown禁止。
- formatted の要素数は入力 texts と完全一致
- 各要素は1つの文字列で返し、改行は入れない
- 各要素はおおむね全角${Math.floor(maxLineChars * 3)}文字以内

【台本化ルール】
- 入力は動画の時系列順。前後要素も参考にして文脈を合わせる
- ただし formatted[i] は必ず texts[i] の内容だけを整形する
- 要素の分割・結合・並び替えは禁止
- 元の意味は変えない
- フィラー、言い淀み、重複、言い直しは削ってよい
- 誤認識と思われる語は、前後文脈から妥当な表記に直してよい
- 固有名詞、作品名、人物名、地名、商品名、英単語、ファイル名はできるだけ自然で正式な表記を保つ
- 話し言葉の自然さは残しつつ、字幕に流しやすい滑らかな言い回しにする
- 単語途中で終わる不自然な表現にしない
- 前後の要素とつなげたとき、全体として読みやすい流れになるようにする
`.trim();
}

export function buildTechnicalNormalizePrompt(
  maxLineChars: number,
  subtitlePriorityPhrases: readonly string[]
): string {
  const priorityExamples = subtitlePriorityPhrases.map((term) => `- ${term}`).join("\n");

  return `
あなたは、どんなジャンルの動画にも対応する字幕校正エディターです。
与えられる日本語テキスト配列を、それぞれ「固有名詞や重要語を壊さずに読みやすくした1要素」に整え、JSONで返してください。

【厳守】
- 出力は {"formatted": [...]} のJSONのみ。説明文・Markdown禁止。
- formatted の要素数は入力 texts と完全一致
- 各要素は1つの文字列で返し、改行は入れない
- 各要素はおおむね全角${Math.floor(maxLineChars * 3)}文字以内

【表記保護ルール】
- 固有名詞、作品名、人物名、地名、ブランド名、サービス名、商品名、専門用語、英単語、数字列、ファイル名は最優先で保護する
- 意味が明確なら、一般的で自然な正式表記に寄せてよい
- ただし、推測で別の名前や別の作品・商品に置き換えない
- 英字の単語や識別子は、むやみにひらがな・カタカナ化しない
- 句読点追加や軽微な表記修正は可
- 元の意味は変えない

【優先したい表記例】
${priorityExamples}

【避けること】
- 固有名詞や重要語を一般語に言い換えすぎる
- 英単語や名前のスペルを崩す
- 1つの要素にない情報を追加する
- formatted[i] は必ず texts[i] の内容のみを変換する。分割・結合・並び替えは禁止
`.trim();
}

export function buildRewritePrompt(maxLineChars: number): string {
  return `
あなたはプロの動画字幕エディターです。
与えられる日本語テキスト配列（話し言葉の書き起こし）を、視聴者に伝わる簡潔な字幕に要約・整形し、JSONで返してください。

【厳守】
- 出力は {"formatted": [...]} のJSONのみ。説明文・Markdown禁止。
- formatted の要素数は入力 texts と完全一致
- 各行は全角${maxLineChars}文字以内、最大3行
- 改行は \\n で表現

【リライトルール】
- 元の内容の要点・核心だけを残す
- フィラー（えー、あの、ですよ等）・繰り返し・前置きは削除してよい
- 話し言葉のニュアンスを残す（書き言葉に変換しない）
- 複数の話題が含まれる場合は最も重要な1つに絞る
- 単語途中で終わる不自然な字幕にしない
- 前後文脈がなくても読める自然な字幕にする
- 固有名詞、作品名、人物名、地名、商品名、英単語の表記は保護する
- formatted[i] は必ず texts[i] の内容のみを変換する。分割・結合・並び替えは禁止
`.trim();
}

export function buildJsonRepairDeveloperPrompt(expectedLen: number): string {
  return `
# 出力仕様（最優先）
- 出力は **純粋なJSONのみ**
- 先頭は { 、末尾は }
- Markdown・コードフェンス・説明文・余計な改行は禁止
- 返すキーは formatted のみ（他のキーは禁止）
- formatted は文字列配列
- formatted の要素数は ${expectedLen} に必ず一致
- 不足する場合は "" を追加して埋める
- 超過する場合は末尾を切り捨てる
- 文字列内の改行は \\n で表現
- null / undefined は禁止（必ず文字列）
`.trim();
}
