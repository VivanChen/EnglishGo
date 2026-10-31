// Short object-side play sequences. They never grant discovery or care rewards.
export const OUTING_GAMES = {
  tidepool: { label:'貝殼躲貓貓', task:'shell', hint:'靠近貝殼，看看夥伴會怎麼試探它。', steps:[['sniff','先低頭聞聞貝殼，確認裡面的小住客。'],['pounce','在旁邊輕輕一撲，又好奇地縮回小爪。'],['greet','和貝殼裡的小住客揮揮手，留牠好好休息。']] },
  meadow: { label:'花香小舞步', task:'flowers', hint:'不摘花，也能陪夥伴在花旁跳支舞。', steps:[['sniff','湊近花朵，聞聞今天的香氣。'],['spin','聞到喜歡的花香，開心地轉了一圈！'],['bow','向小花鞠個躬，謝謝它帶來的香氣。']] },
  pond: { label:'水波猜猜看', task:'ripples', hint:'觀察水面，再看看夥伴的小耳朵。', steps:[['listen','豎起耳朵，等水面傳來細細的聲音。'],['curious','歪著頭研究一圈圈散開的水波。'],['shake','抖抖耳朵，再安靜地陪你看水面。']] },
  market: { label:'點心聞香師', task:'basket', hint:'請夥伴用鼻子找找野餐籃裡的香味。', steps:[['sniff','左聞聞、右聞聞，籃子裡好香呀。'],['greet','舉起小爪，像是找到最喜歡的點心。'],['bow','向準備點心的朋友鞠躬說謝謝。']] },
  camp: { label:'野餐午睡曲', task:'picnic', hint:'找個舒服的位置，一起放慢腳步。', steps:[['stretch','伸長前腳，準備在野餐席旁休息。'],['yawn','打了一個小呵欠，眼睛也瞇起來了。'],['settle','慢慢趴下，把舒服的位置留一半給你。']] },
  observatory: { label:'星光許願舞', task:'stars', hint:'一起仰望星空，再用動作許個願。', steps:[['listen','抬頭望向夜空，耳朵隨著微風輕動。'],['spin','轉一圈，把今晚的小願望藏進星光。'],['hop','跳一下！像是想離星星再近一點。']] },
};

export function outingGameFor(placementId, gameId) {
  const game = OUTING_GAMES[gameId];
  return game && placementId === `explore-${game.task}` ? game : null;
}
