# EnglishGo 英語學習平台 v1.1

📘 專為台灣學生設計的 AI 驅動英語學習平台 · 5,317 行精雕細琢的 React 應用程式

## ✨ 核心功能

- 🃏 **18 個學習模組**：SRS 單字卡、AI 故事、口說、6 個遊戲、寵物養成等
- 🐾 **像素寵物系統**：16 隻 × 4 階段，含真實叫聲、養成、成長、雲端同步
- 📖 **AI 故事模式**：寵物當主角，Gemini 生成客製故事 + 逐字朗讀高亮
- 🎤 **自然 TTS**：官方預製美式發音搭配 Multilingual v2，數字、日期與生活例句更清楚（手機也支援）
- 📚 **AI 例句修復**：自動偵測 placeholder 例句，用 AI 即時生成
- 🌟 **完整 PWA**：可裝到主畫面、離線使用、推播提醒
- ☕ **無廣告承諾**：100% 免費、無付費牆、無功能限制

## 🚀 本地開發

```bash
npm install
npm run dev
```

打開 http://localhost:5173

## 🏗️ 建構生產版本

```bash
npm run build
# 輸出在 dist/ 資料夾
```

## 🌐 Netlify 部署

推送到 GitHub → Netlify 會自動使用 `netlify.toml` 配置部署。

### 環境變數（在 Netlify 設定）

```
VITE_SUPABASE_URL=<你的 Supabase Project URL>
VITE_SUPABASE_ANON_KEY=<你的 anon key>
ELEVENLABS_API_KEY=<你的 ElevenLabs API key>
ELEVENLABS_ZH_VOICE_ID=<非小說動態中文朗讀聲線 ID（如有使用）>
ELEVENLABS_ZH_MODEL_ID=eleven_multilingual_v2
SUPABASE_SERVICE_ROLE_KEY=<你的 Supabase service_role key>
SUPABASE_TTS_BUCKET=tts-cache
```

> 注意：不要另外設定 `SUPABASE_URL`。此專案前端需要公開的 `VITE_SUPABASE_URL`，Netlify Secrets Scanning 可能會把相同值誤判為 `SUPABASE_URL` 外洩。

### 小說固定真人語音

建置時會由 `src/data/novels.js` 自動產生固定小說語音清單。小說中文固定使用 `fQj4gJSexpu8RDE2Ii5m`，目前中文資產版本為 `v2`，不受 Netlify 的 `ELEVENLABS_ZH_VOICE_ID` 設定影響。部署後可執行以下指令，分批建立全部英中旁白；進度會寫入本機狀態檔，若中斷可直接用相同指令續傳：

```bash
npm run prewarm:novel-audio
```

小說播放器只預載目前頁與下一頁，不會把近七千段音檔一次下載到手機。固定音檔由既有的私人 `tts-cache` bucket 保存，並透過版本化 GET 網址與 Netlify CDN 長效快取，因此不需要新增 Supabase SQL 或公開 Storage bucket。

## 📋 專案結構

```
englishgo-project/
├── public/
│   ├── icon-192.png           # PWA 圖示
│   ├── icon-512.png           # PWA 圖示
│   ├── manifest.json          # PWA 資訊清單
│   ├── sw.js                  # Service Worker (離線支援)
│   └── learn/                 # 英語學習與設定教學頁
├── src/
│   ├── App.jsx                # 主應用程式 (5,317 行)
│   └── main.jsx               # 進入點 (註冊 SW)
├── index.html                 # HTML 模板
├── package.json               # 依賴
├── vite.config.js             # Vite 設定
├── netlify.toml               # Netlify 部署設定
└── README.md                  # 這個檔案
```

## 🧪 測試 PWA

部署後（Netlify HTTPS）：
1. **Chrome/Edge**：網址列右側會出現安裝按鈕
2. **iPhone Safari**：分享 → 加入主畫面
3. **離線測試**：DevTools → Application → 勾 Offline，重新整理

## 📦 Supabase 資料表

`pet_users` 表（寵物雲端同步用）：
```sql
CREATE TABLE pet_users (
  id BIGSERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  pin_hash TEXT NOT NULL,
  pets JSONB DEFAULT '[]'::jsonb,
  eggs JSONB DEFAULT '[]'::jsonb,
  inventory JSONB DEFAULT '{}'::jsonb,
  coins INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

## 📝 待辦事項

部署前請完成：
- [ ] Netlify 環境變數設定 Supabase keys
- [ ] 執行 fix-examples.js 批次優化單字例句
