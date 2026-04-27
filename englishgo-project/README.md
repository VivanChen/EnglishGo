# EnglishGo 英語學習平台 v1.1

📘 專為台灣學生設計的 AI 驅動英語學習平台 · 5,317 行精雕細琢的 React 應用程式

## ✨ 核心功能

- 🃏 **18 個學習模組**：SRS 單字卡、AI 故事、口說、6 個遊戲、寵物養成等
- 🐾 **像素寵物系統**：16 隻 × 4 階段，含真實叫聲、養成、成長、雲端同步
- 📖 **AI 故事模式**：寵物當主角，Gemini 生成客製故事 + 逐字朗讀高亮
- 🎤 **智慧 TTS**：自動挑選最好聽的神經聲音，跟字朗讀（手機也支援）
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
VITE_SUPABASE_URL=https://jbspxqebcrkilfcddluo.supabase.co
VITE_SUPABASE_ANON_KEY=<你的 anon key>
```

## 📋 專案結構

```
englishgo-project/
├── public/
│   ├── icon-192.png           # PWA 圖示
│   ├── icon-512.png           # PWA 圖示
│   ├── manifest.json          # PWA 資訊清單
│   ├── sw.js                  # Service Worker (離線支援)
│   └── learn/
│       └── sponsor.html       # 支持頁面 (請填入收款資訊)
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
- [ ] 編輯 `public/learn/sponsor.html` 填入：
  - LINE Pay QR Code
  - 街口 QR Code
  - 銀行帳號（玉山/中信...）
  - Email 聯絡方式
  - LINE ID
  - Buy Me a Coffee 連結
- [ ] Netlify 環境變數設定 Supabase keys
- [ ] 執行 fix-examples.js 批次優化單字例句
