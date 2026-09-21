begin;
insert into public.word_bank (word, level, pos, meaning, example, example_zh, category)
values ('sleepy','elementary','adj.','想睡的','I feel sleepy after reading my bedtime story.','讀完睡前故事後，我覺得想睡了。','Feelings'),
('internet','elementary','n.','網際網路','Use the internet with a teacher nearby.','在老師旁邊時使用網路。','Technology')
on conflict (word, level) do nothing;

insert into public.word_illustrations (id,level,word,sort_order,sense,alt_zh,example,example_zh,image_url,local_path,style,version) values
('elementary-apple-01-v1','elementary','apple',1,'蘋果','一顆帶有綠葉的紅蘋果。','This is a red apple.','這是一顆紅蘋果。','https://jbspxqebcrkilfcddluo.supabase.co/storage/v1/object/public/word-illustrations/elementary/apple-01-v1.webp','/images/vocabulary/elementary/apple-01-v1.webp','watercolor-pencil-v1',1),
('elementary-umbrella-01-v1','elementary','umbrella',1,'雨傘','張開的黃色雨傘擋住雨滴。','An umbrella keeps the rain off.','雨傘可以遮雨。','https://jbspxqebcrkilfcddluo.supabase.co/storage/v1/object/public/word-illustrations/elementary/umbrella-01-v1.webp','/images/vocabulary/elementary/umbrella-01-v1.webp','watercolor-pencil-v1',1),
('elementary-jump-01-v1','elementary','jump',1,'跳躍','孩子雙腳離地向上跳起。','The boy can jump high.','這個男孩可以跳得很高。','https://jbspxqebcrkilfcddluo.supabase.co/storage/v1/object/public/word-illustrations/elementary/jump-01-v1.webp','/images/vocabulary/elementary/jump-01-v1.webp','watercolor-pencil-v1',1),
('elementary-sleepy-01-v1','elementary','sleepy',1,'想睡的','孩子眼皮下垂，打著哈欠。','I feel sleepy.','我覺得想睡了。','https://jbspxqebcrkilfcddluo.supabase.co/storage/v1/object/public/word-illustrations/elementary/sleepy-01-v1.webp','/images/vocabulary/elementary/sleepy-01-v1.webp','watercolor-pencil-v1',1),
('elementary-happy-01-v1','elementary','happy',1,'開心的','孩子露出開心的笑容。','The boy looks happy.','這個男孩看起來很開心。','https://jbspxqebcrkilfcddluo.supabase.co/storage/v1/object/public/word-illustrations/elementary/happy-01-v1.webp','/images/vocabulary/elementary/happy-01-v1.webp','watercolor-pencil-v1',1),
('elementary-under-01-v1','elementary','under',1,'在……下面','一隻橘貓坐在桌子下面。','The cat is under the table.','貓在桌子下面。','https://jbspxqebcrkilfcddluo.supabase.co/storage/v1/object/public/word-illustrations/elementary/under-01-v1.webp','/images/vocabulary/elementary/under-01-v1.webp','watercolor-pencil-v1',1),
('elementary-under-02-v1','elementary','under',2,'在……下面','書包放在椅子下面。','The bag is under the chair.','書包在椅子下面。','https://jbspxqebcrkilfcddluo.supabase.co/storage/v1/object/public/word-illustrations/elementary/under-02-v1.webp','/images/vocabulary/elementary/under-02-v1.webp','watercolor-pencil-v1',1),
('elementary-internet-01-v1','elementary','internet',1,'網際網路','孩子與老師透過網路查找鳥類資料。','We use the internet to learn about birds.','我們用網路認識鳥類。','https://jbspxqebcrkilfcddluo.supabase.co/storage/v1/object/public/word-illustrations/elementary/internet-01-v1.webp','/images/vocabulary/elementary/internet-01-v1.webp','watercolor-pencil-v1',1),
('elementary-internet-02-v1','elementary','internet',2,'網際網路','孩子透過網路和螢幕裡的奶奶視訊。','I talk to Grandma over the internet.','我透過網路和奶奶聊天。','https://jbspxqebcrkilfcddluo.supabase.co/storage/v1/object/public/word-illustrations/elementary/internet-02-v1.webp','/images/vocabulary/elementary/internet-02-v1.webp','watercolor-pencil-v1',1),
('elementary-internet-03-v1','elementary','internet',3,'網際網路','孩子透過網路把向日葵圖片傳給朋友。','I send a picture over the internet.','我透過網路傳送一張圖片。','https://jbspxqebcrkilfcddluo.supabase.co/storage/v1/object/public/word-illustrations/elementary/internet-03-v1.webp','/images/vocabulary/elementary/internet-03-v1.webp','watercolor-pencil-v1',1)
on conflict (level,word,sort_order) do update set
sense=excluded.sense,
alt_zh=excluded.alt_zh,
example=excluded.example,
example_zh=excluded.example_zh,
image_url=excluded.image_url,
local_path=excluded.local_path,
style=excluded.style,
version=excluded.version;
commit;
