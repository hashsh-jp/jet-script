# video-edit

hashshnet動画編集ツール - 動画から自動で字幕付き動画を生成します

---

## このツールでできること

元の動画ファイル（`base.mp4`）を入れると、AIが自動で文字起こしをして、字幕付きの動画を2種類作ってくれます。

---

## セットアップ（初回だけ）

### 必要なもの

始める前に、以下の3つを用意してください。

| 必要なもの | 説明 |
|-----------|------|
| **Node.js 18以上** | JavaScriptを動かすためのソフト |
| **OpenAI APIキー** | AIの文字起こしに使います（有料） |
| **元動画 `base.mp4`** | 字幕をつけたい動画ファイル |

---

### Mac の場合

ターミナル（`アプリケーション > ユーティリティ > ターミナル`）を開いて、上から順番にコピペしてください。

#### ステップ 1: Node.js がインストールされているか確認

```bash
node -v
```

`v18.x.x` や `v20.x.x` のように表示されればOKです。
表示されない場合は、https://nodejs.org/ からインストールしてください（LTS版を選んでください）。

#### ステップ 2: video-edit ディレクトリに移動

```bash
cd video-edit
```

> ダウンロードした場所によってパスが違います。Finderで `video-edit` フォルダを見つけて、ターミナルにドラッグ＆ドロップすると自動でパスが入ります。
> 例: `cd /Users/あなたのユーザー名/Desktop/video-edit`

#### ステップ 3: パッケージをインストール（ルート）

```bash
npm install
```

> 画面にたくさん文字が流れますが、エラー（赤い文字で `ERR!`）が出なければ大丈夫です。

#### ステップ 4: remotion ディレクトリのパッケージもインストール

```bash
cd remotion
npm install
cd ..
```

> `remotion/` の中にも別の `package.json` があるので、こちらも忘れずにインストールしてください。`cd ..` で元のディレクトリに戻ります。

#### ステップ 5: 環境設定ファイルを作成

```bash
cp .env.example .env
```

#### ステップ 6: APIキーを設定

```bash
open .env
```

ファイルが開いたら、`sk-your-api-key-here` の部分を自分のAPIキーに書き換えて保存してください。

```
OPENAI_API_KEY=sk-ここに自分のAPIキーを貼る
```

> APIキーの取得方法: https://platform.openai.com/api-keys にアクセスして、「Create new secret key」をクリック

#### ステップ 7: 元動画を配置

`base.mp4`（字幕をつけたい動画）を `video-edit` フォルダの中にドラッグ＆ドロップしてください。

#### セットアップ完了の確認（Mac）

以下のコマンドで全部揃っているか確認できます。

```bash
node -v && echo "--- Node.js OK ---" && ls base.mp4 && echo "--- base.mp4 OK ---" && cat .env | head -1 && echo "--- .env OK ---" && ls node_modules > /dev/null && echo "--- npm install OK ---" && ls remotion/node_modules > /dev/null && echo "--- remotion npm install OK ---"
```

全部 `OK` と表示されれば準備完了です。

---

### Windows の場合

コマンドプロンプト（`Windowsキー` を押して `cmd` と入力してEnter）を開いて、上から順番にコピペしてください。

> PowerShellでも同様に動作します。

#### ステップ 1: Node.js がインストールされているか確認

```cmd
node -v
```

`v18.x.x` や `v20.x.x` のように表示されればOKです。
表示されない場合は、https://nodejs.org/ からインストールしてください（LTS版を選んでください）。インストール後、コマンドプロンプトを一度閉じて開き直してください。

#### ステップ 2: video-edit ディレクトリに移動

```cmd
cd video-edit
```

> ダウンロードした場所によってパスが違います。エクスプローラーで `video-edit` フォルダを開いて、アドレスバーに `cmd` と入力してEnterを押すと、そのフォルダでコマンドプロンプトが開きます。
> 例: `cd C:\Users\あなたのユーザー名\Desktop\video-edit`

#### ステップ 3: パッケージをインストール（ルート）

