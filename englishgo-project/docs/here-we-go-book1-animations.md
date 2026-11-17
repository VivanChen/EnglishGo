# Here We Go! 第一冊插畫動畫

範圍是目前第一冊收錄的 102 個字詞（含人名、發音例字和節慶字）。
正面與單字預覽保留原有水彩插畫，翻開後播放網站提供的對應 GIF。
每次重新整理頁面後，每個 GIF 自動播放三遍（共 7.68 秒），播完切回原圖。
同一頁內翻回再翻開不會自動重播；按「播放動畫」可手動再播三遍。
動畫可以暫停；裝置要求減少動態效果時，先顯示原圖，按「播放動畫」才開始。
GIF 載入失敗會回到原圖，例句、評分與字典仍可使用。

## 產生方式

`scripts/generateHereWeGoGifs.py` 是既有 ImageGen CLI 的專案批次包裝程式。
第二版將原圖排成 4 × 4 的模板，透過 `gpt-image-2` 高品質圖片編輯，
重新產生完整動作循環的 16 個連續姿勢（2048 × 2048 的來源圖）。
`scripts/hereWeGoAnimationEncoding.py` 校正輕微鏡頭位移、固定靜止背景，
使用 RIFE 4.6 神經網路補間與雙向時間平均，補出中間影格及遮擋區域，包含末格到首格的銜接。
整段使用相同 256 色調色盤，避免逐格換色造成閃爍。
最後以 Gifsicle 做差異影格壓縮，輸出 64 影格、25 fps、每遍 2.56 秒、384 × 384 的 GIF，共播放三遍。
動作按正向循環設計，不再把六張姿勢倒放，也不靠重複影格或單純淡化增加格數。
每個字詞的動作在 `scripts/data/hereWeGoBook1Motions.json`，包含保留物件數量、
原角色、畫風及例句語意的要求。不是將靜態圖片改副檔名，也不是只做平移縮放。

本流程沿用已安裝的 ImageGen CLI 與既有模型；來源姿勢生成和本機編碼分開快取，
調整補間或壓縮時可以直接重編碼，不必再次呼叫 API。
補間工具與模型：https://github.com/nihui/rife-ncnn-vulkan

## 執行

需要 Python、Pillow、NumPy、OpenCV、OpenAI Python SDK，以及已安裝的 ImageGen 技能 CLI。
可用 `python -m pip install -r scripts/requirements-here-we-go-gifs.txt` 安裝 Python 套件。
另從 RIFE 官方 releases 安裝 `rife-ncnn-vulkan`（附 `rife-v4.6` 模型），
以及支援 `--lossy` 的 Gifsicle。用 `RIFE_CLI`、`GIFSICLE_CLI` 環境變數，
或 `--rife-cli`、`--gifsicle-cli` 指定執行檔；RIFE 模型放在執行檔旁。
此工作區的工具放在已排除 Git 的第二版快取 `tools/`。
工具缺失會在呼叫圖片 API 前停止，不會改用低品質補間。
腳本沿用環境或專案 `.env.local` 的 `OPENAI_API_KEY`，不顯示或寫出金鑰。
金鑰只供產生動畫教材時使用，播放這些 GIF 不會呼叫 OpenAI，也不需要填入 Key。

```powershell
# 不呼叫 API，只查看範圍
npm run generate:here-we-go-gifs -- --dry-run

# 先試作指定字詞；只寫入本機預覽，不改網站素材
npm run generate:here-we-go-gifs -- --words dog one book --preview

# 完整第一冊；中斷後重跑會跳過已完成且有效的素材
npm run generate:here-we-go-gifs -- --preview --concurrency 4

# 預覽完成並檢查後，發布到本機網站素材（不呼叫 API、不重新編碼）
npm run generate:here-we-go-gifs -- --publish-preview

# 不呼叫 API，檢查 102 個 GIF 的影格、雜湊及原圖
npm run verify:here-we-go-gifs

# 只用已產生的影格重新壓縮，不呼叫 API
npm run generate:here-we-go-gifs -- --pack-only

# 單獨重做指定字詞（會再次呼叫 API）
npm run generate:here-we-go-gifs -- --words dog --force

# 編碼與防呆測試，不呼叫 API
python -m unittest discover -s scripts -p test_generateHereWeGoGifs.py
```

ImageGen CLI 預設位置是 `$CODEX_HOME/skills/.system/imagegen/scripts/image_gen.py`，
或使用者家目錄下的 `.codex/skills/.system/imagegen/scripts/image_gen.py`。
其他位置可用 `--image-cli` 指定，不會修改技能本身。

## 檔案

- 網頁使用的 GIF：`public/images/vocabulary/here-we-go-book-1-gifs/`。
- 已完成的教材目錄：`src/data/hanlinHereWeGoBook1Animations.json`。
- 動作與提示詞來源：`scripts/data/hereWeGoBook1Motions.json`。
- 可重用的 AI 影格、完整提示詞與來源資訊：`output/imagegen/here-we-go-book-1-v2/`，已排除 Git。
- 試作 GIF 與目錄：上述快取中的 `previews/` 和 `preview-catalog.json`。

## 儲存與發布

完成的 102 個 GIF 與教材目錄會一起提交至 GitHub；Netlify 建置時將
`public` 內容放進 `dist`，正式網站從自己的 `/images/` 路徑提供檔案。
這批 GIF 沒有上傳 Supabase Storage，也不存進資料庫資料表。

動態產生的朗讀音檔使用另一套流程：後端會讀寫 Supabase Storage 的
`tts-cache` bucket（可由 `SUPABASE_TTS_BUCKET` 設定），並有瀏覽器快取。
因此這批 GIF 的發布方式與動態朗讀音檔的雲端快取不同。
原始 AI 影格與產生快取仍留在本機；GitHub 會保留網站實際使用的 GIF、
腳本、動作提示詞和教材目錄。

目錄只在 GIF 成功編碼、確認有 64 個影格與有效動作後更新；另記錄逐格差異與循環接點差異，供人工挑出異常素材。
原圖雜湊、GIF 雜湊、
模型、提示詞及編碼設定用來判斷能否續跑。API 權限或額度失敗會停止新增工作，
保留已完成素材；不會換模型，也不會填入假的動畫。第二冊起不附動畫路徑。
