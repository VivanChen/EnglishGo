-- Elementary watercolor illustrations, batch 8. Upload assets before metadata.
BEGIN;
INSERT INTO public.word_bank (word,level,pos,meaning,example,example_zh,category) VALUES
('fork', 'elementary', 'n.', '叉子', 'The fork has four tines.', '叉子有四個叉齒。', 'Food'),
('chopsticks', 'elementary', 'n.', '筷子', 'These chopsticks are made of wood.', '這雙筷子是木製的。', 'Food'),
('pumpkin', 'elementary', 'n.', '南瓜', 'The pumpkin is round and orange.', '南瓜又圓又橘。', 'Food')
ON CONFLICT (word, level) DO NOTHING;

INSERT INTO public.word_illustrations (id, level, word, sort_order, sense, alt_zh, example, example_zh, image_url, local_path, style, version) VALUES
('elementary-cup-01-v1', 'elementary', 'cup', 1, '杯子', '一個有弧形把手的淺藍色陶瓷杯，杯口敞開，裡面是空的。', 'The blue cup has a handle.', '藍色杯子有一個把手。', 'https://jbspxqebcrkilfcddluo.supabase.co/storage/v1/object/public/word-illustrations/elementary/cup-01-v1.webp', '/images/vocabulary/elementary/cup-01-v1.webp', 'watercolor-pencil-v1', 1),
('elementary-glass-01-v1', 'elementary', 'glass', 1, '玻璃杯', '一個透明玻璃杯裡裝著半杯水，可以看見杯壁和水面。', 'There is water in the glass.', '玻璃杯裡有水。', 'https://jbspxqebcrkilfcddluo.supabase.co/storage/v1/object/public/word-illustrations/elementary/glass-01-v1.webp', '/images/vocabulary/elementary/glass-01-v1.webp', 'watercolor-pencil-v1', 1),
('elementary-bowl-01-v1', 'elementary', 'bowl', 1, '碗', '一個空的淺藍色陶瓷碗，從斜上方可以看見碗口和碗內。', 'The blue bowl is empty.', '藍色的碗是空的。', 'https://jbspxqebcrkilfcddluo.supabase.co/storage/v1/object/public/word-illustrations/elementary/bowl-01-v1.webp', '/images/vocabulary/elementary/bowl-01-v1.webp', 'watercolor-pencil-v1', 1),
('elementary-bottle-01-v1', 'elementary', 'bottle', 1, '瓶子', '一個裝著水的透明瓶子，上面蓋著藍色瓶蓋。', 'The bottle has a blue cap.', '瓶子有一個藍色瓶蓋。', 'https://jbspxqebcrkilfcddluo.supabase.co/storage/v1/object/public/word-illustrations/elementary/bottle-01-v1.webp', '/images/vocabulary/elementary/bottle-01-v1.webp', 'watercolor-pencil-v1', 1),
('elementary-spoon-01-v1', 'elementary', 'spoon', 1, '湯匙', '一支銀色湯匙斜放著，有橢圓形凹面和長長的握柄。', 'This spoon has a long handle.', '這支湯匙有長長的握柄。', 'https://jbspxqebcrkilfcddluo.supabase.co/storage/v1/object/public/word-illustrations/elementary/spoon-01-v1.webp', '/images/vocabulary/elementary/spoon-01-v1.webp', 'watercolor-pencil-v1', 1),
('elementary-fork-01-v1', 'elementary', 'fork', 1, '叉子', '一支銀色叉子斜放著，前端有四個清楚分開的叉齒。', 'The fork has four tines.', '叉子有四個叉齒。', 'https://jbspxqebcrkilfcddluo.supabase.co/storage/v1/object/public/word-illustrations/elementary/fork-01-v1.webp', '/images/vocabulary/elementary/fork-01-v1.webp', 'watercolor-pencil-v1', 1),
('elementary-knife-01-v1', 'elementary', 'knife', 1, '刀', '一把圓頭餐刀斜放著，有銀色刀片和淺褐色木柄。', 'The knife has a wooden handle.', '這把刀有木製握柄。', 'https://jbspxqebcrkilfcddluo.supabase.co/storage/v1/object/public/word-illustrations/elementary/knife-01-v1.webp', '/images/vocabulary/elementary/knife-01-v1.webp', 'watercolor-pencil-v1', 1),
('elementary-chopsticks-01-v1', 'elementary', 'chopsticks', 1, '筷子', '一雙淺褐色木筷平行斜放著，兩支筷子分開，末端逐漸變細。', 'These chopsticks are made of wood.', '這雙筷子是木製的。', 'https://jbspxqebcrkilfcddluo.supabase.co/storage/v1/object/public/word-illustrations/elementary/chopsticks-01-v1.webp', '/images/vocabulary/elementary/chopsticks-01-v1.webp', 'watercolor-pencil-v1', 1),
('elementary-pumpkin-01-v1', 'elementary', 'pumpkin', 1, '南瓜', '一顆完整的橘色南瓜，表面有深深的縱向紋路，上面有彎曲的短梗。', 'The pumpkin is round and orange.', '南瓜又圓又橘。', 'https://jbspxqebcrkilfcddluo.supabase.co/storage/v1/object/public/word-illustrations/elementary/pumpkin-01-v1.webp', '/images/vocabulary/elementary/pumpkin-01-v1.webp', 'watercolor-pencil-v1', 1),
('elementary-chocolate-01-v1', 'elementary', 'chocolate', 1, '巧克力', '一條分成方格的褐色巧克力，旁邊放著兩小塊巧克力。', 'Two pieces of chocolate are next to the bar.', '巧克力條旁邊有兩小塊巧克力。', 'https://jbspxqebcrkilfcddluo.supabase.co/storage/v1/object/public/word-illustrations/elementary/chocolate-01-v1.webp', '/images/vocabulary/elementary/chocolate-01-v1.webp', 'watercolor-pencil-v1', 1)
ON CONFLICT (id) DO NOTHING;
COMMIT;
