# jet-script

AI で文字起こし、字幕整形、書き出しまでまとめてできる動画編集ツールです。  
動画は `~/Downloads` に置くだけで使えます。

参考動画
https://youtu.be/L8OAStr9SS4

## 使う前に必要なもの

- Mac
- Node.js
- `ffmpeg`
- OpenAI API キー

## ステップ1. このフォルダを開く

ターミナルでこのプロジェクトのフォルダに移動します。

```bash
cd ~/Desktop/jet-script
```

## ステップ2. 依存関係を入れる

最初に1回だけ実行します。

```bash
npm install
```

## ステップ3. OpenAI の API キーを取得する

OpenAI の API キー発行ページを開いて、API キーを作成してください。

`https://platform.openai.com/api-keys`

作成したキーは `sk-...` で始まります。

## ステップ4. 環境変数を設定する

まず設定ファイルを作ります。

```bash
cp .env.example .env
```

次に `.env` を開きます。

```bash
open -e .env
```

開いたら、次のように API キーを入れて保存してください。

```env
OPENAI_API_KEY=sk-ここにあなたのキー
```

## ステップ5. 元動画を置く

`~/Downloads` に動画を置いてください。

- 1本だけなら `base.mp4`
- 複数本なら `base1.mp4`, `base2.mp4`, `base3.mp4`

## ステップ6. 実行する

ふだんはこれだけで大丈夫です。

```bash
npm run all
```

タイトル付きも作りたいとき:

```bash
VIDEO_TITLE="ここにタイトル" npm run all:title
```

文字起こしだけ試したいとき:

```bash
npm run transcribe
```

## ステップ7. 出力を見る

完成した動画は `~/Downloads` に出ます。

- `script.mp4`
- `titled.mp4`（タイトル指定したときだけ）

途中ファイルは `~/Downloads/.tmp/jet-script-work/` に出ます。

## できることを少しだけ広げる

### BGM を変えたいとき

BGM は差し替えできます。  
`~/Downloads/.tmp/jet-script-work/bgm.mp3` を好きな音源に入れ替えてください。

### タイトルも出したいとき

タイトル付き動画も作れます。

```bash
VIDEO_TITLE="ここにタイトル" npm run all:title
```

### もっとカスタマイズしたいとき

このツールは土台として使えるように作ってあります。  
BGM 以外にも、字幕の出し方、タイトル表示、見た目、処理の流れなどを調整すれば、いろいろな動画編集に広げられます。

Claude Code や Codex を使ってカスタマイズしていく使い方がおすすめです。

## 安定化のコツ

字幕の表記を安定させたいときは、[scripts/subtitle-priority-phrases.ts](./scripts/subtitle-priority-phrases.ts) を編集してください。

ここに追加した名前は、字幕で崩れにくくなります。

- 人名
- 会社名
- 商品名
- 作品名
- 地名
- 英単語

例:

```ts
export const SUBTITLE_PRIORITY_PHRASES = [
  "ChatGPT",
  "Claude Code",
  "田中太郎",
  "渋谷スクランブルスクエア",
];
```

よく出てくる名前を少しずつ足していくと、全体の動作がだんだん安定していきます。

## うまくいかないとき

- `OPENAI_API_KEY` が入っているか確認する
- 動画名が `base.mp4` になっているか確認する
- `ffmpeg` が入っているか確認する

## カスタマイズしてみたい方へ

「ここを変えたい」「こういう動画にしたい」というものがあれば、Claude Code や Codex でそのままカスタマイズできます。

自分で触るのが不安な場合は、依頼ベースで調整していくこともできます。  
使い方で相談したい場合は、下の公式Lineからご連絡ください。

`https://lin.ee/TFy38s7`
