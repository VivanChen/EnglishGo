import {useEffect,useRef,useState} from 'react';
import PetCharacterScene from './PetCharacterScene.jsx';
import PetCareStudio from './PetCareStudio.jsx';
import PetDisplayMode from './PetDisplayMode.jsx';
import PetCompanion from './PetCompanion.jsx';
import {CARE_CHOICES,petNeed,completePetCare} from '../data/petCare.js';
import {getPetJourney} from '../data/petJourney.js';
import './pet-showcase.css';

export default function PetShowcase({pets,selected,getDef,rarities,onSelect,onCare,motion,care,foods=[],inventory={},careReady,onReady,onCancel,onFinish,speak,stopSpeech,onShop,result}){
 const [panel,setPanel]=useState('status'),[touched,setTouched]=useState(false);
 const root=useRef(null),previousCare=useRef(null);
 useEffect(()=>{if(careReady)root.current?.querySelector('.showcase-care-finish')?.focus({preventScroll:true})},[careReady]);
 useEffect(()=>{
  const action=care?.action;
  if(CARE_CHOICES.map(choice=>choice.id).includes(action)){const selector=action==='study'?'.pc-study-next':action==='sleep'?'.pc-rest-action':action==='play'?'.pc-toss':action==='clean'?'.pc-spots button':care.foodId?'.pc-food':'.showcase-foods button, .showcase-empty-food button';root.current?.querySelector(selector)?.focus({preventScroll:true});}
  else if(CARE_CHOICES.map(choice=>choice.id).includes(previousCare.current)){root.current?.querySelector(`.showcase-actions button[aria-label="${CARE_CHOICES.find(choice=>choice.id===previousCare.current)?.name}"]`)?.focus({preventScroll:true});}
  previousCare.current=action;
 },[care?.action,care?.foodId]);
 const caring=care&&CARE_CHOICES.map(choice=>choice.id).includes(care.action), food=foods.find(f=>f.id===care?.foodId);
 const sleepPreview=care?.action==='sleep'?completePetCare(selected,'sleep'):null;
 const recent=result?.pet?.petId===selected.petId?result:null;
 const playPreview=care?.action==='play'?completePetCare(selected,'play'):null;
 const journey=getPetJourney(selected),def=getDef(selected),clamp=n=>Math.round(Math.max(0,Math.min(100,n??80)));
 return <section ref={root} className={`pet-showcase ${caring?'is-caring':''}`} aria-label="寵物星光展台" data-testid="pet-showcase">
  <header className="showcase-heading"><div><span>COMPANION / 星光夥伴</span><h2>每一次陪伴，都閃閃發光。</h2><p className="showcase-rotate-hint">將手機轉橫，夥伴與照顧面板一起看。</p></div><div className="showcase-header-tools"><span className="showcase-count">{pets.length} 位夥伴</span><PetDisplayMode targetRef={root}/></div></header>
  <nav className="showcase-roster" aria-label="切換寵物">{pets.map(p=><button key={p.petId} disabled={!!care} aria-pressed={p.petId===selected.petId} aria-label={`查看${getDef(p)?.name||p.petId}`} onClick={()=>{setTouched(false);onSelect(p)}}><PetCompanion petId={p.petId} size={62}/><span>{getDef(p)?.name||p.petId}</span><small>Lv.{p.level||1}</small></button>)}</nav>
  <div className="showcase-center">
   <div className="showcase-rarity"><span>✦ {rarities[selected.rarity]?.label||selected.rarity}</span><small>陪伴印記 {journey.marks||0}</small></div>
   {caring&&(care.action!=='feed'||food)?<PetCareStudio key={`${selected.petId}:${care.action}:${care.foodId||''}`} petId={selected.petId} action={care.action} food={food} words={def?.words} prompt={care.prompt} speak={speak} stopSpeech={stopSpeech} onReady={onReady} motion={motion}/>:<PetCharacterScene petId={selected.petId} motion={motion} interactive={!caring} onPet={()=>setTouched(true)}/>}
   {!caring&&<div className="showcase-name"><small>{touched?'♡ 靠近一點，我喜歡你的陪伴。':'拖曳轉動視角 · 點一下摸摸牠'}</small><h3>{def?.name||selected.petId} <span>Lv.{selected.level||1}</span></h3><p>{petNeed(selected).label}</p></div>}
  </div>
  <aside className="showcase-panel">
   {caring?<section className="showcase-care-panel" aria-label="照顧操作"><span className="showcase-care-eyebrow">CARE TOGETHER</span><h3>{care.action==='study'?'一起翻開小書':care.action==='sleep'?'留一段安靜的晚安':care.action==='play'?'來玩接球吧':care.action==='feed'?'一起吃點好吃的':'泡泡洗澡時間'}</h3>
    {care.action==='feed'&&!food?<><p>挑一份食物，親手餵給{def?.name}。</p><div className="showcase-foods">{foods.filter(f=>inventory[f.id]>0).map(f=><button key={f.id} aria-label={`選這份食物：${f.name}`} onClick={()=>onCare('feed',f.id)}><span>{f.emoji}</span><b>{f.name}<small>飽食 +{f.feed}</small></b><small>× {inventory[f.id]}</small></button>)}</div>{!foods.some(f=>inventory[f.id]>0)&&<div className="showcase-empty-food"><p>食物盒空了，補充一份再回來。</p><button onClick={onShop}>去補食物 →</button></div>}</>:<><p>{careReady?'照顧完成！收下這次陪伴的回憶。':care.action==='study'?'把熟悉的單字念給夥伴聽，一頁一頁留下共讀回憶。':care.action==='sleep'?'跟著三個小步驟，陪夥伴慢慢放鬆。':care.action==='play'?'一人一球，接住今天的小快樂。':care.action==='feed'?'把食物送到嘴邊，也可以點按餵食。':'擦過四處泡泡，慢慢洗乾淨。'}</p>{care.action==='study'?<div className="showcase-care-preview"><span>今日讀書獎勵</span><b>XP +{completePetCare(selected,'study').rewards.exp}</b><small>{completePetCare(selected,'study').first?'完成並保存後獲得成長獎勵。':'今日獎勵已領取，仍可一起複習。'}</small></div>:sleepPreview?<div className="showcase-care-preview"><span>體力</span><b>{clamp(selected.energy)} → {clamp(sleepPreview.pet.energy)}</b><small>{sleepPreview.first?selected.energy>=100?'體力已滿，仍可留下一段晚安回憶。':'每日首次休息最多恢復 25 體力。':'今天已恢復過體力，這次安靜陪伴，不重複加成。'}</small></div>:playPreview?<div className="showcase-care-preview"><span>親密</span><b>{selected.bond||0} → {playPreview.pet.bond}</b><small>體力 {clamp(selected.energy)} → {clamp(playPreview.pet.energy)} · {playPreview.first?'今日首次玩耍獎勵':'今日獎勵已領取，這次不扣體力'}</small></div>:<div className="showcase-care-preview"><span>{care.action==='feed'?'飽食':'清潔'}</span><b>{clamp(selected[care.action==='feed'?'hunger':'clean'])} → {care.action==='feed'?Math.min(100,clamp(selected.hunger)+(food?.feed||0)):100}</b><small>完成後更新</small></div>}{care.action!=='study'&&<div className="showcase-care-english"><small>也可以說一句英文</small><blockquote>{care.prompt}</blockquote><button onClick={()=>speak?.(care.prompt)}>♫ 聽聽怎麼念</button></div>}<p className="showcase-care-note">{care.action==='study'?'讀完小書並夾上書籤後才可保存；途中取消不結算獎勵。':care.action==='sleep'?'完成晚安準備，再確認保存，才記錄恢復與成長獎勵。':care.action==='play'?'完成三回合後才結算；途中取消不扣體力。':care.action==='feed'?'完成時使用 1 份食物；取消不扣庫存。':'完成時才記錄清潔與成長獎勵。'}</p><button className="showcase-care-finish" data-testid="pet-action-complete" disabled={!careReady} onClick={onFinish}>{care.action==='sleep'?'保存晚安回憶 ✓':'完成照顧，收下回憶 ✓'}</button></>}
    <button className="showcase-care-cancel" onClick={onCancel}>稍後再做</button>
   </section>:<>

   {recent&&<div className="showcase-recent" role="status"><span>✓ 剛剛留下的回憶</span><b>{CARE_CHOICES.find(a=>a.id===recent.action)?.name}完成</b><p>{recent.action==='sleep'?`體力 ${recent.before?.energy??0} → ${recent.pet.energy}`:recent.action==='feed'?`飽食 ${recent.before?.hunger??0} → ${recent.pet.hunger}`:recent.action==='clean'?`清潔 ${recent.before?.clean??0} → ${recent.pet.clean}`:recent.first?`親密 +${recent.rewards.bond} · XP +${recent.rewards.exp}`:'今天的成長獎勵已領取，謝謝你繼續陪伴。'}</p>{recent.first&&<small>金幣 +{recent.rewards.coins} · 陪伴印記 +1</small>}</div>}
   <div className="showcase-tabs" aria-label="夥伴資訊"><button aria-pressed={panel==='status'} onClick={()=>setPanel('status')}>屬性總覽</button><button aria-pressed={panel==='story'} onClick={()=>setPanel('story')}>夥伴故事</button></div>
   {panel==='status'?<div className="showcase-stats"><div className="showcase-bond"><span>♡ 親密</span><strong>{selected.bond||0}<small> 點</small></strong></div>{[['hunger','飽食','◒'],['clean','清潔','✧'],['energy','體力','ϟ']].map(([key,label,icon])=><div className={`showcase-stat stat-${key}`} key={key}><span>{icon} {label}</span><b>{clamp(selected[key])}<small> / 100</small></b><progress aria-label={`${label}狀態`} max="100" value={clamp(selected[key])}/></div>)}<p className="showcase-daily">今日陪伴 <b>{Math.min(3,journey.today.length)} / 3</b><span>完成三種照顧，留下一份成長回憶。</span></p></div>:<div className="showcase-story"><span>OUR LITTLE STORY</span><h3>認識{def?.name}</h3><p>{def?.story||'一起學習，一起長大。每一次照顧，都會成為你們的回憶。'}</p><div>{(def?.words||[]).map(word=><span key={word}>{word}</span>)}</div></div>}
   <section className="ps-care-actions showcase-actions"><h3>一起做件小事</h3><div>{CARE_CHOICES.map(action=><button key={action.id} aria-label={action.name} onClick={()=>onCare(action.id)} title={action.hint}><span>{action.icon}</span><b>{action.name}</b>{journey.today.includes(action.id)&&<i aria-label="今天已完成">✓</i>}</button>)}</div><p>每天首次照顧可獲得成長獎勵。</p></section>
   </>}
  </aside>
 </section>;
}
