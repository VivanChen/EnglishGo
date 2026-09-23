-- Elementary watercolor illustrations, batch 7. Upload assets before metadata.
BEGIN;
INSERT INTO public.word_bank (word,level,pos,meaning,example,example_zh,category) VALUES
('guava', 'elementary', 'n.', '芭樂', 'The guava has white flesh inside.', '芭樂裡面有白色的果肉。', 'Food'),
('papaya', 'elementary', 'n.', '木瓜', 'The papaya has black seeds.', '木瓜有黑色的籽。', 'Food'),
('pineapple', 'elementary', 'n.', '鳳梨', 'The pineapple has long green leaves.', '鳳梨有長長的綠葉。', 'Food'),
('kiwi', 'elementary', 'n.', '奇異果', 'The kiwi is green inside.', '奇異果裡面是綠色的。', 'Food'),
('mango', 'elementary', 'n.', '芒果', 'The mango has yellow flesh.', '芒果有黃色的果肉。', 'Food'),
('popcorn', 'elementary', 'n.', '爆米花', 'The popcorn is in a red box.', '爆米花裝在紅色盒子裡。', 'Food'),
('hot dog', 'elementary', 'n.', '熱狗', 'The hot dog is in a long bun.', '熱狗夾在長麵包裡。', 'Food')
ON CONFLICT (word, level) DO NOTHING;

INSERT INTO public.word_illustrations (id, level, word, sort_order, sense, alt_zh, example, example_zh, image_url, local_path, style, version) VALUES
('elementary-guava-01-v1', 'elementary', 'guava', 1, '芭樂', '一顆淡綠色芭樂，旁邊放著半顆露出白色果肉和中央小籽的芭樂。', 'The guava has white flesh inside.', '芭樂裡面有白色的果肉。', 'https://jbspxqebcrkilfcddluo.supabase.co/storage/v1/object/public/word-illustrations/elementary/guava-01-v1.webp', '/images/vocabulary/elementary/guava-01-v1.webp', 'watercolor-pencil-v1', 1),
('elementary-papaya-01-v1', 'elementary', 'papaya', 1, '木瓜', '一顆金黃色木瓜，旁邊放著縱向切開的半顆木瓜，露出橘色果肉和黑色籽。', 'The papaya has black seeds.', '木瓜有黑色的籽。', 'https://jbspxqebcrkilfcddluo.supabase.co/storage/v1/object/public/word-illustrations/elementary/papaya-01-v1.webp', '/images/vocabulary/elementary/papaya-01-v1.webp', 'watercolor-pencil-v1', 1),
('elementary-pineapple-01-v1', 'elementary', 'pineapple', 1, '鳳梨', '一顆金黃色鳳梨直立著，外皮有菱形紋路，頂端長著尖尖的綠葉。', 'The pineapple has long green leaves.', '鳳梨有長長的綠葉。', 'https://jbspxqebcrkilfcddluo.supabase.co/storage/v1/object/public/word-illustrations/elementary/pineapple-01-v1.webp', '/images/vocabulary/elementary/pineapple-01-v1.webp', 'watercolor-pencil-v1', 1),
('elementary-kiwi-01-v1', 'elementary', 'kiwi', 1, '奇異果', '一顆有褐色絨毛外皮的奇異果，旁邊放著半顆露出綠色果肉和黑色小籽的奇異果。', 'The kiwi is green inside.', '奇異果裡面是綠色的。', 'https://jbspxqebcrkilfcddluo.supabase.co/storage/v1/object/public/word-illustrations/elementary/kiwi-01-v1.webp', '/images/vocabulary/elementary/kiwi-01-v1.webp', 'watercolor-pencil-v1', 1),
('elementary-mango-01-v1', 'elementary', 'mango', 1, '芒果', '一顆紅黃相間的芒果，旁邊放著切成方格的金黃色芒果果肉。', 'The mango has yellow flesh.', '芒果有黃色的果肉。', 'https://jbspxqebcrkilfcddluo.supabase.co/storage/v1/object/public/word-illustrations/elementary/mango-01-v1.webp', '/images/vocabulary/elementary/mango-01-v1.webp', 'watercolor-pencil-v1', 1),
('elementary-cheese-01-v1', 'elementary', 'cheese', 1, '起司', '一塊有圓孔的淡黃色三角形起司，旁邊放著一片薄薄的起司。', 'This cheese has round holes.', '這塊起司有圓圓的孔。', 'https://jbspxqebcrkilfcddluo.supabase.co/storage/v1/object/public/word-illustrations/elementary/cheese-01-v1.webp', '/images/vocabulary/elementary/cheese-01-v1.webp', 'watercolor-pencil-v1', 1),
('elementary-butter-01-v1', 'elementary', 'butter', 1, '奶油', '白色小碟子上放著一塊淡黃色長方形奶油，上面疊著一片切下來的奶油。', 'The butter is on a white dish.', '奶油放在白色小碟子上。', 'https://jbspxqebcrkilfcddluo.supabase.co/storage/v1/object/public/word-illustrations/elementary/butter-01-v1.webp', '/images/vocabulary/elementary/butter-01-v1.webp', 'watercolor-pencil-v1', 1),
('elementary-popcorn-01-v1', 'elementary', 'popcorn', 1, '爆米花', '一個紅色紙盒裡裝滿白色和淡金黃色爆米花，旁邊散落幾顆爆米花。', 'The popcorn is in a red box.', '爆米花裝在紅色盒子裡。', 'https://jbspxqebcrkilfcddluo.supabase.co/storage/v1/object/public/word-illustrations/elementary/popcorn-01-v1.webp', '/images/vocabulary/elementary/popcorn-01-v1.webp', 'watercolor-pencil-v1', 1),
('elementary-hot-dog-01-v1', 'elementary', 'hot dog', 1, '熱狗', '白色盤子上放著一份熱狗，長麵包裡夾著香腸，上面淋著黃色芥末醬。', 'The hot dog is in a long bun.', '熱狗夾在長麵包裡。', 'https://jbspxqebcrkilfcddluo.supabase.co/storage/v1/object/public/word-illustrations/elementary/hot-dog-01-v1.webp', '/images/vocabulary/elementary/hot-dog-01-v1.webp', 'watercolor-pencil-v1', 1),
('elementary-salad-01-v1', 'elementary', 'salad', 1, '沙拉', '淺藍色碗裡裝著由綠色生菜、紅色小番茄和小黃瓜片組成的沙拉。', 'The salad has tomatoes and cucumbers.', '沙拉裡有番茄和小黃瓜。', 'https://jbspxqebcrkilfcddluo.supabase.co/storage/v1/object/public/word-illustrations/elementary/salad-01-v1.webp', '/images/vocabulary/elementary/salad-01-v1.webp', 'watercolor-pencil-v1', 1)
ON CONFLICT (id) DO NOTHING;
COMMIT;

