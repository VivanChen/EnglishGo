# EnglishGo 建置部署完整指南

專為台灣學生設計的 AI 英語學習平台  
技術架構：React 18 + Vite → Netlify ｜ Supabase (Auth + DB) ｜ Gemini API (免費)

---

## 目錄

1. 前置準備
2. 第一階段：建立本地專案
3. 第二階段：Supabase 設定
4. 第三階段：Gemini API 設定
5. 第四階段：GitHub 連動
6. 第五階段：Netlify 部署
7. 第六階段：Supabase Edge Function 部署
8. 日常開發流程
9. 專案檔案結構說明
10. 疑難排解

---

## 1. 前置準備

在開始之前，請確認你已經有以下工具和帳號：

### 必要工具
- **Node.js** v18+ → https://nodejs.org （建議用 LTS 版）
- **Git** → https://git-scm.com
- **VS Code** → https://code.visualstudio.com （或任何編輯器）

### 必要帳號（全部免費）
- **GitHub** → https://github.com
- **Netlify** → https://netlify.com （用 GitHub 帳號登入即可）
- **Supabase** → https://supabase.com （用 GitHub 帳號登入即可）
- **Google 帳號** → 用於取得 Gemini API Key

### 確認工具版本
```bash
node --version    # 應顯示 v18.x.x 以上
npm --version     # 應顯示 9.x.x 以上
git --version     # 應顯示 git version 2.x.x
```

---

## 2. 第一階段：建立本地專案

### 2-1. 解壓縮專案包

將下載的 `englishgo-project.zip` 解壓縮到你想要的位置：

```bash
cd ~/Desktop          # 或任何你想放的位置
unzip englishgo-project.zip
cd englishgo-project
```

### 2-2. 安裝依賴套件

```bash
npm install
```

這會根據 `package.json` 安裝所有必要套件，包括：
- `react` / `react-dom` — UI 框架
- `@supabase/supabase-js` — Supabase 客戶端
- `vite` / `@vitejs/plugin-react` — 建置工具

### 2-3. 建立環境變數檔案

```bash
cp .env.example .env
```

打開 `.env` 檔案，目前先留空，後面步驟會填入。

### 2-4. 本地測試啟動

```bash
npm run dev
```

瀏覽器打開 `http://localhost:5173` 應該可以看到 EnglishGo 首頁。
（此時 Supabase 和 AI 功能尚未連接，但單字卡、測驗等離線功能可以正常使用）

---

## 3. 第二階段：Supabase 設定

### 3-1. 建立 Supabase 專案

1. 到 https://supabase.com 登入
2. 點 **New Project**
3. 設定：
   - **Project name**：`englishgo`
   - **Database Password**：設一個強密碼（記下來）
   - **Region**：選 `Northeast Asia (Tokyo)` 離台灣最近
4. 等待約 2 分鐘，專案建立完成

### 3-2. 取得連線資訊

在 Supabase Dashboard 左側選 **Project Settings** > **API**：

- 複製 **Project URL**（形如 `https://xxxxx.supabase.co`）
- 複製 **anon public key**（很長的一串 JWT token）

把這兩個值填入你的 `.env` 檔案：

```env
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...（你的 anon key）
```

### 3-3. 建立資料表

1. 在 Supabase Dashboard 左側選 **SQL Editor**
2. 點 **New query**
3. 打開專案包裡的 `supabase/schema.sql`，複製全部內容貼上
4. 點 **Run** 執行

這會建立以下資料表：
- `profiles` — 使用者資料
- `vocabulary` — 自訂單字庫
- `flashcard_progress` — SRS 學習進度
- `quiz_history` — 測驗紀錄
- `daily_goals` — 每日學習目標
- `ai_chat_history` — AI 對話紀錄

同時也會設定 Row Level Security (RLS)，確保每個使用者只能存取自己的資料。

### 3-4. 設定 Auth（登入方式）

在 Dashboard 左側選 **Authentication** > **Providers**：

- **Email** — 預設已啟用
- **Google**（選配）— 點開設定 OAuth Client ID 和 Secret
  - 到 https://console.cloud.google.com 建立 OAuth 2.0 憑證
  - 授權重新導向 URI 填：`https://xxxxx.supabase.co/auth/v1/callback`

---

## 4. 第三階段：Gemini API 設定

### 4-1. 取得免費 API Key

1. 到 https://aistudio.google.com
2. 用 Google 帳號登入
3. 點左邊 **Get API key**
4. 點 **Create API key**
5. 複製產生的 API Key

**免費方案額度：**
- 每天約 1,000 次請求
- 每分鐘 15 次請求
- 不需要信用卡
- 使用 Gemini 2.5 Flash 模型

### 4-2. 本地開發用

把 API Key 填入 `.env`：

```env
VITE_GEMINI_API_KEY=AIzaSy...（你的 Gemini API Key）
```

### 4-3. 正式部署用（Supabase Edge Function）

正式上線時，**不要把 API Key 放在前端**。我們會在第六階段把它放進 Supabase Edge Function。

---

## 5. 第四階段：GitHub 連動

### 5-1. 在 GitHub 建立 Repository

1. 到 https://github.com/new
2. **Repository name**：`englishgo`
3. 選 **Private**（私人）或 **Public**（公開）
4. **不要**勾選 README 和 .gitignore（專案包裡已有）
5. 點 **Create repository**

### 5-2. 推送專案到 GitHub

在專案資料夾中執行：

```bash
git init
git add .
git commit -m "feat: EnglishGo 初始版本 — SRS 單字卡 + 文法 + 閱讀 + AI 家教"
git branch -M main
git remote add origin https://github.com/你的帳號/englishgo.git
git push -u origin main
```

