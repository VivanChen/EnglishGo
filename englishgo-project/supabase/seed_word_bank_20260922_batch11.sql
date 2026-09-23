-- Existing local elementary words missing from cloud; preserve existing rows.
INSERT INTO public.word_bank (word, pos, meaning, level, example, example_zh, category) VALUES
('goat', 'n.', '山羊', 'elementary', 'The goat has short horns and a little beard.', '這隻山羊有短角和小鬍鬚。', 'Animals'),
('kangaroo', 'n.', '袋鼠', 'elementary', 'The kangaroo has strong back legs for jumping.', '袋鼠有強壯的後腿，可以用來跳躍。', 'Animals'),
('koala', 'n.', '無尾熊', 'elementary', 'The koala holds on to the tree trunk.', '這隻無尾熊抱著樹幹。', 'Animals'),
('panda', 'n.', '貓熊', 'elementary', 'The panda holds a green bamboo stalk.', '這隻貓熊拿著一根綠色竹子。', 'Animals'),
('truck', 'n.', '卡車', 'elementary', 'The blue truck carries boxes to the store.', '這輛藍色卡車載箱子到商店。', 'Transportation'),
('ship', 'n.', '輪船', 'elementary', 'The large ship sails across the sea.', '這艘大輪船航行在海上。', 'Transportation')
ON CONFLICT (word, level) DO NOTHING;
