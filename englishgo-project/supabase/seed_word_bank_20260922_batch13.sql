-- Existing local vocabulary missing from the cloud; preserve existing rows.
INSERT INTO public.word_bank (word,pos,meaning,level,example,example_zh,category) VALUES
('towel', 'n.', '毛巾', 'elementary', 'A blue towel hangs on the rail.', '一條藍色毛巾掛在橫桿上。', 'Home'),
('lamp', 'n.', '檯燈', 'elementary', 'The yellow lamp shines on the desk.', '這盞黃色檯燈照亮書桌。', 'Home'),
('sofa', 'n.', '沙發', 'elementary', 'The green sofa has soft cushions.', '這張綠色沙發有柔軟的坐墊。', 'Home'),
('refrigerator', 'n.', '冰箱', 'elementary', 'Milk and vegetables stay cool in the refrigerator.', '牛奶和蔬菜在冰箱裡保持冰涼。', 'Home'),
('television', 'n.', '電視', 'elementary', 'The television shows green hills.', '電視上顯示綠色山丘。', 'Home'),
('wall', 'n.', '牆壁', 'elementary', 'Red bricks form a strong wall.', '紅磚砌成一道堅固的牆。', 'Home')
ON CONFLICT (word,level) DO NOTHING;
