// Separate draw piles: every card appears once before its pile is shuffled again.
export const ISLAND_DECKS = {
  chance: [
    {id:'venture',title:'夜市合夥邀請',text:'攤主缺一位合夥人。穩穩收錢，還是押一把？',options:[{label:'收攤幫忙 · +12',cash:12},{label:'投資 12 · 一半機率拿 36',cost:12,gamble:36}]},
    {id:'supply',title:'漂流道具箱',text:'只能帶走一件，你的下一步需要什麼？',options:[{label:'遙控骰子 · 指定 1–6 格',card:'control'},{label:'路障 · 指定對手停走一次',card:'block'}]},
    {id:'renovate',title:'工匠的提案',text:'留下現金，或為下一棟高樓準備。',options:[{label:'接受補貼 · +10',cash:10},{label:'收下工程券 · 下次升級省 20',discount:20}]},
    {id:'ferry',title:'免費渡輪',text:'回起點拿補給，還是留在這裡等待下一輪？',options:[{label:'搭船回起點 · +12',cash:12,move:0},{label:'留下接案 · +18',cash:18}]},
    {id:'deal',title:'道具商的特賣',text:'只此一次的進貨價。',options:[{label:'花 3 買收租卡',cost:3,card:'rent'},{label:'花 3 買護盾卡',cost:3,card:'shield'},{label:'保留現金'}]},
    {id:'rival',title:'小鎮競賽',text:'向目前最富有的對手發起挑戰，或領取參加獎。',options:[{label:'挑戰 · 一半機率奪取 24，失敗付 8',duel:true,cost:8},{label:'參加獎 · +8',cash:8}]},
  ],
  fate: [
    {id:'repairs',title:'暴風雨後的修繕',text:'每棟自有建築維修 4 旅費，最多 20。護盾可擋下這次費用。',options:[{label:'處理修繕',tax:true}]},
    {id:'festival',title:'全島豐收節',text:'每位仍在場的玩家獲得 12 旅費。',options:[{label:'一起慶祝 · 全員 +12',allCash:12}]},
    {id:'rescue',title:'小鎮互助基金',text:'現金最多的對手支援你 16 旅費；轉移不超過對手餘額。',options:[{label:'接受支援',steal:16}]},
    {id:'detour',title:'道路臨時改道',text:'下回合獲得加速卡，使用後兩個落點都向前多 2 格。',options:[{label:'收下加速卡',card:'boost'}]},
    {id:'inspection',title:'建築安全稽查',text:'保留現金接受稽查，或以一張路障卡抵付。',options:[{label:'支付 10',cost:10,debt:true},{label:'交出一張路障卡',spendCard:'block'}]},
    {id:'windfall',title:'海灘尋寶',text:'你在沙灘找到一只寶箱，裡面是 22 旅費。',options:[{label:'打開寶箱 · +22',cash:22}]},
  ],
};
export function drawIslandEvent(kind,piles,random=Math.random){
  const source=ISLAND_DECKS[kind]||ISLAND_DECKS.chance;
  const pile=piles[kind]?.length?[...piles[kind]]:[...source];
  if(!piles[kind]?.length)for(let i=pile.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[pile[i],pile[j]]=[pile[j],pile[i]]}
  return {card:pile.shift(),piles:{...piles,[kind]:pile}};
}
export const ISLAND_TOOLS=[
  {id:'boost',name:'加速卡',icon:'↑',desc:'兩個落點都前進 +2',price:5,color:'#2563eb'},
  {id:'shield',name:'護盾卡',icon:'◇',desc:'下次租金減半；或抵擋維修',price:5,color:'#0f9f7a'},
  {id:'rent',name:'收租卡',icon:'$',desc:'下一次收到的租金加倍',price:6,color:'#d97706'},
  {id:'control',name:'遙控骰子',icon:'⚄',desc:'本回合指定前進 1–6 格',price:10,color:'#7c3aed'},
  {id:'block',name:'路障卡',icon:'⛔',desc:'指定對手停走一次',price:8,color:'#db2777'},
];
