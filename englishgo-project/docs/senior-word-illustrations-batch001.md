# 高中單字圖片與例句：第 001 批

2026-10-25 已完成 100 字、100 張獨立情境圖，以及 100 組英文例句、繁中翻譯和圖片描述。依既有國中插畫的暖色 3D 風格，用內建 image_gen 逐張生成。全批皆屬大考中心第 4 級，依 word_bank 的 ceec_level、id 排序，從 abolish 到 multiple。

## 圖片與提示詞

- 最終檔案：`public/images/vocabulary/senior/<word>-01-v1.webp`，均為 768 × 768 WebP；合計 8,374,586 bytes，單張最大 161,402 bytes。
- [完整提示詞、來源、檔案路徑與雜湊](senior-word-illustrations-generation-batch001.json)。原始 PNG 保留於紀錄中的生成路徑，最終 WebP 已存入專案。
- 離線插畫目錄：src/data/wordIllustrations.json；高中備援字庫：src/data/seniorIllustrationWords.json，經 extraWords.js 合併且保留原有詞形、搭配詞。
- 同步既有本地 6 字的主要例句：comprehensive、phenomenon、sophisticated、unprecedented、sustainable、facilitate。

## 雲端發布

100 張圖片已上傳至 Supabase Storage 的 word-illustrations/senior/，並逐張重新下載核對 WebP 類型與 SHA-256。100 筆 word_illustrations 與 word_bank 的英、中例句完全一致，匿名查詢可讀取 100 筆。匯入端點已關閉，實測回應 HTTP 410，臨時憑證已移除。

資料種子：supabase/seed_senior_word_illustrations_20261025_batch001.sql。雲端內容已可由既有正式網站讀取；本地備援檔案與程式內容可隨下一次正常網站部署發布。本批未另行部署整個工作目錄。

## 驗證

- 全套 82 個測試檔、886 項測試通過（npm test -- --maxWorkers=2 --testTimeout=15000）；最後本地例句修訂後，相關 89 項測試亦通過。
- npm run build、git diff --check 通過。
- 1440、390、320 px，五個詞共 15 組實際雲端圖片檢查通過；英中字幕存在、圖片解碼正常、沒有水平溢出或非預期 console/page 錯誤。本地視覺測試對未由 Vite 提供的 TTS 端點使用測試音訊，未驗證發音品質。
- 390、320 px 的字幕可捲動至完整可見，未被評分按鈕遮住；主要例句與插畫例句一致。
- 正式網站 1440 px abolish、390 px sophisticated：雲端圖片與雙語字幕載入正常，沒有水平溢出或 page runtime 錯誤。

## 接續進度

高中原有 2,838 字缺圖，本批完成 100 字，剩餘 **2,738 字**：第 4 級 47 字、第 5 級 2,603 字、第 6 級 88 字。後續請重新查詢缺圖清單，避免重複生成；排序維持 ceec_level、id。
