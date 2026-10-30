# 高中單字圖片與例句：第 004 批

2026-10-26 完成 humanitarian 到 exempt 共 100 字。每字以內建 image_gen 獨立生成暖色 3D 情境圖，附完整英文例句、繁中翻譯與圖片描述；最終 768 × 768 WebP 合計 9,031,618 bytes。

## 雲端發布與驗證

100 張已上傳 Supabase Storage 的 word-illustrations/senior/，逐張重新下載確認 WebP 尺寸及 SHA-256。word_illustrations 與 word_bank 的詞義、雙語例句全部一致，匿名 API 可讀。前 300 字完整保留。匯入端點已關閉並確認 HTTP 410，臨時憑證已移除。資料寫入前比對原值，避免覆蓋並行修改。

[提示詞、原圖來源、雜湊與回收紀錄](senior-word-illustrations-generation-batch004.json)。資料種子：supabase/seed_senior_word_illustrations_20261026_batch004.sql。本地插畫目錄與高中備援字庫已同步；雲端內容已供正式網站讀取，本批未部署整個工作目錄。

## 驗證與清理

- 82 個測試檔、886 項測試通過；建置與 git diff --check 通過。高中主題測試保留既有最低覆蓋量，容許字庫持續新增。
- humanitarian、ironic、boom、covert、exempt，在 1440、390、320 px 共 15 組畫面通過，雲端圖片正常解碼、雙語字幕可見，沒有水平溢出或 console/page 錯誤。
- 正式網站 1440 px humanitarian、390 px exempt 通過。純 Vite 的 TTS 使用測試音訊，未驗證發音品質。
- 100 張原始 PNG、100 張專案 WebP、100 張建置副本與 26 張檢查圖片已移至資源回收筒，合計 326 檔、290,665,118 bytes；原路徑均無留存。清空回收筒後才會釋放空間。

## 接續進度

高中已完成 **400／2,838 字**，尚有 **2,438 字**缺圖。第 005 批從 exert 開始；應依最新雲端缺圖清單接續，直至缺圖數為 0。
