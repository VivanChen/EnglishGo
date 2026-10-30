# 高中單字圖片與例句：第 003 批

2026-10-26 完成 100 個高中單字、100 張獨立情境圖，以及 100 組英文例句、繁中翻譯與圖片描述。依最新缺圖清單的 ceec_level、id 排序，從 aspire 到 hostile，全部屬大考中心第 5 級。以內建 image_gen 逐張生成，延續暖色 3D 風格。

## 雲端內容

100 張 768 × 768 WebP 已上傳至 Supabase Storage 的 word-illustrations/senior/；合計 8,680,110 bytes。每張重新下載，核對 WebP 類型與 SHA-256，全部一致。100 筆 word_illustrations 與 word_bank 的詞義及雙語例句一致，匿名 API 可完整讀取。前兩批 200 筆均已確認保留。匯入端點已關閉，實測 HTTP 410，臨時憑證已移除。

[完整提示詞、例句、來源、上傳雜湊與清理紀錄](senior-word-illustrations-generation-batch003.json)。資料種子：supabase/seed_senior_word_illustrations_20261025_batch003.sql，寫入前檢查原例句與詞義，避免覆蓋並行修改。

## 本地資料與清理

插畫目錄與高中備援字庫已追加本批 100 字。與主題字庫重疊的 curriculum、ecosystem、emission、extinction 仍保留既有詞形、搭配詞與主題；合併後高中 EXTRA_WORDS 共 411 個不同單字。補充 7 字的情境相關詞義。

本批 100 張原始 PNG、100 張專案 WebP、100 張建置副本與 19 張檢查截圖已移至資源回收筒，原路徑均無留存；清空資源回收筒後才會釋放磁碟空間。清理在上傳、雜湊與 API 核對及畫面檢查完成後執行。僅保留文字內容、提示詞、種子與驗證紀錄，圖片由雲端 URL 提供。本批未另行部署整個工作目錄；正式網站已可讀取雲端內容，本地備援資料可隨後續正常部署發布。

## 驗證

- 82 個測試檔、886 項測試通過；正式建置與 git diff --check 通過。
- 1440、390、320 px，aspire、blunt、compound、ecosystem、hostile 共 15 組畫面：實際雲端圖片正確解碼，雙語字幕存在，無水平溢出或非預期 console/page 錯誤。
- 正式網站 1440 px aspire、390 px hostile 皆載入正確圖片與雙語例句，無水平溢出或 page runtime 錯誤。
- 本地 Vite 的 TTS 端點使用測試音訊；本次未驗證發音品質。

## 接續進度

高中已完成 **300 字**，剩餘 **2538 字**缺圖。下一批請重新查詢缺圖清單，依 ceec_level、id 排序，避免重複生成。
