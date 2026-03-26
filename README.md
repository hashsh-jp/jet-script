# jet-script

`~/Downloads` 直下を作業場所として使います。`base.mp4` もしくは `base1.mp4`, `base2.mp4`... を置いて実行すると、AIで文字起こし・無音カット・字幕整形を行い、最後に `bgm.mp3` をミックスして以下を生成します。

- `scripts.json`
- `jet.mp4`
- `script.mp4`
- `titled.mp4`（`VIDEO_TITLE` または `--title` 指定時のみ）

## 前提

- macOS
- Node.js 18 以上
- `ffmpeg` / `ffprobe`
- OpenAI API キー

## セットアップ

```bash
npm install
cp .env.example .env
```

`.env` に API キーを設定してください。

```env
OPENAI_API_KEY=sk-proj-...
```

## 配置

実行時に以下の配置を使います。

```text
~/Downloads/
├── base.mp4
├── base1.mp4, base2.mp4 ...
├── jet.mp4
├── script.mp4
├── titled.mp4
├── scripts.json
├── scripts_base.json
├── scripts_merged.json
├── bgm.mp3
└── jet-script-work/
```

- 元動画は `~/Downloads` 直下に置きます。
- 実行時は Downloads 直下の元動画を `jet-script-work/` にコピーして処理します。
- 完成した動画と `scripts.json` は `~/Downloads` 直下に出力されます。
- 初回実行時、同梱の `bgm.mp3` が `~/Downloads/bgm.mp3` に自動コピーされます。必要なら手元の BGM ファイルに差し替えて管理できます。
- 出力動画には `~/Downloads/bgm.mp3` が自動でミックスされます。
- 複数ファイルを先につなぎたい場合は、`base1.mp4`, `base2.mp4` ... のように置けば実行時に自動結合されます。

## 実行

通常実行:

```bash
npm run all
```

タイトル付きも作る:

```bash
VIDEO_TITLE="ここにタイトル" npm run all:title
```

## 部分実行

文字起こしだけ:

```bash
npm run transcribe
```

`scripts.json` から再レンダリングだけ:

```bash
npm run render
```

base 連結だけ:

```bash
npm run base-video
```

## 出力物

- `~/Downloads/scripts_base.json`: Whisper 生データの保存
- `~/Downloads/scripts_merged.json`: AI整形前のマージ結果
- `~/Downloads/scripts.json`: 最終的なタイムライン
- `~/Downloads/jet.mp4`: 無音全カット版 + BGM
- `~/Downloads/script.mp4`: 字幕付き版 + BGM
- `~/Downloads/titled.mp4`: タイトル付き版 + BGM

`~/Downloads/jet-script-work/` は中間処理用の作業ディレクトリです。通常は Downloads 直下の入出力だけ見れば足ります。

## 同梱内容

この配布版には以下が含まれます。

- 字幕整形済みの統合 CLI
- `JetComposition` / `ScriptComposition` / `TitleComposition`
- `base.mp4` / `baseN.mp4` の安全な結合処理
- Remotion の単一バンドルからの複数出力
- 初期 BGM とその自動ミックス処理

## 注意

- OpenAI API 利用料が発生します。
- 初回レンダリングは Remotion のバンドルに時間がかかります。
- `script.mp4` を生成してから `titled.mp4` を作るため、タイトル付き実行は通常実行より少し長くなります。
