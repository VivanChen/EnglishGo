# 高中單字圖片與例句：第 002 批

2026-10-25 已完成新增 100 字、100 張獨立情境圖，以及 100 組完整英文例句、繁中翻譯和圖片描述。沿用暖色 3D 風格，以內建 image_gen 逐張 text-to-image 生成，從 necessity 到 applaud。此批包含第 4 級最後 47 字與第 5 級前 53 字。

## 圖片與提示詞

- 最終檔案：public/images/vocabulary/senior/<word>-01-v1.webp，均為 768 × 768 WebP；合計 9,202,074 bytes，單張最大 186,996 bytes。
- [完整提示詞、生成模式、原始檔路徑、最終路徑與 SHA-256](senior-word-illustrations-generation-batch002.json)。原始 PNG 保留於紀錄中的路徑。
- manner 首次生成含不需要的角落圖示，已重生並重新檢查；原圖路徑保留在 superseded_source_paths。
- 插畫目錄追加至 src/data/wordIllustrations.json，高中備援字庫追加至 src/data/seniorIllustrationWords.json；兩批共 200 字均保留。
- 更新 alleviate、deteriorate、ambiguous 的本地主要例句。補齊 necessity、panel、renew、mechanism、accessible 的相關詞義，與圖片和例句一致。
- 新增 100 字與既有主題字庫有 approximately 一字重疊；合併後高中 EXTRA_WORDS 為 315 個不同單字，保留原有詞形與搭配詞。

## 雲端發布

100 張圖片已發布至 Supabase Storage 的 word-illustrations/senior/，每張重新下載核對 WebP 類型與 SHA-256。100 筆 word_illustrations 與 word_bank 的雙語例句及本次補充詞義一致；匿名 API 可正確讀取 100 筆。本批暫時匯入端點已關閉，實測 HTTP 410，臨時憑證已移除。

資料種子：supabase/seed_senior_word_illustrations_20261025_batch002.sql。寫入前比對原例句、翻譯與詞義，避免覆蓋同時發生的修改。正式網站已可讀取雲端內容；本地備援與主要例句調整可隨下一次正常網站部署發布。本批未另行部署整個工作目錄。

## 驗證

- npm test -- --maxWorkers=2 --testTimeout=15000：82 個測試檔、886 項測試全部通過。
- npm run build 與 git diff --check 通過。
- 1440、390、320 px，necessity、manner、ambiguous、deteriorate、applaud 共 15 組實際雲端圖片檢查通過：雙語字幕、圖片解碼與尺寸正常，沒有水平溢出或非預期 console/page 錯誤。
- 390、320 px 的 ambiguous 主卡與插畫例句一致，字幕可完整捲動至評分列上方。
- 正式網站 1440 px necessity、390 px applaud 均載入正確雲端圖片與雙語字幕，沒有水平溢出或 page runtime 錯誤。
- 本地視覺測試對純 Vite 未提供的 TTS 端點使用測試音訊，未驗證發音品質。

## 接續進度

高中 2,838 字已完成 **200 字**，尚有 **2,638 字**缺圖。第 4 級 147 字已全部完成；第 5 級完成 53／2,603 字，剩 2,550 字；第 6 級剩 88 字。下一批應重新查詢缺圖清單，依 ceec_level、id 排序，避免重複生成。
