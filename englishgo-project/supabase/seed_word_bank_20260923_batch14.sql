-- Batch 14: locally available words missing from the cloud word bank; preserve existing rows.
INSERT INTO public.word_bank (word, pos, meaning, level, example, example_zh, category) VALUES
('tooth', 'n.', '牙齒', 'elementary', 'My loose tooth falls out after dinner.', '我的鬆動牙齒在晚餐後掉了。', 'Body'),
('neck', 'n.', '脖子', 'elementary', 'Wear a scarf around your neck on a cold morning.', '寒冷的早晨把圍巾圍在脖子上。', 'Body'),
('shoulder', 'n.', '肩膀', 'elementary', 'The school bag feels heavy on my shoulder.', '書包背在肩膀上感覺很重。', 'Body'),
('stomach', 'n.', '胃；肚子', 'elementary', 'My stomach hurts when I eat too quickly.', '我吃太快時肚子會痛。', 'Body'),
('nurse', 'n.', '護士', 'elementary', 'The nurse puts a bandage on my knee.', '護士在我的膝蓋貼上繃帶。', 'Jobs'),
('medicine', 'n.', '藥物', 'elementary', 'Take the medicine after dinner, the doctor says.', '醫生說晚餐後吃藥。', 'Health'),
('headache', 'n.', '頭痛', 'elementary', 'I have a headache, so I rest in the nurse''s office.', '我頭痛，所以在保健室休息。', 'Body')
ON CONFLICT (word, level) DO NOTHING;
