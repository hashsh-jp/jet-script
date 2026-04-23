# jet-script

`~/Downloads` 直下を入力と公開出力の置き場所として使います。既定は long 動画向け設定です。`base.mp4` もしくは `base1.mp4`, `base2.mp4`... を置いて実行すると、AIで文字起こし・無音カット・字幕整形を行い、最後に `bgm.mp3` をミックスして完成動画を生成します。

- `jet.mp4`（作業用。`~/Downloads/.tmp/jet-script-work/` に保存）
- `script.mp4`
- `titled.mp4`（`VIDEO_TITLE` または `--title` 指定時のみ）

## 前提

- macOS
- Node.js 18 以上
- `ffmpeg` / `ffprobe`
- OpenAI API キー

## Mac 環境構築

新しい Mac でまだ何も入っていない場合は、この順番で進めてください。  
作業はすべて `ターミナル` アプリで行います。`Launchpad` や `Spotlight` で「ターミナル」と検索して開いてください。

### 1. Xcode Command Line Tools を入れる

以下を入力して Enter:

```bash
xcode-select --install
```

画面が出たら、そのままインストールしてください。

### 2. Homebrew を入れる

以下を丸ごと貼り付けて Enter:

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

Apple Silicon Mac の場合、途中で `~/.zprofile` に追加するよう案内が出たら、その案内どおりに実行してください。よくある例はこれです。

```bash
eval "$(/opt/homebrew/bin/brew shellenv)"
```

### 3. Homebrew が使えるか確認する

```bash
brew --version
```

数字が表示されれば成功です。

### 4. Node.js を入れる

```bash
brew install node
```

入ったか確認:

```bash
node -v
npm -v
```

どちらも数字が表示されれば大丈夫です。

### 5. Git を入れる

```bash
brew install git
```

確認:

```bash
git --version
```

### 6. Git の名前とメールアドレスを設定する

自分の情報に置き換えて実行してください。

```bash
git config --global user.name "Your Name"
git config --global user.email "you@example.com"
```

### 7. このリポジトリをダウンロードする

デスクトップに置く例です。

```bash
cd ~/Desktop
git clone <このリポジトリのURL>
cd jet-script
```

フォルダに入れたか確認したい場合は、次を実行してください。

```bash
pwd
ls
```

## セットアップ

ここからは `jet-script` フォルダの中で作業します。

### 1. 依存関係を入れる

```bash
npm install
```

少し時間がかかります。最後まで終われば OK です。

### 2. 設定ファイルを作る

```bash
cp .env.example .env
```

### 3. OpenAI API キーを入れる

`.env` を開きます。たとえば TextEdit なら次です。

```bash
open -e .env
```

開いたら、次のように API キーを入れて保存してください。

```env
OPENAI_API_KEY=sk-proj-...
```

### 4. 動くか確認する

```bash
npm run typecheck
```

エラーが出なければ準備完了です。

## 配置

実行時に以下の配置を使います。

```text
~/Downloads/
├── base.mp4
├── base1.mp4, base2.mp4 ...
├── script.mp4
├── titled.mp4
└── .tmp/
    └── jet-script-work/
        ├── jet.mp4
        ├── bgm.mp3
        ├── scripts.json
        ├── scripts_base.json
        └── scripts_merged.json
```

- 元動画は `~/Downloads` 直下に置きます。
- 実行時は Downloads 直下の元動画を `.tmp/jet-script-work/` にコピーして処理します。
- 公開用の完成動画だけ `~/Downloads` 直下に出力されます。
- `jet.mp4` は作業用出力として `~/Downloads/.tmp/jet-script-work/jet.mp4` に保存され、`~/Downloads` 直下には出力されません。
- `scripts.json` / `scripts_base.json` / `scripts_merged.json` / `bgm.mp3` は `~/Downloads/.tmp/jet-script-work/` で管理します。
- 初回実行時、同梱の `bgm.mp3` が `~/Downloads/.tmp/jet-script-work/bgm.mp3` に自動コピーされます。必要ならそのファイルを差し替えて管理できます。
- 出力動画には `~/Downloads/.tmp/jet-script-work/bgm.mp3` が自動でミックスされます。
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

`.tmp/jet-script-work/scripts.json` から再レンダリングだけ:

```bash
npm run render
```

base 連結だけ:

```bash
npm run base-video
```

## 出力物

- `~/Downloads/script.mp4`: 字幕付き版 + BGM
- `~/Downloads/titled.mp4`: タイトル付き版 + BGM
- `~/Downloads/.tmp/jet-script-work/jet.mp4`: 無音全カット版 + BGM
- `~/Downloads/.tmp/jet-script-work/bgm.mp3`: BGM 素材
- `~/Downloads/.tmp/jet-script-work/scripts_base.json`: Whisper 生データの保存
- `~/Downloads/.tmp/jet-script-work/scripts_merged.json`: AI整形前のマージ結果
- `~/Downloads/.tmp/jet-script-work/scripts.json`: 最終的なタイムライン

`~/Downloads/.tmp/jet-script-work/` は中間処理用の作業ディレクトリです。通常は Downloads 直下の入出力だけ見れば足ります。

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
