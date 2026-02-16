# 📹 video-edit

hashshnet動画編集ツール - 動画から自動で字幕付き動画を生成します

---

## 🎯 使い方

### 1. ヘルプを見る
```bash
npm run help
```

初回準備の手順が表示されます

### 2. 実行する
```bash
npm run all
```

これだけ！

---

## 📖 詳しい手順

### 初回準備（最初だけ）

#### 1️⃣ パッケージをインストール
```bash
cd video-edit
npm install
```

#### 2️⃣ OpenAI APIキーを設定

`.env` ファイルを作成：
```bash
cp .env.example .env
```

`.env` ファイルを開いて、APIキーを記入：
```
OPENAI_API_KEY=sk-your-actual-api-key
```

> 💡 APIキーは https://platform.openai.com/api-keys で取得できます

#### 3️⃣ 元動画を配置

`base.mp4` をこのディレクトリに置く

---

### 実行

```bash
npm run all
```

自動で以下が実行されます：
1. 文字起こし（`base.mp4` → `scripts.json`）
2. script.mp4 生成
3. jet.mp4 生成

**所要時間**: 約7〜11分

---

## 📁 生成されるファイル

| ファイル | 説明 |
|---------|------|
| `scripts.json` | 文字起こし結果とタイムライン |
| `script.mp4` | 字幕付き動画（script版） |
| `jet.mp4` | 字幕付き動画（jet版） |

---

## ❓ トラブルシューティング

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

---

## ⚙️ カスタマイズ（上級者向け）

### カット間の間隔を変更

`scripts/video_transcribe.ts` の221行目：
```typescript
let intervalToNext = 1.0; // ← この数値を変更（単位：秒）
```

### 字幕スタイルを変更

- `prompt/SHORT_VIDEO_RULES.md` - ショート動画用
- `prompt/LONG_VIDEO_RULES.md` - ロング動画用

---

## 📞 サポート

問題が解決しない場合は、以下を確認してください：

- [ ] Node.js 18以上がインストールされている
- [ ] `npm install` を実行した
- [ ] `.env` にAPIキーが設定されている
- [ ] `base.mp4` が配置されている
- [ ] インターネットに接続されている

それでも解決しない場合は、エラーメッセージを添えてご相談ください。