```cmd
npm install
```

> 画面にたくさん文字が流れますが、エラー（赤い文字で `ERR!`）が出なければ大丈夫です。

#### ステップ 4: remotion ディレクトリのパッケージもインストール

```cmd
cd remotion
npm install
cd ..
```

> `remotion\` の中にも別の `package.json` があるので、こちらも忘れずにインストールしてください。`cd ..` で元のディレクトリに戻ります。

#### ステップ 5: 環境設定ファイルを作成

```cmd
copy .env.example .env
```

#### ステップ 6: APIキーを設定

```cmd
notepad .env
```

メモ帳が開いたら、`sk-your-api-key-here` の部分を自分のAPIキーに書き換えて保存してください。

```
OPENAI_API_KEY=sk-ここに自分のAPIキーを貼る
```

> APIキーの取得方法: https://platform.openai.com/api-keys にアクセスして、「Create new secret key」をクリック

#### ステップ 7: 元動画を配置

`base.mp4`（字幕をつけたい動画）を `video-edit` フォルダの中にドラッグ＆ドロップしてください。

#### セットアップ完了の確認（Windows）

```cmd
node -v && echo --- Node.js OK --- && dir base.mp4 && echo --- base.mp4 OK --- && type .env && echo --- .env OK --- && dir node_modules >nul && echo --- npm install OK --- && dir remotion\node_modules >nul && echo --- remotion npm install OK ---
```

全部 `OK` と表示されれば準備完了です。

---

## 使い方

### ヘルプを見る
```bash
npm run help
```

初回準備の手順が表示されます。

### 実行する
```bash
npm run all
```

これだけ！

自動で以下が実行されます：
1. 文字起こし（`base.mp4` → `scripts.json`）
2. script.mp4 生成
3. jet.mp4 生成

---

## 生成されるファイル

| ファイル | 説明 |
|---------|------|
| `scripts.json` | 文字起こし結果とタイムライン |
| `script.mp4` | 字幕付き動画（script版） |
| `jet.mp4` | 字幕付き動画（jet版） |

---

## トラブルシューティング

### エラーが出る

1. `.env` にAPIキーが設定されているか確認
   ```bash
   cat .env
   ```

2. `base.mp4` が配置されているか確認
   ```bash
   ls -lh base.mp4
   ```

3. `node_modules` がインストールされているか確認
   ```bash
   npm install
   ```

4. `remotion/node_modules` がインストールされているか確認
   ```bash
   cd remotion && npm install && cd ..
   ```

### `remotion` 関連のエラーが出る

remotion ディレクトリのパッケージがインストールされていない可能性があります。

```bash
cd remotion
npm install
cd ..
```

### 途中で止まった

もう一度実行してください：
```bash
npm run all
```

`scripts.json` が既にある場合は、途中から再開されます。

### 最初からやり直したい

生成ファイルを削除：
```bash
rm -rf .tmp/ scripts.json script.mp4 jet.mp4
```

再実行：
```bash
npm run all
```

> Windows の場合:
> ```cmd
> del /q scripts.json script.mp4 jet.mp4
> rmdir /s /q .tmp
> npm run all
> ```

---

## カスタマイズ（上級者向け）

### カット間の間隔を変更

`scripts/video_transcribe.ts` の221行目：
```typescript
let intervalToNext = 1.0; // ← この数値を変更（単位：秒）
```

### 字幕スタイルを変更

- `prompt/SHORT_VIDEO_RULES.md` - ショート動画用
- `prompt/LONG_VIDEO_RULES.md` - ロング動画用

---

## サポート

問題が解決しない場合は、以下を確認してください：

- [ ] Node.js 18以上がインストールされている
- [ ] `npm install` を実行した（ルートディレクトリ）
- [ ] `remotion/` ディレクトリでも `npm install` を実行した
- [ ] `.env` にAPIキーが設定されている
- [ ] `base.mp4` が配置されている
- [ ] インターネットに接続されている

それでも解決しない場合は、エラーメッセージを添えてご相談ください。
