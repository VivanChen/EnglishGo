# EnglishGo 英語學習平台

## 📱 PWA 部署說明

本專案已設定為 **Progressive Web App (PWA)**，使用者可以：
- ✅ 安裝到手機主畫面
- ✅ 離線使用（已快取的內容）
- ✅ 像原生 App 一樣全螢幕執行
- ✅ 自動偵測網路狀態

## 🚀 本地開發

```bash
cd englishgo-project
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

推送到 GitHub → Netlify 自動使用 `netlify.toml` 配置：
- `npm run build` 建構
- 發佈 `dist/` 資料夾
- SPA fallback 已設定
- Service Worker 不會被快取（總是最新）

## ⚠️ 重要環境變數

在 Netlify 設定中加入：

```
VITE_SUPABASE_URL=https://jbspxqebqcrkilfcddluo.supabase.co
VITE_SUPABASE_ANON_KEY=<你的 anon key>
```

## 📋 專案結構

```
englishgo-project/
├── public/
│   ├── icon-192.png       # PWA 圖示 (192x192)
│   ├── icon-512.png       # PWA 圖示 (512x512)
│   ├── manifest.json      # PWA 資訊清單
│   └── sw.js              # Service Worker (離線支援)
├── src/
│   ├── App.jsx            # 主應用程式
│   └── main.jsx           # 進入點（註冊 SW）
├── index.html             # HTML 模板
├── package.json           # 依賴套件
├── vite.config.js         # Vite 設定
└── netlify.toml           # Netlify 部署設定
```

## 🧪 測試 PWA 功能

1. **安裝提示**：部署到 HTTPS 網址（Netlify 自動有 HTTPS）後，Chrome/Edge 會顯示安裝按鈕
2. **離線測試**：
   - Chrome DevTools → Application → Service Workers
   - 勾選 "Offline"，重新整理頁面
   - 應該仍能看到已快取的內容

## 🔄 更新 PWA 版本

修改 `public/sw.js` 中的 `CACHE_VERSION`：

```javascript
const CACHE_VERSION = 'englishgo-v1.0.1';  // 改版號
```

使用者下次打開時會自動收到新版本通知。

## 📦 Supabase 資料表

請先執行 `supabase_pet_users.sql` 建立 `pet_users` 資料表（寵物雲端同步用）。
