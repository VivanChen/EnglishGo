-- Missing elementary words; preserve all existing rows.
INSERT INTO public.word_bank (word,pos,meaning,level,example,example_zh,category) VALUES
('train', 'n.', '火車', 'elementary', 'The red train travels along the tracks.', '這列紅色火車沿著鐵軌行駛。', 'Transportation'),
('motorcycle', 'n.', '機車', 'elementary', 'The blue motorcycle has two wheels.', '這輛藍色機車有兩個輪子。', 'Transportation'),
('taxi', 'n.', '計程車', 'elementary', 'The yellow taxi waits by the road.', '這輛黃色計程車在路邊等候。', 'Transportation')
ON CONFLICT (word,level) DO NOTHING;
