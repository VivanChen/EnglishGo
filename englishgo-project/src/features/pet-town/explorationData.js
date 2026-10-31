// Original bilingual encounters; exploration never changes story unlocks or the wallet.
const task = (id, itemId, title, word, zh, en, translation, prompt, options, answer) => ({
  id, itemId, title, word, zh, en, translation, prompt,
  options: options.map(([en, zh]) => ({ en, zh })), answer,
});
export const EXPLORATION_PLACES = [
  { id:'tidepool', name:'潮汐灣', en:'Tidepool Bay', icon:'◒', x:22, y:76, color:'#71aeb7', description:'退潮後的小水窪，藏著海風送來的線索。', tasks:[
    task('shell','harbor-shells','尋找貝殼','shell','貝殼','Leave the shell by the sea. A small crab lives inside.','把貝殼留在海邊，裡面住著一隻小螃蟹。','What should we do with this shell?', [['Take it home.','帶回家。'],['Leave it here.','留在這裡。'],['Put it in a bag.','放進袋子。']],1),
    task('rest','harbor-bench','海邊歇腳','bench','長椅','The bench is dry, but the rocks are wet. Let’s sit on the bench.','長椅是乾的，岩石卻是濕的。我們坐長椅吧。','Where can we sit without getting wet?', [['On the wet rocks.','在濕岩石上。'],['In the sea.','在海裡。'],['On the bench.','在長椅上。']],2),
  ]},
  { id:'meadow', name:'花語草地', en:'Whispering Meadow', icon:'❀', x:30, y:42, color:'#9caa73', description:'聞聞花香，幫小花園找回舒服的早晨。', tasks:[
    task('flowers','orchard-planter','聞聞香草','flower','花','Look at the flowers. Please do not pick them; bees need them too.','看看花朵，請不要摘。蜜蜂也需要它們。','How can we enjoy the flowers?', [['Look without picking.','欣賞但不摘取。'],['Pick every flower.','摘光所有花。'],['Hide them in a box.','把花藏進盒子。']],0),
    task('water','orchard-watering-can','照顧幼苗','water','水','The soil is dry. Give the little plants some water, not more sunlight.','土壤乾了。給小植物一些水，而不是更多陽光。','What do the plants need now?', [['A blanket.','一條毯子。'],['Some water.','一些水。'],['More sunlight.','更多陽光。']],1),
  ]},
  { id:'pond', name:'映月池', en:'Moon Mirror Pond', icon:'≈', x:68, y:59, color:'#76aaa5', description:'輕輕靠近水邊，聽水波和風鈴說話。', tasks:[
    task('ripples','starlight-fountain','觀察水波','quiet','安靜的','Stay quiet by the pond. If we make a loud noise, the birds may fly away.','在池邊保持安靜。如果發出很大的聲音，鳥兒可能會飛走。','How can we watch the birds?', [['Shout loudly.','大聲喊叫。'],['Bang on a drum.','敲鼓。'],['Stay quiet.','保持安靜。']],2),
    task('chime','starlight-chime','聽風的方向','wind','風','The wind moves the chime. Listen: the soft sound comes from above us.','風吹動風鈴。聽，輕柔的聲音從我們上方傳來。','Where does the chime’s sound come from?', [['Above us.','我們上方。'],['Under the pond.','池水底下。'],['Inside a suitcase.','行李箱裡。']],0),
  ]},
  { id:'market', name:'海風市集', en:'Seabreeze Market', icon:'⌂', x:48, y:81, color:'#cfaa7f', description:'聞到麵包香了！和夥伴一起練習有禮貌地開口。', tasks:[
    task('basket','orchard-basket','尋找野餐點心','basket','籃子','Our picnic bread is in the basket, not on the table.','我們的野餐麵包在籃子裡，不在桌上。','Where is our bread?', [['Under the tree.','樹下。'],['In the basket.','籃子裡。'],['On the table.','桌上。']],1),
    task('tea','harbor-table','午後茶會','please','請','Ask for a cup of water politely. Remember to say please.','有禮貌地要一杯水，記得說 please。','Which request is polite?', [['Give it to me now!','現在就給我！'],['Go away!','走開！'],['May I have some water, please?','請問可以給我一些水嗎？']],2),
  ]},
  { id:'camp', name:'林間營地', en:'Woodland Camp', icon:'△', x:65, y:32, color:'#ac9c7b', description:'鋪好野餐席、點亮營燈，留一個位子給新朋友。', tasks:[
    task('picnic','orchard-picnic','鋪好野餐席','share','分享','There is room on our blanket. Invite your friend to sit with us.','我們的毯子還有空位。邀請朋友和我們一起坐。','What can we say to our friend?', [['Come and sit with us.','過來和我們一起坐吧。'],['There is no room for you.','沒有你的位置。'],['Leave the forest.','離開森林。']],0),
    task('light','starlight-lantern','點亮回家的路','lantern','燈籠','It is getting dark. The lantern helps us see the path back to camp.','天色漸暗。燈籠幫助我們看清回營地的小路。','Why do we need the lantern?', [['To water the plants.','用來澆花。'],['To see the path.','看清小路。'],['To carry the bread.','裝麵包。']],1),
  ]},
  { id:'observatory', name:'山頂觀星台', en:'Summit Observatory', icon:'✦', x:35, y:16, color:'#989bc0', description:'帶著好奇心仰望天空，收藏今晚最亮的回憶。', tasks:[
    task('stars','starlight-telescope','尋找星光','star','星星','We can see more stars when the sky is dark and clear.','天空黑暗而晴朗時，我們能看見更多星星。','Which sky is best for watching stars?', [['A bright midday sky.','明亮的正午天空。'],['A sky full of thick clouds.','滿是厚雲的天空。'],['A dark, clear sky.','黑暗而晴朗的天空。']],2),
    task('wish','starlight-tree','樹下許個願','wish','願望','Make a wish for your friend: may tomorrow bring a happy adventure.','為朋友許個願：願明天有一場快樂的冒險。','Which wish is kind?', [['I hope you have a lovely day.','希望你度過美好的一天。'],['I hope you lose your bag.','希望你弄丟袋子。'],['I hope you miss the boat.','希望你錯過船。']],0),
  ]},
];
export const explorationReceipt = (placeId, taskId) => `explore:${placeId}:${taskId}`;
export const explorationTask = (placeId, taskId) => EXPLORATION_PLACES.find(p=>p.id===placeId)?.tasks.find(t=>t.id===taskId);
export const explorationPlacements = place => place.tasks.map((t,i)=>({id:`explore-${t.id}`,itemId:t.itemId,x:i ? 2.4 : -2.4,z:i ? 0.6 : 1.2,rotation:0}));
