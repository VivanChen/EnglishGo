# EnglishGo 英語學習平台 v1.1

📘 專為台灣學生設計的 AI 驅動英語學習平台 · 5,317 行精雕細琢的 React 應用程式

## ✨ 核心功能

- 🃏 **18 個學習模組**：SRS 單字卡、AI 故事、口說、6 個遊戲、寵物養成等
- 🐾 **海風小鎮**：三隻原創 3D 夥伴、自由照顧、24 件家具、九章分級英文探索與版本化存檔；詳見 [功能與部署說明](docs/pet-town.md)
- 📖 **AI 故事模式**：寵物當主角，Gemini 生成客製故事 + 逐字朗讀高亮
- 🎤 **自然發音**：可選擇 ElevenLabs、OpenAI 或裝置語音；保留原本 ElevenLabs 預設，支援聲音、語速設定與手機播放
- 📚 **AI 例句修復**：自動偵測 placeholder 例句，用 AI 即時生成
- 🌟 **完整 PWA**：可裝到主畫面、離線使用、推播提醒
- ☕ **無廣告承諾**：100% 免費、無付費牆、無功能限制

## 🚀 本地開發

```bash
npm install
npm run dev
```

打開 http://localhost:5173

本地 Vite 伺服器會處理 `/.netlify/functions/openai-tts`，從已確認的 `.env.local` 讀取伺服器端 `OPENAI_API_KEY`。金鑰不會送到前端；請勿使用 `VITE_OPENAI_API_KEY`。OpenAI 尚未設定金鑰時回傳 503，正常播放會切換到裝置語音。金鑰建立可稍後完成，原有 ElevenLabs 選項不受影響。

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
OPENAI_API_KEY=<OpenAI 專案金鑰，僅 Functions scope>
ELEVENLABS_API_KEY=<你的 ElevenLabs API key>
ELEVENLABS_ZH_VOICE_ID=<非小說動態中文朗讀聲線 ID（如有使用）>
ELEVENLABS_ZH_MODEL_ID=eleven_multilingual_v2
SUPABASE_SERVICE_ROLE_KEY=<你的 Supabase service_role key>
SUPABASE_TTS_BUCKET=tts-cache
```

> 注意：不要另外設定 `SUPABASE_URL`。此專案前端需要公開的 `VITE_SUPABASE_URL`，Netlify Secrets Scanning 可能會把相同值誤判為 `SUPABASE_URL` 外洩。

### OpenAI 單字與例句發音

在「設定 → 朗讀設定 → 發音服務」選擇 **ElevenLabs（原本）／OpenAI／裝置語音**。預設維持 ElevenLabs，切換後會記住選擇，並各自保留兩個服務的聲音偏好。裝置模式不呼叫動態發音 API。

選擇 OpenAI 時，Netlify Function 使用 Realtime API 的 `gpt-realtime-2.1-mini` 生成 WAV，支援 marin、cedar、coral 與 0.7–1.2 倍語速。依官方公告，舊版 `/audio/speech` TTS 模型將於 2027-01-06 停用，因此新入口使用 Realtime API。參考：[OpenAI 語音文件](https://developers.openai.com/api/docs/guides/text-to-speech)。

音訊依文字、語言、聲音、速度與模型版本分開快取；有設定既有 Supabase Storage 時，存入 `tts-cache` 的 `openai/` 路徑（bucket 須允許 `audio/wav`）。播放器保留取消、重產與裝置語音備援。生成逐字稿與原文不符時拒絕播放及快取，避免把額外回答當成教材。金鑰、額度或模型權限尚未就緒時，仍可使用裝置發音。

### 沿用既有音檔儲存

兩種雲端服務共用原本的 `tts-cache` bucket，保留所有舊檔案與路徑：

| 音訊 | 儲存方式 |
| --- | --- |
| ElevenLabs | 原本的 `<voiceId>/<hash>.mp3`，不改雜湊算法 |
| OpenAI | `openai/<朗讀版本>/<模型>/<聲音>/<hash>.wav`，與舊音檔分開 |
| 小說、童書 | 保留既有版本網址與錄製音檔 |

動態單字與例句的預載只讀已存音檔，缺少時不自動付費生成；實際播放時才補產。快取命中時，即使供應商金鑰暫時未設定，也能讀取已存聲音。已設定 Storage 但讀取失敗或音檔損壞時，使用裝置語音備援，避免把儲存故障誤認成缺檔而反覆生成。手動「重產」可補產並覆寫指定音檔，連按會共用同一筆生成請求。

OpenAI 的伺服器記憶體快取保留最多 60 秒，之後重新查詢 Storage，減少其他裝置重產後仍持續拿到舊檔的情況。瀏覽器仍有最多 128 筆／24 MiB 的記憶體快取；重新整理後由伺服器讀取共用的 Storage 音檔。

2026-10-30 唯讀檢查確認現有 bucket 為公開讀取，未限制 MIME 類型，已有 10,482 個 MP3（約 284 MiB）。本次沿用既有權限，無須建立新 bucket 或搬移音檔。實際 OpenAI 生成與 WAV 上傳仍需在金鑰設定後驗證。

Netlify 的 `OPENAI_API_KEY` 必須包含 **Functions** scope，更新後需重新部署才能生效。字典仍採裝置語音；既有小說與童書固定音檔維持原網址，`ELEVENLABS_API_KEY` 用於既有小說音檔的補產。設定頁與首頁標示語音由 AI 生成。

### 小說固定旁白語音

建置時會由 `src/data/novels.js` 自動產生固定小說語音清單。小說中文固定使用 `fQj4gJSexpu8RDE2Ii5m`，目前中文資產版本為 `v2`，不受 Netlify 的 `ELEVENLABS_ZH_VOICE_ID` 設定影響。部署後可執行以下指令，分批建立全部英中旁白；進度會寫入本機狀態檔，若中斷可直接用相同指令續傳：

```bash
npm run prewarm:novel-audio
```

小說播放器只預載目前頁與下一頁，不會把近七千段音檔一次下載到手機。固定音檔由既有的 `tts-cache` bucket 保存，並透過版本化 GET 網址與 Netlify CDN 長效快取，因此不需要新增 Supabase SQL 或調整 Storage bucket 權限。

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

寵物雲端同步使用既有 `pet_users` 表與服務端 `pet-account` API。新版資料結構、增量 SQL、服務端金鑰和權限切換順序，請依 [海風小鎮雲端上線流程](docs/pet-town.md#雲端上線順序) 執行；不要再開放前端直接讀寫帳號表。

## 📝 待辦事項

部署前請完成：
- [ ] Netlify 環境變數設定 Supabase keys
- [ ] 執行 fix-examples.js 批次優化單字例句
