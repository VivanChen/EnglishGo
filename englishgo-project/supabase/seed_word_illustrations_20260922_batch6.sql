-- Elementary watercolor illustrations, batch 6. Upload assets before metadata.
BEGIN;
INSERT INTO public.word_bank (word,level,pos,meaning,example,example_zh,category) VALUES
('grape', 'elementary', 'n.', '葡萄', 'The grapes are purple.', '這些葡萄是紫色的。', 'Food'),
('watermelon', 'elementary', 'n.', '西瓜', 'The watermelon is red inside.', '西瓜裡面是紅色的。', 'Food'),
('strawberry', 'elementary', 'n.', '草莓', 'The strawberry has tiny seeds.', '這顆草莓有小小的籽。', 'Food'),
('lemon', 'elementary', 'n.', '檸檬', 'The lemon is yellow.', '這顆檸檬是黃色的。', 'Food'),
('peach', 'elementary', 'n.', '水蜜桃', 'The peach has soft, fuzzy skin.', '水蜜桃的果皮有柔軟的細絨毛。', 'Food'),
('ice cream', 'elementary', 'n.', '冰淇淋', 'The ice cream is in a cone.', '冰淇淋裝在甜筒裡。', 'Food')
ON CONFLICT (word, level) DO NOTHING;

INSERT INTO public.word_illustrations (id, level, word, sort_order, sense, alt_zh, example, example_zh, image_url, local_path, style, version) VALUES
('elementary-grape-01-v1', 'elementary', 'grape', 1, '葡萄', '一串紫色葡萄連著短短的果梗，旁邊有一片綠葉。', 'The grapes are purple.', '這些葡萄是紫色的。', 'https://jbspxqebcrkilfcddluo.supabase.co/storage/v1/object/public/word-illustrations/elementary/grape-01-v1.webp', '/images/vocabulary/elementary/grape-01-v1.webp', 'watercolor-pencil-v1', 1),
('elementary-watermelon-01-v1', 'elementary', 'watermelon', 1, '西瓜', '一顆有綠色條紋的西瓜，前面放著一片露出紅色果肉和黑色籽的西瓜。', 'The watermelon is red inside.', '西瓜裡面是紅色的。', 'https://jbspxqebcrkilfcddluo.supabase.co/storage/v1/object/public/word-illustrations/elementary/watermelon-01-v1.webp', '/images/vocabulary/elementary/watermelon-01-v1.webp', 'watercolor-pencil-v1', 1),
('elementary-strawberry-01-v1', 'elementary', 'strawberry', 1, '草莓', '一顆成熟的紅草莓，表面有小小的黃色籽，頂端有綠葉。', 'The strawberry has tiny seeds.', '這顆草莓有小小的籽。', 'https://jbspxqebcrkilfcddluo.supabase.co/storage/v1/object/public/word-illustrations/elementary/strawberry-01-v1.webp', '/images/vocabulary/elementary/strawberry-01-v1.webp', 'watercolor-pencil-v1', 1),
('elementary-lemon-01-v1', 'elementary', 'lemon', 1, '檸檬', '一顆黃色檸檬帶著綠葉，旁邊放著切開的半顆檸檬。', 'The lemon is yellow.', '這顆檸檬是黃色的。', 'https://jbspxqebcrkilfcddluo.supabase.co/storage/v1/object/public/word-illustrations/elementary/lemon-01-v1.webp', '/images/vocabulary/elementary/lemon-01-v1.webp', 'watercolor-pencil-v1', 1),
('elementary-peach-01-v1', 'elementary', 'peach', 1, '水蜜桃', '一顆粉紅與淡黃色的水蜜桃，表面有細絨毛，頂端連著一片綠葉。', 'The peach has soft, fuzzy skin.', '水蜜桃的果皮有柔軟的細絨毛。', 'https://jbspxqebcrkilfcddluo.supabase.co/storage/v1/object/public/word-illustrations/elementary/peach-01-v1.webp', '/images/vocabulary/elementary/peach-01-v1.webp', 'watercolor-pencil-v1', 1),
('elementary-ice-cream-01-v1', 'elementary', 'ice cream', 1, '冰淇淋', '一支金黃色格紋甜筒上放著一球粉紅色冰淇淋。', 'The ice cream is in a cone.', '冰淇淋裝在甜筒裡。', 'https://jbspxqebcrkilfcddluo.supabase.co/storage/v1/object/public/word-illustrations/elementary/ice-cream-01-v1.webp', '/images/vocabulary/elementary/ice-cream-01-v1.webp', 'watercolor-pencil-v1', 1),
('elementary-pizza-01-v1', 'elementary', 'pizza', 1, '披薩', '白色小盤子上放著一片三角形披薩，上面有融化的起司和紅色番茄醬。', 'There is cheese on the pizza.', '披薩上有起司。', 'https://jbspxqebcrkilfcddluo.supabase.co/storage/v1/object/public/word-illustrations/elementary/pizza-01-v1.webp', '/images/vocabulary/elementary/pizza-01-v1.webp', 'watercolor-pencil-v1', 1),
('elementary-hamburger-01-v1', 'elementary', 'hamburger', 1, '漢堡', '白色盤子上放著一個漢堡，芝麻麵包中夾著肉排、綠色生菜和紅色番茄片。', 'The hamburger has lettuce and tomato.', '這個漢堡裡有生菜和番茄。', 'https://jbspxqebcrkilfcddluo.supabase.co/storage/v1/object/public/word-illustrations/elementary/hamburger-01-v1.webp', '/images/vocabulary/elementary/hamburger-01-v1.webp', 'watercolor-pencil-v1', 1),
('elementary-candy-01-v1', 'elementary', 'candy', 1, '糖果', '三顆糖果分別包著紅色、黃色和藍色糖果紙，兩端扭成小結。', 'The candy is wrapped in colorful paper.', '糖果包著彩色的糖果紙。', 'https://jbspxqebcrkilfcddluo.supabase.co/storage/v1/object/public/word-illustrations/elementary/candy-01-v1.webp', '/images/vocabulary/elementary/candy-01-v1.webp', 'watercolor-pencil-v1', 1),
('elementary-noodles-01-v1', 'elementary', 'noodles', 1, '麵', '淺藍色碗裡裝著長長的黃色麵條和少許蔥花，旁邊放著一雙木筷子。', 'The noodles are in a blue bowl.', '麵條裝在藍色碗裡。', 'https://jbspxqebcrkilfcddluo.supabase.co/storage/v1/object/public/word-illustrations/elementary/noodles-01-v1.webp', '/images/vocabulary/elementary/noodles-01-v1.webp', 'watercolor-pencil-v1', 1)
ON CONFLICT (id) DO NOTHING;
COMMIT;

