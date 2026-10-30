# 海風小鎮（寵物系統 v2）

海風小鎮取代原有寵物家園、扭蛋、遠征、遊樂園與大富翁。主流程為「免費領養 → 自由照顧 → 英文故事出遊 → 佈置小家 → 邀請新夥伴」。依使用者要求，這次版本的寵物、金幣與學習紀錄全部重新開始，不備份或匯入舊進度。

啟動前以 `seabreeze-20261030` 標記執行一次本機重置，清除各帳號的小鎮、單字複習、成就、閱讀及練習紀錄。保留登入憑證、API 設定與操作偏好。之後的重新載入不會重複重置，新進度照常儲存。雲端帳號在第一次通過驗證後，也會以相同版本標記原子重置舊寵物與錢包；舊版本的儲存請求無法把舊進度寫回。

## 已實作的體驗

- 三位原創夥伴：港邊貓凪凪 Nagi、陽光犬晴晴 Haru、花園兔小麥 Mugi。各有不同外型、比例、步態及 11 組動畫。成長經驗 0／120／300 對應幼年、少年、成年。
- 可旋轉、縮放的 3D 海邊家園，支援點地面走路、日夜切換、聚焦夥伴、家具避障；低畫質、減少動態與 WebGL 不可用時的替代畫面。
- 餵食、洗澡、玩耍、休息與摸摸皆免費。多步驟照顧完成才結算，取消不發獎；沒有照顧答題門檻，也沒有飢餓死亡懲罰。
- 港灣、果園、星光山丘三區共九章故事；國小、國中、高中各有獨立英文敘述與題目，共 54 題。中文提示、朗讀、錯題重試與中途續玩皆可使用。
- 24 件家具分成三套，可預覽位置與旋轉、確認或取消放置。邊界、碰撞與主要通道均有檢查。
- 首次完成第三章與第六章後，分別可邀請第二、第三隻夥伴。沒有抽卡或隨機稀有度。
- 首次通章給予固定家具、寵物 XP 40、親密 8、全站學習 XP 15 與金幣 5；重玩每章每天最多一次寵物 XP 10，不重發金幣或永久家具。照顧不產生金幣。章節金幣與通章紀錄一起結算，避免兩台裝置離線完成後合併時重複領取。
- 單字複習使用實際評分事件；繪本導讀使用實際答題完成事件。被動開頁、播放及內嵌頁面訊息不當作完成學習。外部學習的寵物陪伴獎勵每天上限五次。
- 本機自動儲存、帳號隔離、登出回本機、雲端版本衝突處理與可重試同步。離線操作重新套用到雲端版本；同一儲存請求重試使用相同識別碼，避免重複結算。

## 開發與檔案

```powershell
npm run dev -- --host 127.0.0.1 --port 5198
# http://127.0.0.1:5198/?view=pets&lv=elementary
npm test -- --maxWorkers=2
npm run build
node scripts/qa-pet-town.mjs
```

瀏覽器巡檢預設使用本機 Edge 與 Codex runtime 的 Playwright；其他環境可設定 `PLAYWRIGHT_MODULE` 為 Playwright 模組的絕對路徑，`QA_URL` 為開發站網址。`QA_WIDTHS=1440,390,360` 可指定測試寬度。結果與畫面保存在 `.superpowers/qa/pet-town/`，測試使用獨立瀏覽器儲存空間並阻擋實際 Supabase 呼叫。

| 檔案 | 用途 |
| --- | --- |
| `src/features/pet-town/PetTown.jsx`、`pet-town.css` | 小鎮頁面、照顧、故事、佈置、帳號設定 |
| `worldData.js`、`worldState.js` | 角色、家具、中英故事與可測試的狀態／獎勵規則 |
| `TownScene.jsx`、`townModels.js`、`townNavigation.js` | Three.js 場景、角色、動畫、尋路 |
| `townStorage.js`、`useTownWorld.js`、`cloudAccount.js` | 本機保存、操作重播、同步 |
| `src/data/progressReset.js` | 全站進度的一次性版本重置 |
| `townAmbience.js` | 使用者開啟後播放的本地合成海浪音 |
| `netlify/functions/pet-account.mjs` | 憑證驗證、資料驗證及版本化儲存 API |

角色模型來源與可重建方式見 [模型說明](../public/models/pet-town/README.md)。執行 `node scripts/generateTownModels.mjs` 可重建三個 GLB。模型使用階層關節動畫，不是毛髮模擬或蒙皮角色。

## 雲端上線順序

本次原始碼包含部署所需的 API 與 SQL，沒有自動變更正式資料庫。未部署 API 的環境仍可完整使用本機模式，雲端連線錯誤會顯示並保留本機進度。

1. 套用 `supabase/migrations/20261029162431_pet_town_v2_account_api.sql`，新增版本化存檔與服務端 RPC。這份 SQL 不建立舊寵物備份；帳號首次登入或讀取新版時會直接重置舊寵物、背包和金幣。
2. 在 Netlify 設定 `SUPABASE_URL`（或既有 `VITE_SUPABASE_URL`）及僅服務端可用的 `SUPABASE_SERVICE_ROLE_KEY`。服務金鑰不得使用 `VITE_` 前綴或放入前端。
3. 同時部署新版前端與 `pet-account` function。以專用測試帳號確認註冊、登入、儲存、重試與版本衝突。
4. 執行 `supabase/manual/pet-town-v2-cutover.sql`，撤銷 `pet_users` 的 public／anon／authenticated 直接讀寫權限。舊客戶端此後必須重新載入。
5. 驗證匿名使用者不能讀寫帳號表、不能呼叫服務端 RPC，新 API 仍可正常儲存。

先套用 SQL 再部署新版 API，避免舊進度被帶回。API 會拒絕缺少這次進度版本的儲存內容；若資料庫仍回傳舊版本，API 回報暫時不可用並保留新的本機進度。

SQL 可以先在隔離的 PGlite 中驗證，避免對正式帳號進行試驗。將 `PGLITE_MODULE` 指向已安裝的 `@electric-sql/pglite/dist/index.js` 後執行 `node scripts/verifyPetTownDatabase.mjs`。

## 驗證範圍

自動測試涵蓋成長、照顧、三階段領養、章節與重玩結算、家具限制、學習事件去重、一次性重置、同步重試、衝突重播、端點與 SQL 權限。真實瀏覽器巡檢涵蓋 1440／390／360px、九章全流程、三隻領養、購買佈置、重載、溢出與 JavaScript 錯誤。

3D 額外檢查模型切換與反覆建立場景的資源釋放、照顧取消、日夜切換及 WebGL context loss。桌面 headless 瀏覽器測量不代表實體手機幀率；手機硬體效能仍需上線前以目標裝置確認。
