import PetPages from './PetPages.jsx';
import {useEffect,useRef,useState} from 'react';
import PetCharacterScene from './PetCharacterScene.jsx';
import PetCareStudio from './PetCareStudio.jsx';
import PetDisplayMode from './PetDisplayMode.jsx';
import {CARE_CHOICES,petNeed,completePetCare} from '../data/petCare.js';
import {getPetJourney} from '../data/petJourney.js';
import {getPetStage,PET_GROWTH_STAGES} from '../data/petAppearance.js';
import './pet-showcase.css';

export default function PetShowcase({pets,selected,getDef,rarities,onSelect,onCare,onDetails,motion,care,foods=[],inventory={},careReady,onReady,onCancel,onFinish,speak,stopSpeech,onShop,result}){
 const [touched,setTouched]=useState(false),[careInfo,setCareInfo]=useState(false);
 const root=useRef(null),previousCare=useRef(null);
 useEffect(()=>{if(careReady)root.current?.querySelector('.showcase-care-finish')?.focus({preventScroll:true})},[careReady]);
 useEffect(()=>{
  const action=care?.action;setCareInfo(false);
  if(CARE_CHOICES.map(choice=>choice.id).includes(action)){const selector=action==='study'?'.pc-study-next':action==='sleep'?'.pc-rest-action':action==='play'?'.pc-toss':action==='clean'?'.pc-spots button':care.foodId?'.pc-food':'.showcase-foods button, .showcase-empty-food button';root.current?.querySelector(selector)?.focus({preventScroll:true});}
  else if(CARE_CHOICES.map(choice=>choice.id).includes(previousCare.current)){root.current?.querySelector(`.showcase-actions button[aria-label="${CARE_CHOICES.find(choice=>choice.id===previousCare.current)?.name}"]`)?.focus({preventScroll:true});}
  previousCare.current=action;
 },[care?.action,care?.foodId]);
 const caring=care&&CARE_CHOICES.map(choice=>choice.id).includes(care.action), food=foods.find(f=>f.id===care?.foodId);
 const sleepPreview=care?.action==='sleep'?completePetCare(selected,'sleep'):null;
 const recent=result?.pet?.petId===selected.petId?result:null;
 const playPreview=care?.action==='play'?completePetCare(selected,'play'):null;
 const stage=getPetStage(selected),stageName=PET_GROWTH_STAGES.find(item=>item.id===stage).name;
 const journey=getPetJourney(selected),def=getDef(selected),clamp=n=>Math.round(Math.max(0,Math.min(100,n??80)));
 return <section ref={root} className={`pet-showcase ${careInfo?'shows-care-info':''} ${caring?'is-caring':''}`} aria-label="寵物星光展台" data-testid="pet-showcase">
  <header className="showcase-heading">
   <label className="showcase-picker">陪伴誰？<select aria-label="選擇陪伴夥伴" value={selected.petId} disabled={!!care} onChange={e=>{setTouched(false);onSelect(pets.find(p=>p.petId===e.target.value))}}>{pets.map(p=><option key={p.petId} value={p.petId}>{getDef(p)?.name||p.petId} · Lv.{p.level||1}</option>)}</select></label>
   <div className="showcase-header-tools">{!care&&<><button className="showcase-details-button" onClick={onDetails}>夥伴詳情</button><details className="showcase-view-options"><summary>畫面</summary><PetDisplayMode targetRef={root}/></details></>}</div>
  </header>
  <div className="showcase-center">
   <div className="showcase-rarity"><span>✦ {rarities[selected.rarity]?.label||selected.rarity}</span><small>陪伴印記 {journey.marks||0}</small></div>
   {caring&&(care.action!=='feed'||food)?<PetCareStudio key={`${selected.petId}:${care.action}:${care.foodId||''}`} petId={selected.petId} stage={stage} action={care.action} food={food} words={def?.words} prompt={care.prompt} speak={speak} stopSpeech={stopSpeech} onReady={onReady} motion={motion}/>:<PetCharacterScene petId={selected.petId} stage={stage} motion={motion} interactive={!caring} onPet={()=>setTouched(true)}/>}
   {!caring&&<div className="showcase-name"><small>{touched?'♡ 靠近一點，我喜歡你的陪伴。':'拖曳轉動視角 · 點一下摸摸牠'}</small><h3>{def?.name||selected.petId} <span>Lv.{selected.level||1} · {stageName}</span></h3><p>{petNeed(selected).label}</p></div>}
  </div>
  <aside className="showcase-panel">
   {caring?<section className="showcase-care-panel" aria-label="照顧操作"><button className="care-info-toggle" aria-pressed={careInfo} onClick={()=>setCareInfo(!careInfo)}>{careInfo?'返回照顧':'獎勵與英文'}</button><h3>{care.action==='study'?'一起翻開小書':care.action==='sleep'?'留一段安靜的晚安':care.action==='play'?'來玩接球吧':care.action==='feed'?'一起吃點好吃的':'泡泡洗澡時間'}</h3>
    {care.action==='feed'&&!food?<><p>挑一份食物，親手餵給{def?.name}。</p><PetPages paged={false} className="showcase-foods" label="餵食選擇">{foods.filter(f=>inventory[f.id]>0).map(f=><button key={f.id} aria-label={`選這份食物：${f.name}`} onClick={()=>onCare('feed',f.id)}><span>{f.emoji}</span><b>{f.name}<small>飽食 +{f.feed}</small></b><small>× {inventory[f.id]}</small></button>)}</PetPages>{!foods.some(f=>inventory[f.id]>0)&&<div className="showcase-empty-food"><p>食物盒空了，補充一份再回來。</p><button onClick={onShop}>去補食物 →</button></div>}</>:<><div className="care-explanation">{careInfo?<PetPages label="照顧說明">{care.action==='study'?<div className="showcase-care-preview"><span>今日讀書獎勵</span><b>XP +{completePetCare(selected,'study').rewards.exp}</b><small>{completePetCare(selected,'study').first?'完成並保存後獲得成長獎勵。':'今日獎勵已領取，仍可一起複習。'}</small></div>:sleepPreview?<div className="showcase-care-preview"><span>體力</span><b>{clamp(selected.energy)} → {clamp(sleepPreview.pet.energy)}</b><small>{sleepPreview.first?selected.energy>=100?'體力已滿，仍可留下一段晚安回憶。':'每日首次休息最多恢復 25 體力。':'今天已恢復過體力，這次安靜陪伴，不重複加成。'}</small></div>:playPreview?<div className="showcase-care-preview"><span>親密</span><b>{selected.bond||0} → {playPreview.pet.bond}</b><small>體力 {clamp(selected.energy)} → {clamp(playPreview.pet.energy)} · {playPreview.first?'今日首次玩耍獎勵':'今日獎勵已領取，這次不扣體力'}</small></div>:<div className="showcase-care-preview"><span>{care.action==='feed'?'飽食':'清潔'}</span><b>{clamp(selected[care.action==='feed'?'hunger':'clean'])} → {care.action==='feed'?Math.min(100,clamp(selected.hunger)+(food?.feed||0)):100}</b><small>完成後更新</small></div>}{care.action!=='study'&&<div className="showcase-care-english"><small>也可以說一句英文</small><blockquote>{care.prompt}</blockquote><button onClick={()=>speak?.(care.prompt)}>♫ 聽聽怎麼念</button></div>}<p className="showcase-care-note">{care.action==='study'?'讀完小書並夾上書籤後才可保存；途中取消不結算獎勵。':care.action==='sleep'?'完成晚安準備，再確認保存，才記錄恢復與成長獎勵。':care.action==='play'?'完成三回合後才結算；途中取消不扣體力。':care.action==='feed'?'完成時使用 1 份食物；取消不扣庫存。':'完成時才記錄清潔與成長獎勵。'}</p></PetPages>:<p>{careReady?'照顧完成！確認保存這次回憶。':'跟著畫面操作，完成後再保存。'}</p>}</div><button className="showcase-care-finish" data-testid="pet-action-complete" disabled={!careReady} onClick={onFinish}>{care.action==='sleep'?'保存晚安回憶 ✓':'完成照顧，收下回憶 ✓'}</button></>}
    <button className="showcase-care-cancel" onClick={onCancel}>稍後再做</button>
   </section>:<>

   {recent&&<div className="showcase-recent" role="status" data-testid="pet-care-result"><span>✓ 照顧完成</span><b>{CARE_CHOICES.find(a=>a.id===recent.action)?.name}完成</b><p>{recent.action==='sleep'?`體力 ${recent.before?.energy??0} → ${recent.pet.energy}`:recent.action==='feed'?`飽食 ${recent.before?.hunger??0} → ${recent.pet.hunger}`:recent.action==='clean'?`清潔 ${recent.before?.clean??0} → ${recent.pet.clean}`:recent.first?`親密 +${recent.rewards.bond} · XP +${recent.rewards.exp}`:'今天的成長獎勵已領取，謝謝你繼續陪伴。'}</p>{recent.first&&<small>金幣 +{recent.rewards.coins} · 陪伴印記 +1</small>}</div>}
   <div className="showcase-stats">{[['hunger','飽食','◒'],['clean','清潔','✧'],['energy','體力','ϟ']].map(([key,label,icon])=><div className={`showcase-stat stat-${key}`} key={key}><span>{icon} {label}</span><b>{clamp(selected[key])}<small> / 100</small></b><progress aria-label={`${label}狀態`} max="100" value={clamp(selected[key])}/></div>)}</div>
   {!recent&&<p className="showcase-next" role="status">{petNeed(selected).icon} {petNeed(selected).label}</p>}
   <section className="ps-care-actions showcase-actions"><h3>一起做件小事</h3><div>{CARE_CHOICES.map(action=><button key={action.id} data-testid={action.id===petNeed(selected).action?'pet-primary-care-action':undefined} className={action.id===petNeed(selected).action?'is-suggested':''} aria-label={action.name} onClick={()=>onCare(action.id)} title={action.hint}><span>{action.icon}</span><b>{action.name}</b>{journey.today.includes(action.id)&&<i aria-label="今天已完成">✓</i>}</button>)}</div><p>每天首次照顧可獲得成長獎勵。</p></section>
   </>}
  </aside>
 </section>;
}