> 如果是第一次用 Git，需要先設定：
> ```bash
> git config --global user.name "你的名字"
> git config --global user.email "你的email"
> ```

---

## 6. 第五階段：Netlify 部署

### 6-1. 連結 GitHub Repository

1. 到 https://app.netlify.com
2. 點 **Add new site** > **Import an existing project**
3. 選 **GitHub** > 授權存取
4. 選擇 `englishgo` repository

### 6-2. 建置設定

Netlify 應該會自動偵測到 `netlify.toml`，確認以下設定：

- **Build command**：`npm run build`
- **Publish directory**：`dist`

### 6-3. 設定環境變數

在 Netlify Dashboard > **Site configuration** > **Environment variables**：

| Key | Value |
|-----|-------|
| `VITE_SUPABASE_URL` | `https://xxxxx.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | 你的 Supabase anon key |

點 **Deploy site** 開始部署。

### 6-4. 自訂網域（選配）

部署完成後，Netlify 會給你一個 `xxxxx.netlify.app` 的網址。
如果你有自己的網域，可以在 **Domain management** 設定。

---

## 7. 第六階段：Supabase Edge Function 部署

這是讓 Gemini API Key 安全地存在伺服器端的關鍵步驟。

### 7-1. 安裝 Supabase CLI

```bash
npm install -g supabase
```

### 7-2. 登入並連結專案

```bash
supabase login
supabase link --project-ref 你的-project-ref
```

> `project-ref` 在 Supabase Dashboard > Project Settings > General 可以找到

### 7-3. 設定 API Key 為 Secret

```bash
supabase secrets set GEMINI_API_KEY=AIzaSy...你的Key
```

### 7-4. 部署 Edge Function

```bash
supabase functions deploy gemini-proxy
```

### 7-5. 修改前端呼叫方式

部署完成後，前端 AI 家教改為呼叫你的 Edge Function：

```
https://xxxxx.supabase.co/functions/v1/gemini-proxy
```

而不是直接呼叫 Google API。這樣 API Key 就不會暴露在前端了。

---

## 8. 日常開發流程

當你修改程式碼後：

```bash
# 1. 本地測試
npm run dev

# 2. 確認沒問題後，提交到 GitHub
git add .
git commit -m "feat: 新增XXX功能"
git push

# 3. Netlify 自動部署
# 推送到 GitHub 後，Netlify 會自動偵測並重新部署
# 大約 1-2 分鐘就會上線
```

---

## 9. 專案檔案結構說明

```
englishgo-project/
├── index.html                  # HTML 入口
├── package.json                # 依賴套件設定
├── vite.config.js              # Vite 建置設定
├── netlify.toml                # Netlify 部署設定
├── .env.example                # 環境變數範本
├── .gitignore                  # Git 忽略清單
├── public/
│   └── favicon.svg             # 網站圖標
├── src/
│   ├── main.jsx                # React 進入點
│   └── App.jsx                 # 主應用程式（所有功能）
└── supabase/
    ├── schema.sql              # 資料庫建表 SQL
    └── functions/
        └── gemini-proxy/
            └── index.ts        # Gemini API 代理 Edge Function
```

### 各檔案用途

| 檔案 | 用途 |
|------|------|
| `src/App.jsx` | 整個 App 的核心，包含所有頁面和功能 |
| `supabase/schema.sql` | 在 Supabase SQL Editor 執行一次即可 |
| `supabase/functions/gemini-proxy/index.ts` | 部署到 Supabase 做 API 代理 |
| `netlify.toml` | 告訴 Netlify 如何建置和處理路由 |
| `.env` | 本地開發的環境變數（不會上傳到 GitHub） |

---

## 10. 疑難排解

### Q: npm install 報錯
```bash
# 清除快取重試
rm -rf node_modules package-lock.json
npm install
```

### Q: Netlify 部署失敗
- 檢查 Netlify 的 Deploy log 看錯誤訊息
- 確認 Build command 是 `npm run build`
- 確認環境變數有設定正確

### Q: Supabase 連線失敗
- 確認 `.env` 中的 URL 和 Key 正確
- 確認 Supabase 專案狀態是 Active（免費版閒置 7 天會暫停）
- 到 Dashboard 按 **Restore project** 重新啟動

### Q: Gemini API 回傳錯誤
- 確認 API Key 有效（到 AI Studio 測試）
- 免費方案有速率限制：每分鐘 15 次，每天 1,000 次
- 如果超過限制，等幾分鐘再試

### Q: CSV 匯入後中文亂碼
- 用記事本打開 CSV
- 另存新檔 → 編碼選「使用 BOM 的 UTF-8」
- 重新匯入

### Q: 手機上字太小
- App 已做響應式設計，但如果需要調整
- 修改 `index.html` 的 viewport：`initial-scale=1.0`

---

## 快速啟動 Checklist

- [ ] 安裝 Node.js、Git
- [ ] 註冊 GitHub、Netlify、Supabase、Google 帳號
- [ ] 解壓縮專案，執行 `npm install`
- [ ] 建立 Supabase 專案，取得 URL 和 Key
- [ ] 在 SQL Editor 執行 `schema.sql`
- [ ] 取得 Gemini API Key（aistudio.google.com）
- [ ] 填寫 `.env` 檔案
- [ ] `npm run dev` 本地測試
- [ ] 推送到 GitHub
- [ ] Netlify 連結 GitHub 並設定環境變數
- [ ] 部署 Supabase Edge Function
- [ ] 完成！開始學英文 🎉
