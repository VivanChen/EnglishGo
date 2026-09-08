import {useEffect, useRef, useState} from 'react';
import PixelPet from '../components/PetCompanion.jsx';
import {GachaMachineArt} from '../components/PetWorldArt.jsx';
import {planPetPulls} from '../data/petGacha.js';
import './pet-gacha-studio.css';

const resultLabels = {newEgg: '新夥伴蛋', eggMerge: '孵化進度', eggReserve: '成長禮物已保留', petBoost: '夥伴成長'};

export default function PetGachaStudio({onBack, onNavigate, c, coins, setCoins, eggs, setEggs, pets, setPets, api}) {
  const {Hdr, useLS, EGG_COST, EGG_HATCH_TASKS, GACHA_SR_PITY, RARITY_INFO, playSound} = api;
  const [pity, setPity] = useLS('gachaPity', {sinceSR: 0, total: 0});
  const [receipt, setReceipt] = useLS('gachaReceipt', null);
  const hasReceipt = Boolean(receipt?.items?.length);
  const [phase, setPhase] = useState(hasReceipt && !receipt.acknowledged ? 'result' : 'lobby');
  const [count, setCount] = useState(1);
  const rolling = useRef(false), timer = useRef(null), heading = useRef(null), drawButton = useRef(null);
  const cost = EGG_COST * count;
  const affordable = coins >= cost;
  const ready = eggs.filter(egg => egg.progress >= EGG_HATCH_TASKS[egg.rarity]).length;
  const receiptHasEggs = eggs.some(egg => receipt?.items?.some(item => item.petId === egg.petId && item.resultType !== 'petBoost'));
  const newCount = receipt?.items?.filter(item => item.resultType === 'newEgg').length || 0;
  const resultReady = eggs.filter(egg => receipt?.items?.some(item => item.petId === egg.petId) && egg.progress >= EGG_HATCH_TASKS[egg.rarity]).length;
  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => { if (phase === 'result') heading.current?.focus(); }, [phase]);

  const reveal = () => {
    if (!rolling.current) return;
    clearTimeout(timer.current);
    rolling.current = false;
    setPhase('result');
    playSound?.('good');
  };
  const roll = () => {
    if (rolling.current || phase !== 'lobby' || !affordable) return;
    rolling.current = true;
    const settled = planPetPulls({count, pity, pets, eggs, api});
    // Settle once before showing the animation. Restoring a receipt only reads it.
    setCoins(value => Math.max(0, value - cost));
    setPets(settled.pets);
    setEggs(settled.eggs);
    setPity(settled.pity);
    setReceipt({items: settled.items, cost, balanceBefore: coins, balanceAfter: coins - cost, acknowledged: false, date: new Date().toISOString()});
    setPhase('rolling');
    playSound?.('flip');
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.egCalm === 'true';
    timer.current = setTimeout(reveal, reduced ? 100 : 1200);
  };
  const acknowledge = () => setReceipt(value => value ? {...value, acknowledged: true} : value);
  const close = () => {
    acknowledge();
    setPhase('lobby');
    requestAnimationFrame(() => drawButton.current?.focus());
  };
  const goNext = () => {
    acknowledge();
    onNavigate?.('pets', receiptHasEggs ? 'eggs' : 'pets');
  };
  const resultDescription = item => {
    if (item.resultType === 'newEgg') return `已放進孵化小屋，累積 ${EGG_HATCH_TASKS[item.rarity]} 次學習進度就能孵化。`;
    if (item.resultType === 'eggMerge') return `相同的蛋合在一起，孵化進度 +${item.progressGain}。`;
    if (item.resultType === 'eggReserve') return '這顆蛋已能孵化，重複獎勵已保留，孵化後領取。';
    return '相同的夥伴化成成長禮物，已自動送給牠。';
  };

  return <div className="pet-world pet-gacha eg-gacha" data-testid="pet-gacha-studio">
    <Hdr t="森林扭蛋屋" onBack={onBack} cl={c.cl}/>
    <div className="eg-gacha-topline"><span>每一份學習，都能慢慢長成友誼。</span><div className="eg-gacha-wallet" aria-label={`學習金幣餘額 ${coins}`}><span aria-hidden="true">◉</span> 學習金幣 <strong>{coins.toLocaleString()}</strong></div></div>
    <ol className="eg-gacha-steps" aria-label="迎接夥伴的三個步驟">
      {[['取得一顆蛋', '使用學習金幣'], ['學習孵化', '讓進度慢慢累積'], ['迎接夥伴', '一起照顧、玩遊戲']].map(([label, note], index) => <li key={label} aria-current={(index === (phase === 'result' ? receiptHasEggs ? 1 : 2 : 0)) ? 'step' : undefined}><span>{index + 1}</span><div><b>{label}</b><small>{note}</small></div></li>)}
    </ol>

    {phase === 'result' && hasReceipt ? <section className="eg-gacha-results" aria-labelledby="gacha-result-title">
      <div className="eg-gacha-result-heading"><span className="eg-gacha-kicker">相遇已保存</span><h2 id="gacha-result-title" ref={heading} tabIndex={-1}>把這份相遇帶回家</h2><p>{newCount ? `遇見 ${newCount} 位新夥伴，從陪伴牠的蛋開始。` : receiptHasEggs ? '這份相遇，讓等待中的小夥伴更快長大。' : '熟悉的朋友，也有新的成長。'}</p>
        {Number.isFinite(receipt.cost) && <div className="eg-gacha-payment">本次使用 <b>{receipt.cost} 金幣</b><span>・</span>取得後餘額 <b>{receipt.balanceAfter}</b></div>}
      </div>
      <div className={`eg-gacha-receipts ${receipt.items.length === 1 ? 'is-single' : ''}`}>
        {receipt.items.map(item => {
          const rarity = RARITY_INFO[item.rarity] || RARITY_INFO.N;
          return <article key={item.id} className="eg-gacha-receipt">
            <div className="eg-gacha-receipt-art"><PixelPet petId={item.petId} stage={item.resultType === 'petBoost' ? 'adult' : 'egg'} size={receipt.items.length === 1 ? 160 : 84} animate={false}/></div>
            <div className="eg-gacha-receipt-copy"><span className="eg-gacha-result-kind">{resultLabels[item.resultType] || '相遇已保存'}</span><h3>{item.pet?.name || '小夥伴'}{item.resultType === 'petBoost' ? '' : '蛋'}</h3><span className="eg-gacha-rarity" style={{'--gacha-rarity': rarity.color}}>{rarity.label} · {item.rarity}</span><p>{resultDescription(item)}</p>
              {item.resultType === 'eggMerge' && <div className="eg-gacha-egg-progress"><progress aria-label={`${item.pet?.name || '小夥伴'}孵化進度`} value={item.targetProgress} max={item.targetNeeded}/><b>{item.targetProgress} / {item.targetNeeded}{item.targetProgress >= item.targetNeeded ? ' · 可以孵化了' : ''}</b></div>}
              {(item.resultType === 'petBoost' || item.resultType === 'eggReserve') && <div className="eg-gacha-reward-values">經驗 +{item.dupeExp}<span>親密度 +{item.dupeBond}</span></div>}
              {receipt.items.length === 1 && item.pet?.story && <p className="eg-gacha-story">{item.pet.story}</p>}
              {(item.pityHit || item.guarantee) && <small className="eg-gacha-guarantee">{item.pityHit ? '已套用超稀有（SR）保底' : '已套用十顆的稀有（R）保底'}</small>}
            </div>
          </article>;
        })}
      </div>
      <div className="eg-gacha-result-next"><div><b>{receiptHasEggs ? resultReady ? `${resultReady} 顆蛋準備好與你見面了` : '下一步：用學習陪蛋孵化' : '下一步：看看夥伴的新成長'}</b><p>{receiptHasEggs ? '到孵化小屋查看進度，滿了就能親手迎接牠。' : '經驗與親密度已加入夥伴，可以直接回家陪牠玩。'}</p></div><div className="eg-gacha-actions">{onNavigate && <button className="pet-primary" onClick={goNext}>{receiptHasEggs ? resultReady ? '去孵化，迎接夥伴 →' : '前往孵化小屋 →' : '看看我的夥伴 →'}</button>}<button className="pet-secondary" onClick={close}>收下結果</button></div></div>
      <p className="eg-gacha-saved-note">結果已自動保存。離開也不會遺失，下次可在扭蛋屋查看最近一次結果。</p>
    </section> : <>
      <section className="eg-gacha-shop" aria-labelledby="gacha-shop-title">
        <div className="eg-gacha-shop-copy"><span className="eg-gacha-kicker">01 / 小夥伴的故事，從這裡開始</span><h2 id="gacha-shop-title">帶一顆蛋回家，<br/>慢慢成為好朋友。</h2><p className="eg-gacha-intro">用學習存下的金幣，遇見一位小夥伴。<br/>取得蛋後，再一起學英文、等待孵化。</p>
          {phase === 'rolling' ? <div className="eg-gacha-opening" role="status"><b>小夥伴正在打招呼…</b><p>蛋與獎勵已保存，可以放心離開。</p><button className="pet-primary" onClick={reveal}>直接看結果</button></div> : <div className="eg-gacha-purchase">
            <div className="eg-gacha-choices" role="group" aria-label="選擇取得蛋的數量"><button aria-pressed={count === 1} onClick={() => setCount(1)}><b>一顆蛋</b><span>{EGG_COST} 金幣</span></button><button aria-pressed={count === 10} onClick={() => setCount(10)}><b>十顆蛋</b><span>{EGG_COST * 10} 金幣</span></button></div>
            <p className="eg-gacha-choice-note">{count === 1 ? '一次小小的相遇。抽到相同夥伴，也會幫助牠成長。' : '至少 1 顆稀有（R）以上；相同的蛋會自動合併。'}</p>
            <div className="eg-gacha-cost"><span>本次使用 <b>{cost} 金幣</b></span><span>{affordable ? <>取得後剩 <b>{coins - cost}</b></> : <>還差 <b>{cost - coins}</b> 金幣</>}</span></div>
            <button ref={drawButton} className="pet-primary eg-gacha-draw" disabled={!affordable} onClick={roll}>{count === 1 ? '轉出一顆蛋' : '轉出十顆蛋'}<span>{cost} 金幣 →</span></button>
            {!affordable && <div className="eg-gacha-shortfall"><p>先完成學習任務，把金幣慢慢存起來。</p>{onNavigate && <button className="pet-secondary" onClick={() => onNavigate('pets', 'tasks')}>去做任務，賺金幣 →</button>}</div>}
          </div>}
        </div>
        <div className="eg-gacha-illustration"><div className="eg-gacha-art-caption"><span>FOREST EGG HOUSE</span><p>每顆蛋，都藏著一個新朋友。</p></div><GachaMachineArt rolling={phase === 'rolling'}/><span className="eg-gacha-art-footnote">只使用遊戲中的學習金幣</span></div>
      </section>
      {phase === 'lobby' && hasReceipt && <div className="eg-gacha-last-result"><span>上次的相遇，已經收好了。</span><button className="pet-link" onClick={() => setPhase('result')}>查看上次結果 →</button></div>}
      <section className="eg-gacha-nursery"><span className="eg-gacha-nursery-icon" aria-hidden="true">🥚</span><div><span className="eg-gacha-kicker">下一步 / 孵化小屋</span><h3>{ready ? `${ready} 顆蛋，正等著和你見面` : eggs.length ? `你有 ${eggs.length} 顆蛋，正在慢慢長大` : '相遇以後，還有一起長大的日常'}</h3><p>{ready ? '進度已經集滿，到小屋就能親手孵化。' : eggs.length ? '完成學習會一起推進所有蛋，不用先選一顆。' : '完成學習累積孵化進度，再迎接你的新夥伴。'}</p></div>{onNavigate && <button className="pet-secondary" onClick={() => onNavigate('pets', 'eggs')}>前往孵化小屋 →</button>}</section>
    </>}

    <details className="eg-gacha-rules"><summary>機率、保底與重複夥伴的說明</summary><div className="eg-gacha-rule-content"><div><h3>每一次相遇的機率</h3><dl className="eg-gacha-rates">{Object.entries(RARITY_INFO).map(([id, info]) => <div key={id}><dt>{info.label}<small>{id}</small></dt><dd>{info.rate}%</dd></div>)}</dl><p>這是一般抽取的機率。連續 {GACHA_SR_PITY - 1} 次沒有超稀有（SR）以上，下一次至少取得 SR。十顆另有至少 1 顆稀有（R）以上的保底。</p><p className="eg-gacha-pity">目前最多再 {Math.max(1, GACHA_SR_PITY - (pity?.sinceSR || 0))} 次，會取得 SR 以上。</p></div><div><h3>相同的夥伴，也會帶來禮物</h3><ul><li><b>蛋還在孵化：</b>合併為孵化進度。</li><li><b>蛋已準備好：</b>保留成長禮物，孵化時一起領取。</li><li><b>已經是夥伴：</b>直接增加經驗、親密度與共鳴。</li></ul><p>抽到的稀有度不影響參加家園活動的資格。你不需要一直抽蛋，也能陪喜歡的夥伴長大。</p></div></div></details>
  </div>;
}
