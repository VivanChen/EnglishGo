import { PET_PATHS, PET_HABITATS, getPetJourney, choosePetPath, choosePetHabitat } from '../data/petJourney.js';
import { PetHabitatScene } from './PetWorldArt.jsx';

export function PetHomeHub({pets,eggs,readyEggs,onCare,onEggs,onPlay,onNavigate,getDef}) {
  const pet=pets[0],def=pet&&getDef(pet),journey=getPetJourney(pet);
  return <section className="pet-home-hub">
    <div className="pet-home-hero"><PetHabitatScene pets={pets.length?pets:[{petId:'bunny',level:1}]} caption={pet?'每一點陪伴，都會留下成長的足跡':'一段友誼，從小小的蛋開始'}/><div className="pet-home-intro"><span className="pet-eyebrow">OUR LITTLE WORLD</span><h2>歡迎回到<br/>寵物小家園</h2><p>{pet?`${def?.name||'小夥伴'}正在等你。一起照顧、玩耍，再出發探險。`:'遇見新夥伴，用英文學習孵化，再一起建立屬於你們的小天地。'}</p><div className="pet-button-row"><button className="pet-primary" onClick={pet?()=>onCare(pet):onEggs}>{pet?'陪陪我的夥伴 →':eggs.length?'看看我的蛋 →':'從蛋倉開始 →'}</button>{pet&&<span className="pet-pill">陪伴印記 {journey.marks} 枚</span>}</div></div></div>
    <div className="pet-destination-grid">
      <button className="pet-destination" onClick={onEggs}><span className="pet-destination-icon">🥚</span><h3>孵化小屋</h3><p>{readyEggs?`${readyEggs} 顆蛋可以孵化`:`${eggs.length} 顆蛋 · 用學習暖暖牠`}</p><b>查看蛋倉 →</b></button>
      <button className="pet-destination" onClick={onPlay} disabled={!pets.length}><span className="pet-destination-icon">🧺</span><h3>夥伴遊樂園</h3><p>野餐接力、記憶尋寶<br/>一隻寵物就能出發</p><b>{pets.length?'一起玩三回合 →':'孵出第一隻寵物就能玩'}</b></button>
      {onNavigate&&<><button className="pet-destination" onClick={()=>onNavigate('petAdventure')}><span className="pet-destination-icon">⛺</span><h3>森林遠征</h3><p>組隊闖關、選擇補給<br/>讓培育的能力派上用場</p><b>準備探險 →</b></button><button className="pet-destination" onClick={()=>onNavigate('gacha')}><span className="pet-destination-icon">🌿</span><h3>森林扭蛋屋</h3><p>用學習金幣<br/>遇見新的小夥伴</p><b>去遇見朋友 →</b></button></>}
    </div>
    {onNavigate&&<button className="pet-board-link" onClick={()=>onNavigate('petMonopoly')}><span>🎲</span><div><b>想玩久一點？寵物大富翁</b><p>學單字、規劃金幣，和夥伴一起走遍學習島。</p></div><span>→</span></button>}
  </section>;
}

export function PetGrowthPanel({pet,onChange,onCare,careLabel,onPlay}) {
  const journey=getPetJourney(pet),path=PET_PATHS.find(p=>p.id===journey.path),needed=(pet.level||1)*100;
  return <section className="pet-growth-panel" data-testid="pet-growth-panel">
    <div className="pet-section-heading"><div><span className="pet-eyebrow">我們一起長大的故事</span><h2>{path.icon} {path.name}</h2><p>第 {journey.rank} 階 · {journey.next?`再累積 ${journey.next-journey.marks} 枚印記，能力就會提升`:'三階能力都練成了，繼續收藏陪伴的回憶'}</p></div><span className="pet-growth-count">{journey.marks}<small>陪伴印記</small></span></div>
    <div className="pet-growth-stops" aria-label="培育階段">{[3,6,12].map((n,i)=><div key={n} className={journey.marks>=n?'is-earned':''}><span>{journey.marks>=n?'✓':i+1}</span><b>{['初識默契','可靠夥伴','最佳拍檔'][i]}</b><small>{n} 枚印記</small></div>)}</div>
    <div className="pet-growth-tip">每天第一次完成每種照顧、每款遊戲或冒險，可留下一枚印記。<b>今天收集 {journey.today.length} 枚</b></div>
    <div className="pet-needs">{[{key:'hunger',label:'飽食',icon:'🍎'},{key:'clean',label:'清潔',icon:'🫧'},{key:'energy',label:'體力',icon:'⚡'}].map(item=><div key={item.key}><span>{item.icon} {item.label}</span><b>{Math.round(pet[item.key]??80)}<small>/100</small></b><div className="pet-meter"><i style={{width:`${Math.min(100,Math.max(0,pet[item.key]??80))}%`}}/></div></div>)}</div>
    <div className="pet-level-line"><b>Lv.{pet.level||1}</b><div className="pet-meter"><i style={{width:`${Math.min(100,(pet.exp||0)/needed*100)}%`}}/></div><span>{pet.exp||0}/{needed} XP</span><span>♡ {pet.bond||0}</span></div>
    <div className="pet-button-row"><button className="pet-primary" data-testid="pet-primary-care-action" onClick={onCare}>{careLabel||'一起讀書'} →</button><button className="pet-secondary" onClick={onPlay}>去遊樂園</button></div>
    <details className="pet-personality"><summary>培育方向與家園佈置</summary><p>可隨時換方向，印記會保留。能力會在下一次森林遠征生效。</p><div className="pet-path-grid">{PET_PATHS.map(item=><button key={item.id} className={`pet-path ${journey.path===item.id?'is-selected':''}`} aria-pressed={journey.path===item.id} onClick={()=>onChange(choosePetPath(pet,item.id))}><span>{item.icon}</span><b>{item.name}</b><small>{item.description}</small><p>{item.effect}</p></button>)}</div><h3>換個喜歡的風景</h3><div className="pet-habitat-options">{PET_HABITATS.map(h=><button key={h.id} aria-pressed={journey.habitat===h.id} disabled={journey.marks<h.marks} onClick={()=>onChange(choosePetHabitat(pet,h.id))}><PetHabitatScene pets={[]} theme={h.id} compact/><b>{h.name}</b><small>{journey.marks<h.marks?`${h.marks} 枚印記解鎖`:journey.habitat===h.id?'正在使用':'換上這個風景'}</small></button>)}</div></details>
  </section>;
}
