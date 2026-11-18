// Original EnglishGo story for lower elementary readers (about A1): short sentences, kind help.
export const OTTO_PAGES = [
 {t:'Otto by the pond',s:'pond',x:'Otto is a little otter. He lives by a quiet pond. He has a small red boat.',z:'奧圖是一隻小水獺。他住在一座安靜的池塘邊。他有一艘紅色的小船。'},
 {t:'A little light',s:'dusk',x:'The sun goes down, and the pond gets dark. Otto lights his paper lantern. Glow, little light!',z:'太陽下山了，池塘變暗了。奧圖點亮他的紙燈籠。亮起來吧，小燈光！'},
 {t:'Who is crying?',s:'crying',x:'Otto hears a sad sound. A little duck is crying. "I can\'t find my mom!"',z:'奧圖聽到一個難過的聲音。一隻小鴨子在哭。「我找不到我的媽媽！」'},
 {t:'A big green frog',s:'frog',x:'"Hop in my boat," says Otto. They float past a big green frog. "Ribbit! Where are you going?" asks the frog.',z:'「跳上我的船吧。」奧圖說。他們漂過一隻綠色的大青蛙。「呱呱！你們要去哪裡？」青蛙問。'},
 {t:'Follow the fish',s:'fish',x:'"We are looking for Mother Duck," says Otto. "Follow the fish!" says the frog. Three silver fish swim ahead.',z:'「我們在找鴨媽媽。」奧圖說。「跟著魚走！」青蛙說。三條銀色的小魚游在前面。'},
 {t:'Under the moon',s:'moon',x:'The fish swim past the tall reeds. The moon comes out. The water shines like silver.',z:'小魚游過高高的蘆葦。月亮出來了。水面像銀子一樣閃閃發亮。'},
 {t:'Quack, quack!',s:'mother',x:'"Quack! Quack!" Mother Duck is calling. The little duck jumps out of the boat. "Mom!"',z:'「呱！呱！」鴨媽媽在呼喚。小鴨子跳下船。「媽媽！」'},
 {t:'Home again',s:'home',x:'The duck hugs his mom. "Thank you, Otto!" Otto rows home with a big smile. His lantern glows all night.',z:'小鴨子抱住媽媽。「謝謝你，奧圖！」奧圖帶著大大的笑容划船回家。他的燈籠亮了一整夜。'}
];
export const OTTO_VOCAB = {
 otter:['🦦','水獺'],pond:['🏞️','池塘'],quiet:['🤫','安靜的'],boat:['🛶','小船'],red:['🔴','紅色的'],sun:['🌇','太陽'],dark:['🌑','暗的'],lights:['🕯️','點亮'],paper:['📜','紙做的'],lantern:['🏮','燈籠'],glow:['✨','發光'],hears:['👂','聽到'],sad:['😢','難過的'],sound:['🔊','聲音'],duck:['🦆','鴨子'],crying:['😭','哭'],find:['🔍','找到'],mom:['👩','媽媽'],hop:['🐇','跳'],float:['🛟','漂浮'],past:['➡️','經過'],big:['🐘','大的'],green:['🟢','綠色的'],frog:['🐸','青蛙'],asks:['❓','問'],looking:['👀','尋找（look for）'],mother:['🦆','媽媽'],follow:['👣','跟著'],fish:['🐟','魚'],three:['3️⃣','三'],silver:['🥈','銀色的'],swim:['🏊','游泳'],ahead:['⏩','在前面'],tall:['📏','高的'],reeds:['🌾','蘆葦'],moon:['🌙','月亮'],water:['💧','水'],shines:['🌟','閃耀'],calling:['📣','呼喚'],jumps:['🦘','跳'],hugs:['🤗','擁抱'],thank:['🙏','謝謝'],rows:['🚣','划船'],home:['🏠','家'],smile:['😊','微笑'],night:['🌃','夜晚']
};
export const OTTO_QUESTIONS = [
 {q:'Why is the little duck crying?',zh:'小鴨子為什麼在哭？',options:['He is hungry.','He can’t find his mom.','He fell out of the boat.'],answer:1,explanation:'“I can’t find my mom!” says the duck. 小鴨子說：「我找不到我的媽媽！」'},
 {q:'Who tells Otto to follow the fish?',zh:'誰叫奧圖跟著魚走？',options:['The frog.','Mother Duck.','The moon.'],answer:0,explanation:'“Follow the fish!” says the frog. 是青蛙說「跟著魚走！」'}
];
export const OTTO_PATTERNS = [
 ['I can’t find my mom!','I can’t + 動詞：我沒辦法……。用來說出自己遇到的困難。'],
 ['The water shines like silver.','… like …：像……一樣。拿兩樣東西比較，讓畫面更生動。']
];
