# video-edit（jet-script）

hashshnet 動画編集ツール — 動画ファイルを渡すだけで、AIが自動で文字起こし・無音カット・字幕生成をして動画を2種類書き出します。

---

## 目次

- [できること](#できること)
- [仕組みの概要](#仕組みの概要)
- [セットアップ（Mac）](#セットアップmac)
- [使い方](#使い方)
- [生成されるファイル](#生成されるファイル)
- [トラブルシューティング](#トラブルシューティング)
- [API コスト目安](#api-コスト目安)
- [カスタマイズ（上級者向け）](#カスタマイズ上級者向け)

---

## できること

`base.mp4` を置いて `npm run all` を叩くだけで、以下の3つが自動生成されます。

| 出力ファイル | 内容 |
|-------------|------|
| `scripts.json` | 文字起こし結果 ＋ タイムライン情報 |
| `jet.mp4` | 無音部分をカットした動画 |
| `script.mp4` | 無音カット ＋ 字幕（白文字・黒縁）付き動画 |

出力仕様：1920×1080 / 30fps / H.264

---

## 仕組みの概要

```
base.mp4
  │
  ├─ [1] ffmpeg で音声抽出 → base.wav
  │
  ├─ [2] OpenAI Whisper で文字起こし（単語レベルのタイムスタンプ付き）
  │       ※ 音声が 24MB 超の場合は自動で 10 分ごとに分割して処理
  │
  ├─ [3] GPT で字幕テキストを整形（改行位置の最適化）
  │
  ├─ [4] scripts.json を生成（タイムライン ＋ テキスト）
  │
  ├─ [5] Remotion（React ベースの動画レンダラー）で jet.mp4 を書き出し
  │
  └─ [6] Remotion で script.mp4（字幕付き）を書き出し
```

処理時間の目安：**7〜15 分**（ほぼ API 待ち時間）

---

## セットアップ（Mac）

> **初回のみ** 必要な手順です。2回目以降はステップ7から始めてください。

---

### ステップ 0: Homebrew をインストール

Homebrew は Mac 用のパッケージマネージャーです。ffmpeg などのツールを簡単にインストールできます。

まずターミナルを開いてください。
`アプリケーション` → `ユーティリティ` → `ターミナル`

すでに Homebrew が入っているか確認：

```bash
brew --version
```

`Homebrew 4.x.x` のように表示されればスキップしてください。
`command not found` が出たらインストールします：

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

> インストール中にパスワードを聞かれたら、Mac にログインするときのパスワードを入力してください（入力中は何も表示されませんが正常です）。

**M1/M2/M3/M4 Mac（Apple Silicon）の場合**、インストール後に追加手順があります。表示される指示に従い、以下を実行してください：

```bash
echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
eval "$(/opt/homebrew/bin/brew shellenv)"
```

確認：

```bash
brew --version
```

`Homebrew 4.x.x` と表示されればOKです。

---

### ステップ 1: Node.js をインストール

```bash
brew install node@22
```

確認：

```bash
node -v
```

`v22.x.x` のように表示されればOKです。
`v18.x.x` 〜 `v22.x.x` の範囲であれば動作します。

> **注意**: `v17` 以下は動きません。`node -v` が古いバージョンを表示している場合はアップデートしてください。

---

### ステップ 2: ffmpeg をインストール

動画から音声を取り出すために必要です。

```bash
brew install ffmpeg
```

確認：

```bash
ffmpeg -version
```

`ffmpeg version 7.x.x` のように表示されればOKです。

> ffmpeg は大きなパッケージなのでインストールに数分かかることがあります。

---

### ステップ 3: Git をインストールしてリポジトリを取得

すでにフォルダがある場合はこのステップを飛ばしてください。

#### 3-1. Git をインストール

まず Git が入っているか確認します：

```bash
git --version
```

`git version 2.x.x` のように表示されればスキップしてください。
`command not found` が出た場合はインストールします：

```bash
brew install git
```

確認：

```bash
git --version
```

`git version 2.x.x` と表示されればOKです。

#### 3-2. リポジトリをクローン

```bash
git clone <リポジトリのURL>
cd jet-script
```

> `<リポジトリのURL>` は GitHub のリポジトリページで「Code」ボタンをクリックすると表示されます。

または、受け取った zip ファイルを展開して、ターミナルでそのフォルダに移動してください。

```bash
cd /Users/あなたのユーザー名/Desktop/jet-script
```

> Finder でフォルダを見つけて、ターミナルの入力欄にドラッグ＆ドロップするとパスが自動で入力されます。

---

### ステップ 4: パッケージをインストール（ルート）

```bash
npm install
```

`added XXX packages` と表示されればOKです。
赤い文字で `ERR!` が出た場合は [トラブルシューティング](#npm-install-でエラーが出る) を参照してください。

---

### ステップ 5: remotion のパッケージもインストール

動画レンダリングエンジン用に、別のパッケージインストールが必要です。

```bash
cd remotion && npm install && cd ..
```

`added XXX packages` と表示されてルートに戻ればOKです。

---

### ステップ 6: OpenAI API キーを取得して設定

#### 6-1. OpenAI アカウントを作成（すでにある場合はスキップ）

1. https://platform.openai.com/signup にアクセス
2. メールアドレスで登録するか、Google / Microsoft アカウントでサインイン
3. 電話番号認証を完了する

#### 6-2. 支払い方法を登録

API を使うには事前にクレジットカードの登録が必要です（従量課金）。

1. https://platform.openai.com/account/billing にアクセス
2. 「Add payment method」をクリック
3. クレジットカード情報を入力
4. 「Add credit balance」からチャージ金額を設定（最低 $5 から）

> **目安**: 30分の動画1本あたり $0.18〜0.25（約25〜35円）です。
> 初回は $5 チャージしておけばしばらく使えます。

#### 6-3. API キーを発行

1. https://platform.openai.com/api-keys にアクセス
2. 右上の「+ Create new secret key」をクリック
3. Name に分かりやすい名前を入力（例: `jet-script`）
4. 「Create secret key」をクリック
5. **画面に表示された `sk-proj-...` のキーをすぐコピーする**

> **重要**: このキーはこの画面を閉じると二度と確認できません。必ずコピーしてから閉じてください。

#### 6-4. 環境設定ファイルに API キーをセット

```bash
cp .env.example .env
open -e .env
```

テキストエディタが開いたら、`sk-your-api-key-here` の部分を貼り付けて保存します：

```
OPENAI_API_KEY=sk-proj-ここに貼り付ける
```

確認：

```bash
cat .env
```

`OPENAI_API_KEY=sk-proj-...` と表示されればOKです。

> **セキュリティ注意**: `.env` は `.gitignore` で除外済みなので Git にはコミットされません。他人に見せたり、チャット・Slack に貼ったりしないでください。キーが漏洩した場合は https://platform.openai.com/api-keys で即座に削除してください。

---

### ステップ 7: 元動画を配置

`base.mp4`（字幕をつけたい動画）を `jet-script` フォルダ直下に置いてください。

```
jet-script/
├── base.mp4   ← ここに置く
├── .env
├── package.json
└── ...
```

Finder から `jet-script` フォルダにドラッグ＆ドロップするのが一番簡単です。

---

### セットアップ完了チェック

以下のコマンドを実行して、全部 `OK` と出ればセットアップ完了です：

```bash
echo "=== チェック開始 ===" && \
node -v && echo "✅ Node.js OK" && \
ffmpeg -version 2>&1 | head -1 && echo "✅ ffmpeg OK" && \
ls base.mp4 && echo "✅ base.mp4 OK" && \
cat .env | grep OPENAI && echo "✅ .env OK" && \
ls node_modules > /dev/null && echo "✅ npm install (root) OK" && \
ls remotion/node_modules > /dev/null && echo "✅ npm install (remotion) OK" && \
echo "=== 全部OK！実行できます ==="
```

---

## 使い方

### 実行

```bash
npm run all
```

これだけです。あとは待つだけで `jet.mp4` と `script.mp4` が生成されます。

処理の進捗はターミナルに表示されます：

```
[1/3] 文字起こし中...（Whisper API）
[2/3] script.mp4 をレンダリング中...
[3/3] jet.mp4 をレンダリング中...
完了！
```

> Remotion の初回バンドル（Webpack のビルド）に1〜2分かかります。2回目以降は速くなります。

---

### 文字起こしのみ実行

文字起こし結果（`scripts.json`）だけ確認したいときは：

```bash
npm run transcribe
```

---

### 途中から再開

`npm run all` が途中で止まった場合、`scripts.json` が生成済みならそこから再開されます：

```bash
npm run all
```

文字起こしから最初からやり直したい場合は：

```bash
rm scripts.json
npm run all
```

---

### 最初からやり直す

```bash
rm -rf .tmp/ scripts.json script.mp4 jet.mp4
npm run all
```

---

### 複数の動画を結合してから処理する

`base1.mp4`, `base2.mp4` ... のように複数ファイルがある場合は、結合してから処理できます：

```bash
npm run base-video   # base1.mp4, base2.mp4 を結合して base.mp4 を生成
npm run all          # その後通常通り実行
```

---

## 生成されるファイル

| ファイル | 説明 | 削除してよいか |
|---------|------|--------------|
| `scripts.json` | 文字起こし結果 ＋ タイムライン情報。再実行時に使い回せる | 任意（削除で最初から） |
| `jet.mp4` | 無音部分カット済み動画 | 完成品 |
| `script.mp4` | 無音カット ＋ 字幕付き動画 | 完成品 |
| `.tmp/` | 処理中の一時ファイル（WAV, 分割音声など） | 自動削除される |

---

## トラブルシューティング

### brew: command not found

Homebrew がインストールされていないか、パスが通っていません。

**Intel Mac** の場合：
```bash
export PATH="/usr/local/bin:$PATH"
```

**Apple Silicon Mac (M1/M2/M3/M4)** の場合：
```bash
eval "$(/opt/homebrew/bin/brew shellenv)"
```

上記で `brew --version` が通ったら、`.zprofile` に追記して恒久的に設定：

```bash
# Intel Mac
echo 'export PATH="/usr/local/bin:$PATH"' >> ~/.zprofile

# Apple Silicon Mac
echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
```

その後ターミナルを再起動してください。

---

### node: command not found / Node.js のバージョンが古い

Homebrew でインストールした Node.js にパスが通っていない可能性があります。

```bash
brew link node@22
```

それでも動かない場合：

```bash
echo 'export PATH="/opt/homebrew/opt/node@22/bin:$PATH"' >> ~/.zprofile
source ~/.zprofile
node -v
```

---

### ffmpeg: command not found

```bash
brew install ffmpeg
```

インストール後も `command not found` が出る場合：

```bash
which ffmpeg
brew link ffmpeg
```

---

### npm install でエラーが出る

**Node.js のバージョンが古い場合**（v17 以下）:

```bash
brew upgrade node
node -v   # v18 以上を確認
npm install
```

**キャッシュが壊れている場合**:

```bash
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

**remotion の方のエラーの場合**:

```bash
cd remotion
rm -rf node_modules package-lock.json
npm install
cd ..
```

---

### .env ファイルが見つからない / APIキーのエラー

`.env` ファイルが存在するか確認：

```bash
ls -la .env
```

表示されない場合は作成：

```bash
cp .env.example .env
open -e .env
```

API キーが正しく設定されているか確認：

```bash
cat .env
```

`OPENAI_API_KEY=sk-proj-...` の形式で表示されればOKです。
`sk-your-api-key-here` のままになっていたら書き換えてください。

---

### OpenAI API のエラー（401 Unauthorized）

API キーが無効か間違っています。

1. https://platform.openai.com/api-keys で有効なキーを確認
2. `.env` のキーを更新
3. キーの前後に余分なスペースや改行が入っていないか確認

---

### OpenAI API のエラー（429 Rate limit / Quota exceeded）

支払い方法が登録されていないか、クレジットの残高が不足しています。

1. https://platform.openai.com/account/billing で支払い方法を確認
2. クレジットを追加

---

### base.mp4 が見つからないエラー

```bash
ls -lh base.mp4
```

ファイルが存在しない場合は、`jet-script` フォルダ直下に `base.mp4` を配置してください。
ファイル名が `Base.mp4` や `video.mp4` など異なる場合はリネームしてください（大文字小文字も区別されます）。

---

### 処理が途中で止まった / 固まった様子がある

まず Ctrl+C で停止してから再実行してください：

```bash
npm run all
```

`scripts.json` が生成済みであれば文字起こしはスキップされ、レンダリングから再開されます。
完全にやり直したい場合は：

```bash
rm -rf .tmp/ scripts.json script.mp4 jet.mp4
npm run all
```

---

### Whisper API のエラー（音声ファイルが大きすぎる）

音声が 25MB 超の場合でも自動で 10 分ごとに分割して処理します。エラーが出た場合は 3 回まで自動リトライされます。それでも失敗する場合は動画を短く分割してみてください。

---

### 字幕が文字化けしている / 表示されない

Remotion のレンダリングはシステムフォントを使います。日本語フォントが必要です。

Mac の場合は標準でヒラギノが入っているため通常は問題ありません。
もし文字化けする場合は、Noto Sans JP をインストールしてください：

```bash
brew install --cask font-noto-sans-cjk
```

---

### remotion 関連のエラー（"Cannot find module" など）

remotion ディレクトリの `node_modules` がインストールされていません：

```bash
cd remotion && npm install && cd ..
```

---

### レンダリングが異常に遅い

- Remotion は **CPU** でレンダリングします（GPU は使いません）
- 動画が長い・解像度が高い場合は時間がかかります
- 目安：30 分の動画で 10〜20 分程度
- 並列コア数はデフォルトで自動設定されます

---

### jet.mp4 や script.mp4 が生成されない

`scripts.json` の内容を確認してください：

```bash
cat scripts.json | head -50
```

`segments` が空の場合、動画に音声が含まれていないか、無音判定されています。
`scripts.json` を削除して最初からやり直してください：

```bash
rm scripts.json
npm run all
```

---

### scripts.json の JSON が壊れている

処理が途中で中断すると `scripts.json` が不完全な状態で残ることがあります。
削除して最初からやり直してください：

```bash
rm scripts.json
npm run all
```

---

### ディスクの空き容量不足

`jet.mp4` / `script.mp4` の生成には元の動画と同程度の空き容量が必要です。
また `.tmp/` に一時ファイルが展開されます（WAV は元動画の 5〜10 倍になることがあります）。

処理前に空き容量を確認：

```bash
df -h .
```

`Available` が十分あることを確認してください（最低でも 10GB 以上を推奨）。

---

## API コスト目安

このツールは OpenAI の以下の API を使用します（従量課金）。

| API | 用途 | 目安 |
|-----|------|------|
| Whisper API | 音声の文字起こし | $0.006 / 分 |
| GPT（字幕整形） | テキスト整形 | 微量（数十円以下） |

**例**: 30 分の動画の場合、Whisper だけで約 $0.18（≒ 25〜30 円）

> API キーが漏洩すると不正利用されます。`.env` ファイルは絶対に Git にコミットしないでください（`.gitignore` で除外済みです）。

---

## カスタマイズ（上級者向け）

### 無音カットのしきい値を変更

`scripts/video_transcribe.ts` の設定部分：

```typescript
const settings = {
  timeUnitSec: 0.1,        // タイムスタンプの精度（秒）
  mergeGapSec: 0.3,        // この秒数以下の間隔はつなぎ合わせる
  minSegmentDurationSec: 0.3, // この秒数より短いセグメントは無視
};

const marginBeforeSec = 0.5; // 発話前に追加するマージン（秒）
const marginAfterSec = 0.5;  // 発話後に追加するマージン（秒）
```

- `mergeGapSec` を大きくすると、短い間合いがつながります
- `marginBeforeSec` / `marginAfterSec` を調整すると、話し始め・話し終わりのタイミングが変わります

### 字幕スタイルを変更

`remotion/src/components/SubtitleLayer.tsx` を編集します：

```typescript
fontSize: 36,           // フォントサイズ（px）
color: 'white',         // 文字色
WebkitTextStroke: '2px black',  // 縁取りの色と太さ
```

### 字幕の最大文字数を変更

1行あたり全角換算で約 27 文字が画面に収まる設定になっています。
GPT への指示を変更する場合は `scripts/video_transcribe.ts` 内のプロンプトを編集してください。

---

## サポート

問題が解決しない場合は、以下のチェックリストを確認してからエラーメッセージを添えてご相談ください。

- [ ] Homebrew がインストールされている（`brew --version`）
- [ ] Node.js 18 以上がインストールされている（`node -v`）
- [ ] ffmpeg がインストールされている（`ffmpeg -version`）
- [ ] ルートで `npm install` を実行した
- [ ] `remotion/` ディレクトリでも `npm install` を実行した
- [ ] `.env` に正しい OPENAI_API_KEY が設定されている
- [ ] `base.mp4` がプロジェクトルートに置いてある
- [ ] OpenAI の支払い設定が完了している
- [ ] インターネットに接続されている
- [ ] ディスクの空き容量が十分ある（10GB 以上を推奨）
