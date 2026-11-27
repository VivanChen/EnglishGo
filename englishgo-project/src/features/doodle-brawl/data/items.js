// Passive items: everyday things a doodle hero would carry. Items stack;
// `effect` items also add a special behaviour in the arena.
export const ITEMS = {
  // Common
  snack: { en: 'Snack', zh: '點心', tier: 0, price: 14, stats: { maxHp: 3 } },
  sneakers: { en: 'Sneakers', zh: '運動鞋', tier: 0, price: 15, stats: { speed: 6 } },
  helmet: { en: 'Helmet', zh: '安全帽', tier: 0, price: 17, stats: { armor: 2, speed: -3 } },
  juice: { en: 'Juice Box', zh: '果汁盒', tier: 0, price: 14, stats: { regen: 1 } },
  magnifier: { en: 'Magnifier', zh: '放大鏡', tier: 0, price: 16, stats: { range: 40 } },
  coin: { en: 'Lucky Coin', zh: '幸運硬幣', tier: 0, price: 13, stats: { luck: 8 } },
  clock: { en: 'Alarm Clock', zh: '鬧鐘', tier: 0, price: 18, stats: { atkSpeed: 8 } },
  sticker: { en: 'Gold Sticker', zh: '金色貼紙', tier: 0, price: 14, stats: { crit: 4 } },
  gum: { en: 'Bubble Gum', zh: '泡泡糖', tier: 0, price: 16, stats: { dodge: 5 } },
  piggy: { en: 'Piggy Bank', zh: '小豬撲滿', tier: 0, price: 16, stats: { harvest: 5 } },
  pillow: { en: 'Pillow', zh: '枕頭', tier: 0, price: 15, stats: { maxHp: 5, speed: -3 } },
  // Uncommon
  backpack: { en: 'Backpack', zh: '書包', tier: 1, price: 30, stats: { maxHp: 5, armor: 1 } },
  raincoat: { en: 'Raincoat', zh: '雨衣', tier: 1, price: 32, stats: { armor: 3, dodge: 3, atkSpeed: -3 } },
  magnet: { en: 'Magnet', zh: '磁鐵', tier: 1, price: 24, stats: { pickup: 60 } },
  sauce: { en: 'Hot Sauce', zh: '辣椒醬', tier: 1, price: 32, stats: { damage: 10, maxHp: -2 } },
  lunchbox: { en: 'Lunchbox', zh: '便當盒', tier: 1, price: 28, stats: { maxHp: 3 }, effect: 'lunch', text: '餅乾多回復 2 點生命，也更常掉落。' },
  flashlight: { en: 'Flashlight', zh: '手電筒', tier: 1, price: 30, stats: { range: 50, crit: 3 } },
  skateboard: { en: 'Skateboard', zh: '滑板', tier: 1, price: 28, stats: { speed: 12, armor: -1 } },
  firecracker: { en: 'Firecracker', zh: '鞭炮', tier: 1, price: 34, stats: {}, effect: 'boom', text: '敵人倒下時有 25% 機率爆炸，波及身邊的敵人。' },
  bandage: { en: 'Bandage', zh: '繃帶', tier: 1, price: 30, stats: { regen: 2, maxHp: 2 } },
  // Rare
  robot: { en: 'Wind-up Robot', zh: '發條機器人', tier: 2, price: 55, stats: {}, effect: 'turret', text: '每一波開始時放下一台會自動射擊的小機器人。' },
  trophy: { en: 'Trophy', zh: '獎盃', tier: 2, price: 60, stats: { damage: 15, atkSpeed: 8, speed: -5 } },
  umbrella: { en: 'Umbrella', zh: '雨傘', tier: 2, price: 52, stats: { armor: 4, dodge: 6, atkSpeed: -6 } },
  lollipop: { en: 'Lollipop', zh: '棒棒糖', tier: 2, price: 50, stats: { lifesteal: 6 } },
  telescope: { en: 'Telescope', zh: '望遠鏡', tier: 2, price: 55, stats: { range: 100, crit: 8, atkSpeed: -8 } },
  clover: { en: 'Four-leaf Clover', zh: '幸運草', tier: 2, price: 50, stats: { luck: 25, harvest: 5 } },
  // Legendary
  crown: { en: 'Crown', zh: '皇冠', tier: 3, price: 110, stats: { damage: 20, atkSpeed: 15, maxHp: 5, luck: 10 } },
  rocket: { en: 'Rocket Shoes', zh: '火箭鞋', tier: 3, price: 95, stats: { speed: 25, dodge: 10 } },
  goldpen: { en: 'Golden Pen', zh: '金色鋼筆', tier: 3, price: 100, stats: { crit: 20, critDmg: 50 } },
  kite: { en: 'Dragon Kite', zh: '龍風箏', tier: 3, price: 105, stats: {}, effect: 'kite', text: '一隻龍風箏繞著你飛，撞到的敵人都會受傷。' },
};

export const ITEM_IDS = Object.keys(ITEMS);
export const itemsOfTier = tier => ITEM_IDS.filter(id => ITEMS[id].tier === tier);
