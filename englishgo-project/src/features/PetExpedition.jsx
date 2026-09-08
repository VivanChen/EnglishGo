import { useEffect, useRef, useState } from 'react';
import PetCompanion from '../components/PetCompanion.jsx';
import { PetHabitatScene, PetLandscape } from '../components/PetWorldArt.jsx';
import { applyCampChoice, CAMP_CHOICES, getJourneyBonus, recordPetMoment } from '../data/petJourney.js';
import { completePetCare, refreshPetCare } from '../data/petCare.js';
import './pet-expedition.css';

const readSaved = key => { try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; } };
const writeSaved = (key, value) => { try { value ? localStorage.setItem(key, JSON.stringify(value)) : localStorage.removeItem(key); return true; } catch { return false; } };
const clamp = value => Math.max(0, Math.min(100, Math.round(value ?? 80)));

export function expeditionStorageKey(account, level) {
  return `englishgo_pet_expedition_v2:${account?.username ? `account:${encodeURIComponent(account.username)}` : 'local'}:${level || 'elementary'}`;
}

function validSession(value, pets) {
  if (!value || value.version !== 2) return null;
  // Receipts only display an already applied reward. Restoring one never awards it again.
  if (value.result?.settled && Array.isArray(value.result.growth)) return { ...value, phase: 'result' };
  const { run, battle } = value;
  if (!run?.team?.length || !run.team.every(p => pets.some(owned => owned.petId === p.petId)) || !Array.isArray(run.stages) || !Number.isInteger(battle?.stageIndex) || !run.stages[battle.stageIndex]?.questions?.length) return null;
  return value;
}

function Meter({ label, value, max = 100, danger = false }) {
  return <div className={`exp-meter ${danger ? 'is-danger' : ''}`}><div><span>{label}</span><b>{Math.max(0, Math.round(value))}/{Math.round(max)}</b></div><div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={Math.max(0, Math.round(value))}><i style={{ width: `${Math.max(0, Math.min(100, value / max * 100))}%` }} /></div></div>;
}

export default function PetExpedition({ lv, onBack, onNavigate, pets, setPets, setCoins, inventory, setInventory, petAccount, incrTask, api }) {
  const { Hdr, PET_ADVENTURE_BOSS_REQUIRED_CLEARS, PET_ADVENTURE_ENEMY_ICONS, PET_ADVENTURE_SKILLS, PET_FOODS, buildPetAdventureStages, choosePetFoodForNeed, completePetAdventureProgress, createPetAdventureBgm, getAdventureAnswerLine, getAdventureCorrectSpeech, getAdventurePetDef, getAdventureQuestionMeta, getAdventureQuestionSpeech, getPetAdventureDifficulty, getPetAdventureFatigue, getPetAdventurePower, getPetAdventureProgress, getPetAdventureScore, getPetAdventureSkillCards, getPetReadiness, getPetStage, getSelectedPetAdventureSkill, getTeamAdventureMorale, improvePetAfterAdventure, isPetAdventureBossReady, loadPetAdventureQuestions, playPetAdventureSkillSound, playSound, savePetAdventureProgress, speak, stopSpeech } = api;
  const key = expeditionStorageKey(petAccount, lv);
  const [session, setSession] = useState(() => validSession(readSaved(key), pets));
  const [step, setStep] = useState('team');
  const [selectedIds, setSelectedIds] = useState(() => pets.filter(p => getAdventurePetDef(p)).slice(0, 1).map(p => p.petId));
  const [skillLoadout, setSkillLoadout] = useState({});
  const [skillId, setSkillId] = useState(null);
  const [notice, setNotice] = useState('');
  const [starting, setStarting] = useState(false);
  const [exitOpen, setExitOpen] = useState(false);
  const [audioOn, setAudioOn] = useState(() => readSaved('englishgo_expedition_music') === true);
  const [progress, setProgress] = useState(() => readSaved(`${key}:progress`) || (petAccount ? { clears: 0, bossCharge: 0, bossesDefeated: 0 } : getPetAdventureProgress(lv)));
  const lock = useRef(false), finishLock = useRef(Boolean(session?.result)), alive = useRef(true), current = useRef(session), bgm = useRef(null), speechTimer = useRef(null);
  const availablePets = pets.filter(p => getAdventurePetDef(p));
  const selectedPets = availablePets.filter(p => selectedIds.includes(p.petId));
  const team = session?.run?.team || selectedPets;
  const run = session?.run, battle = session?.battle, feedback = session?.feedback;
  const bossReady = isPetAdventureBossReady(progress), difficulty = getPetAdventureDifficulty(progress, bossReady);
  const lowEnergy = selectedPets.filter(p => clamp(p.energy) < 20);
  const clearSpeech = () => { clearTimeout(speechTimer.current); stopSpeech?.(); };
  const commit = value => {
    current.current = value;
    setSession(value);
    if (!writeSaved(key, value)) setNotice('這台裝置暫時無法儲存進度，請保持本頁開啟。');
  };
  useEffect(() => { alive.current = true; return () => { alive.current = false; clearTimeout(speechTimer.current); stopSpeech?.(); bgm.current?.stop?.(); }; }, []);
  useEffect(() => { setPets(previous => previous.map(pet => refreshPetCare(pet))); }, []);
  useEffect(() => {
    if (!/jsdom/i.test(navigator.userAgent)) window.scrollTo({ top: 0, behavior: 'instant' });
  }, [step, session?.phase, battle?.stageIndex, battle?.questionIndex]);
  useEffect(() => {
    bgm.current?.stop?.(); bgm.current = null;
    if (audioOn && session?.phase === 'battle' && !session?.result && !exitOpen) bgm.current = createPetAdventureBgm({ boss: !!run?.stages[battle?.stageIndex]?.boss, difficulty: run?.difficultyLevel || 1 });
    return () => { bgm.current?.stop?.(); bgm.current = null; };
  }, [audioOn, session?.phase, battle?.stageIndex, !!session?.result, exitOpen]);
  useEffect(() => {
    const pause = () => { if (document.hidden) { clearSpeech(); bgm.current?.stop?.(); if (current.current?.run && !current.current?.result) setExitOpen(true); } };
    document.addEventListener('visibilitychange', pause);
    return () => document.removeEventListener('visibilitychange', pause);
  }, []);
  useEffect(() => {
    if (!exitOpen) return;
    const close = event => {
      if (event.key === 'Escape') setExitOpen(false);
      if (event.key !== 'Tab') return;
      const buttons = [...document.querySelectorAll('.exp-dialog button:not(:disabled)')];
      if (!buttons.length) return;
      const first = buttons[0], last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', close);
    return () => document.removeEventListener('keydown', close);
  }, [exitOpen]);
  const togglePet = id => {
    if (starting) return;
    setNotice('');
    setSelectedIds(ids => ids.includes(id) ? ids.filter(value => value !== id) : ids.length < 3 ? [...ids, id] : ids);
  };
  const prepareTeam = () => {
    if (lock.current || starting) return;
    lock.current = true;
    const nextInventory = { ...inventory }, now = new Date().toISOString();
    let fed = 0, cleaned = 0, missing = 0, careCoins = 0;
    const nextPets = pets.map(p => {
      if (!selectedIds.includes(p.petId)) return p;
      let next = { ...p }, changed = false;
      if (clamp(next.hunger) < 80) {
        const food = choosePetFoodForNeed(next, nextInventory);
        if (food && (nextInventory[food.id] || 0) > 0) {
          nextInventory[food.id]--;
          const completed = completePetCare(next, 'feed', food);
          next = completed.pet; careCoins += completed.rewards.coins; fed++; changed = true;
        } else missing++;
      }
      if (clamp(next.clean) < 75 || next.poops?.length) {
        const completed = completePetCare(next, 'clean');
        next = completed.pet; careCoins += completed.rewards.coins; cleaned++; changed = true;
      }
      // Preparation uses real food and washing. Energy recovers through the care flow.
      return changed ? improvePetAfterAdventure({ ...next, lastUpdate: now }, { exp: 0, bond: 0 }) : p;
    });
    if (fed || cleaned) {
      setPets(nextPets); setInventory(nextInventory); if (careCoins) setCoins(previous => previous + careCoins);
      for (let i = 0; i < fed; i++) incrTask?.('feedToday');
      for (let i = 0; i < cleaned; i++) incrTask?.('cleanToday');
      playSound?.('good');
    }
    setNotice(`${fed || cleaned ? `已餵食 ${fed} 位、清潔 ${cleaned} 位。${careCoins ? `今日照顧獎勵 +${careCoins} 金幣。` : ''}` : '已檢查隊伍。'}${missing ? `${missing} 位需要食物，請回樂園補充。` : ''}${lowEnergy.length ? '體力不足的夥伴需要先休息。' : ''}`);
    queueMicrotask(() => { lock.current = false; });
  };
  const start = async () => {
    if (lock.current || !selectedPets.length || lowEnergy.length) return;
    lock.current = true; setStarting(true); setNotice('');
    try {
      const questionData = await loadPetAdventureQuestions();
      if (!alive.current) return;
      const stages = buildPetAdventureStages(selectedPets, lv, { bossReady, difficultyLevel: difficulty, questionData });
      if (!stages?.length || stages.some(stage => !stage.questions?.length || stage.questions.some(q => !Array.isArray(q.choices) || !Number.isInteger(q.answer) || !q.choices[q.answer]))) throw new Error('Missing questions');
      const power = selectedPets.reduce((sum, p) => sum + getPetAdventurePower(p), 0), morale = getTeamAdventureMorale(selectedPets), talent = getJourneyBonus(selectedPets);
      const maxTeamHp = Math.round((150 + power * .85) * morale.hpMult) + talent.hp;
      finishLock.current = false; setSkillId(null);
      commit({ version: 2, phase: 'battle', run: { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, team: selectedPets.map(p => ({ ...p })), stages, teamPower: power, morale, talent, hasBoss: bossReady, difficultyLevel: difficulty, progress, skillLoadout: Object.fromEntries(selectedPets.map(p => [p.petId, getSelectedPetAdventureSkill(p, skillLoadout).id])) }, battle: { stageIndex: 0, questionIndex: 0, teamHp: maxTeamHp, maxTeamHp, enemyHp: stages[0].maxHp, answered: 0, correct: 0, miss: 0 }, feedback: null });
      playSound?.('flip');
    } catch { if (alive.current) setNotice('森林路線還沒準備好，請再試一次。你的金幣與道具沒有扣除。'); }
    finally { lock.current = false; if (alive.current) setStarting(false); }
  };
  const battleSkill = pet => getPetAdventureSkillCards(pet).find(card => card.unlocked && card.skill.id === skillId)?.skill || getSelectedPetAdventureSkill(pet, run?.skillLoadout || {});
  const settle = (won, finalBattle, retired = false) => {
    if (finishLock.current || !run) return current.current?.result;
    // A win is valid only when the last enemy is defeated and the team remains standing.
    if (won && !(finalBattle.stageIndex === run.stages.length - 1 && finalBattle.enemyHp <= 0 && finalBattle.teamHp > 0)) return null;
    finishLock.current = true; clearSpeech(); bgm.current?.stop?.();
    const alreadySaved = readSaved(key);
    if (alreadySaved?.run?.id === run.id && alreadySaved.result?.settled) return alreadySaved.result;
    const bossWin = won && run.hasBoss, multiplier = won ? run.morale.rewardMult || 1 : 1;
    const earned = !retired && (won || finalBattle.correct > 0);
    const food = earned ? PET_FOODS[Math.floor(Math.random() * PET_FOODS.length)] : null;
    const reward = { settled: true, won, retired, bossWin, answered: finalBattle.answered, correct: finalBattle.correct, stageCount: run.stages.length, cleared: finalBattle.stageIndex + Number(finalBattle.enemyHp <= 0), coins: earned ? Math.round((won ? bossWin ? 260 + run.difficultyLevel * 45 + team.length * 25 : 90 + run.difficultyLevel * 18 + team.length * 12 : 18) * multiplier) : 0, exp: earned ? Math.round((won ? bossWin ? 170 : 105 : 25) * multiplier) : 0, bond: earned ? won ? bossWin ? 32 : 18 : 4 : 0, food, foodCount: earned ? won ? bossWin ? 6 + Math.min(4, Math.floor(run.difficultyLevel / 2)) : 3 : 1 : 0, fatigue: finalBattle.answered > 0 ? getPetAdventureFatigue({ won, bossWin }) : { hunger: 0, clean: 0, energy: 0 } };
    const pool = Object.values(PET_ADVENTURE_SKILLS).filter(skill => team.some(p => !getPetAdventureSkillCards(p).some(card => card.skill.id === skill.id && card.unlocked)));
    const skill = won && !bossWin && pool.length && Math.random() < .35 ? pool[Math.floor(Math.random() * pool.length)] : null;
    const receiver = skill && team.find(p => !getPetAdventureSkillCards(p).some(card => card.skill.id === skill.id && card.unlocked));
    reward.skill = receiver ? { ...skill, receiverName: getAdventurePetDef(receiver)?.name } : null;
    const updatePet = p => improvePetAfterAdventure(won ? recordPetMoment(p, 'adventure') : p, { exp: reward.exp, bond: reward.bond, skillId: receiver?.petId === p.petId ? skill.id : null, fatigue: reward.fatigue });
    reward.growth = pets.filter(p => team.some(member => member.petId === p.petId)).map(p => { const next = updatePet(p); return { petId: p.petId, name: getAdventurePetDef(p)?.name || p.petId, fromLevel: p.level || 1, toLevel: next.level || 1, readiness: getPetReadiness(next) }; });
    if (reward.coins) setCoins(value => value + reward.coins);
    if (food) setInventory(value => ({ ...value, [food.id]: (value[food.id] || 0) + reward.foodCount }));
    setPets(previous => previous.map(p => team.some(member => member.petId === p.petId) ? updatePet(p) : p));
    const nextProgress = completePetAdventureProgress(run.progress, won, run.hasBoss);
    writeSaved(`${key}:progress`, nextProgress); setProgress(nextProgress);
    if (!petAccount) savePetAdventureProgress(lv, nextProgress);
    playSound?.(won ? 'combo' : 'good');
    return reward;
  };
  const answer = choiceIndex => {
    const active = current.current;
    if (lock.current || active?.phase !== 'battle' || active.feedback || active.result || exitOpen) return;
    lock.current = true;
    const stage = run.stages[battle.stageIndex], q = stage.questions[battle.questionIndex % stage.questions.length];
    if (!Number.isInteger(choiceIndex) || !q.choices[choiceIndex]) { lock.current = false; return; }
    const correct = choiceIndex === q.answer, attacker = team[battle.answered % team.length], skill = battleSkill(attacker);
    const skills = team.map(p => p.petId === attacker.petId ? skill : getSelectedPetAdventureSkill(p, run.skillLoadout));
    const skillPower = skills.reduce((sum, item) => sum + (item?.power || 0), 0);
    const next = { ...battle, answered: battle.answered + 1, correct: battle.correct + Number(correct), miss: battle.miss + Number(!correct) };
    let damage, heal = 0;
    if (correct) {
      const opening = skill.id === 'quickStep' && battle.questionIndex === 0 ? 14 : 0, word = skill.id === 'wordSpark' && /word|means|單字|意思/i.test(`${q.q} ${q.zh}`) ? 12 : 0, magic = skill.id === 'magicLeaf' ? 8 : 0;
      damage = Math.max(12, Math.round(30 + run.teamPower * .18 + skillPower * .45 + skill.power * 1.7 + opening + word + magic + (run.morale.damageBonus || 0) + run.talent.damage + (battle.campDamage || 0) + Math.random() * 10));
      heal = Math.min(battle.maxTeamHp - battle.teamHp, skills.some(s => s.id === 'melodyHeal') ? 18 : 10);
      next.enemyHp = Math.max(0, battle.enemyHp - damage); next.teamHp += heal;
    } else {
      damage = Math.max(6, stage.attack - (skills.some(s => s.id === 'braveGuard') ? 8 : 0) - run.talent.guard - (battle.campGuard || 0));
      next.teamHp = Math.max(0, battle.teamHp - damage);
    }
    const stageClear = next.enemyHp <= 0, won = stageClear && next.stageIndex === run.stages.length - 1, finished = won || next.teamHp <= 0;
    const result = finished ? settle(won, next) : null;
    commit({ ...active, battle: next, feedback: { correct, choiceIndex, damage, heal, stageClear, attackerId: attacker.petId, skill, answerLine: getAdventureAnswerLine(q), answerSpeech: getAdventureCorrectSpeech(q), tip: q.tip }, result });
    if (!finished) playPetAdventureSkillSound?.(skill.id, correct);
    clearSpeech(); speechTimer.current = setTimeout(() => { if (alive.current) speak?.(getAdventureCorrectSpeech(q)); }, 350);
  };
  const advance = () => {
    const active = current.current;
    if (!active?.feedback) return;
    clearSpeech(); setSkillId(null);
    if (active.result) { commit({ ...active, phase: 'result' }); return; }
    if (active.feedback.stageClear) { commit({ ...active, phase: 'camp' }); return; }
    commit({ ...active, battle: { ...active.battle, questionIndex: active.battle.questionIndex + 1 }, feedback: null });
    lock.current = false;
  };
  const chooseCamp = choice => {
    const active = current.current;
    if (active?.phase !== 'camp' || !CAMP_CHOICES.some(item => item.id === choice)) return;
    // Commit synchronously so a second click cannot apply another camp choice or skip a stage.
    const next = applyCampChoice(active.battle, choice, active.run.stages[active.battle.stageIndex + 1]);
    if (next === active.battle) return;
    commit({ ...active, phase: 'battle', battle: next, feedback: null });
    setSkillId(null); lock.current = false; playSound?.('good');
  };
  const reset = () => { clearSpeech(); commit(null); setStep('team'); setNotice(''); setExitOpen(false); lock.current = false; finishLock.current = false; };
  const leave = () => { clearSpeech(); if (session?.run && !session.result) setExitOpen(true); else onBack(); };
  const viewPhase = session?.phase === 'result' ? 3 : session ? 2 : step === 'prepare' ? 1 : 0;
  const result = session?.result;
  const pageHeader = <><Hdr t="🗺️ 寵物冒險" onBack={leave} cl="var(--pet-leaf)" /><ol className="exp-stepper" aria-label="冒險流程">{['選夥伴', '行前準備', '森林探索', '帶回收穫'].map((label, index) => <li key={label} aria-current={viewPhase === index ? 'step' : undefined} className={viewPhase > index ? 'is-done' : ''}><span>{viewPhase > index ? '✓' : index + 1}</span>{label}</li>)}</ol></>;
  const noticeView = notice && <p className="exp-notice" role="status">{notice}</p>;
  const portrait = (pet, size = 80) => <PetCompanion petId={pet.petId} stage={getPetStage(pet)} size={size} animate={false} />;
  const goCare = () => { reset(); if (onNavigate) onNavigate('pets', 'pets'); else onBack(); };

  if (session?.phase === 'result' && result) return <div className="pet-world pet-expedition">{pageHeader}
    <section className="exp-result"><PetHabitatScene pets={team} theme={result.won ? 'meadow' : 'camp'} compact celebrate={result.won} /><div className="exp-result-copy"><span className="pet-eyebrow">這一段旅程，收進回憶裡</span><h2>{result.won ? '一起走完森林了！' : result.retired ? '今天先平安回家' : '休息後，再來試試'}</h2><p>走完 {result.cleared}/{result.stageCount} 個地點，答對 {result.correct}/{result.answered} 題。{result.won ? '每位夥伴都更有默契了。' : '看過的正解，都是下一次的力量。'}</p><span className="exp-saved">✓ 成果已儲存{result.coins > 0 ? '，獎勵已放入背包' : ''}</span></div></section>
    <section className="exp-rewards" aria-label="冒險獎勵"><div><span>金幣</span><strong>+{result.coins}</strong></div><div><span>每位夥伴經驗</span><strong>+{result.exp} XP</strong></div><div><span>每位夥伴親密</span><strong>+{result.bond}</strong></div>{result.food && <div><span>{result.food.emoji} {result.food.name}</span><strong>×{result.foodCount}</strong></div>}</section>
    {result.skill && <p className="exp-notice">{result.skill.receiverName} 學會了 {result.skill.emoji} {result.skill.zh}！</p>}
    <section className="exp-card"><h3>回家後，照顧一下夥伴</h3><p className="pet-note">本次消耗：飽食 −{result.fatigue.hunger}、清潔 −{result.fatigue.clean}、體力 −{result.fatigue.energy}。下次出發前會重新確認狀態。</p><div className="exp-growth">{result.growth.map(p => <div key={p.petId}><b>{p.name}</b><span>Lv.{p.fromLevel}{p.toLevel > p.fromLevel ? ` → ${p.toLevel}` : ''}</span><small>{p.readiness.label}</small></div>)}</div>{result.won && <p className="pet-note">{isPetAdventureBossReady(progress) ? '森林守護者已出現，下次遠征會增加守護者關卡。' : `守護者足跡 ${progress.bossCharge || 0}/${PET_ADVENTURE_BOSS_REQUIRED_CLEARS}：每完成一趟遠征累積一次。`}</p>}</section>
    {noticeView}<div className="exp-actions"><button className="pet-secondary" onClick={reset}>重新選隊</button><button className="pet-primary" onClick={goCare}>回家照顧夥伴 →</button></div></div>;

  if (run && battle) {
    const stage = run.stages[battle.stageIndex], question = stage.questions[battle.questionIndex % stage.questions.length], meta = getAdventureQuestionMeta(question);
    const activePet = team.find(p => p.petId === feedback?.attackerId) || team[battle.answered % team.length], activeSkill = feedback?.skill || battleSkill(activePet);
    return <div className="pet-world pet-expedition">{pageHeader}
      <div className="exp-toolbar"><span>{session.phase === 'camp' ? '營地休息' : `地點 ${battle.stageIndex + 1}/${run.stages.length}`} · {stage.zh}</span><button className="exp-text-button" aria-pressed={audioOn} onClick={() => { setAudioOn(!audioOn); writeSaved('englishgo_expedition_music', !audioOn); }}>♫ 音樂{audioOn ? '開' : '關'}</button></div>
      <ol className="exp-route" aria-label="森林路線">{run.stages.map((item, index) => <li key={item.id} aria-current={index === battle.stageIndex ? 'location' : undefined} className={index < battle.stageIndex ? 'is-done' : ''}><span>{index < battle.stageIndex ? '✓' : item.boss ? '♛' : index + 1}</span><b>{item.zh}</b></li>)}</ol>
      <div inert={exitOpen ? '' : undefined}>
      {session.phase === 'camp' ? <section className="exp-camp" data-testid="pet-camp"><PetHabitatScene pets={team} theme="camp" compact /><div className="exp-card"><span className="pet-eyebrow">地點 {battle.stageIndex + 1} 已完成</span><h2>在營火邊，喘口氣</h2><p>下一站是「{run.stages[battle.stageIndex + 1]?.zh}」。選一份免費補給，再一起前進。</p><Meter label="隊伍生命" value={battle.teamHp} max={battle.maxTeamHp} /><div className="exp-camp-options">{CAMP_CHOICES.map(choice => <button key={choice.id} data-camp-choice={choice.id} onClick={() => chooseCamp(choice.id)}><span>{choice.icon}</span><b>{choice.name}</b><small>{choice.id === 'rest' ? `回復 ${Math.min(battle.maxTeamHp - battle.teamHp, Math.ceil(battle.maxTeamHp * .25))} 生命（上限的 25%）` : choice.description}</small><em>選這份補給 →</em></button>)}</div><p className="pet-note">營地補給只影響這趟遠征；回家後，寵物仍需要吃飯與休息。</p></div></section> : <div className="exp-battle-layout" data-pet-adventure-layout>
        <section className="exp-challenge exp-card" data-adventure-question><div className="exp-question-label"><span>{meta?.label || '英文挑戰'} · 第 {battle.answered + (feedback ? 0 : 1)} 題</span><button className="exp-text-button" data-adventure-question-audio aria-label="朗讀完整題目" onClick={() => speak?.(getAdventureQuestionSpeech(question))}>🔊 聽題目</button></div><h2 data-adventure-question-prompt>{question.q}</h2><p data-adventure-question-zh>{question.zh}</p><div className="exp-answers" data-adventure-answers>{question.choices.map((choice, index) => <button key={`${index}-${choice}`} disabled={!!feedback} onClick={() => answer(index)} className={feedback ? index === question.answer ? 'is-correct' : feedback.choiceIndex === index ? 'is-wrong' : '' : ''}><span>{String.fromCharCode(65 + index)}</span><b>{choice}</b>{feedback && index === question.answer && <em>✓ 正解</em>}{feedback && index === feedback.choiceIndex && index !== question.answer && <em>再記一次</em>}</button>)}</div>
          {feedback && <div className={`exp-feedback ${feedback.correct ? 'is-correct' : ''}`} data-adventure-feedback role="status"><strong data-adventure-feedback-result>{feedback.correct ? `答對了！${feedback.stageClear ? '這個地點完成了。' : '夥伴向前一步。'}` : '先看懂正解，再一起前進。'}</strong><div data-adventure-answer-line><b data-adventure-answer-text>{feedback.answerLine}</b><button className="exp-text-button" aria-label="朗讀完整正解" onClick={() => speak?.(feedback.answerSpeech)}>🔊</button></div>{feedback.tip && <p>{feedback.tip}</p>}<small>{feedback.correct ? `造成 ${feedback.damage} 傷害${feedback.heal ? `，回復 ${feedback.heal} 生命` : ''}` : `隊伍生命 −${feedback.damage}`}</small><button className="pet-primary" data-adventure-feedback-action onClick={advance}>{result ? '查看冒險成果 →' : feedback.stageClear ? '前往營地補給 →' : '下一題 →'}</button></div>}
        </section>
        <aside className="exp-battle-side" data-pet-adventure-controls><div className="exp-scene" data-pet-adventure-battle data-pet-adventure-arena><PetLandscape theme={stage.boss ? 'camp' : 'meadow'} /><div className="exp-scene-enemy" data-adventure-enemy><span>{PET_ADVENTURE_ENEMY_ICONS[stage.id] || '🌿'}</span><b>{stage.enemyZh || stage.enemy}</b></div><div className="exp-scene-party" data-adventure-team>{team.map(p => <div key={p.petId} className={p.petId === activePet.petId ? 'is-active' : ''}>{portrait(p, team.length > 2 ? 64 : 84)}</div>)}</div><span className="exp-scene-caption" data-adventure-dialog>{getAdventurePetDef(activePet)?.name}，這題交給你！</span></div><div className="exp-card exp-vitals" data-adventure-status><Meter label="隊伍生命" value={battle.teamHp} max={battle.maxTeamHp} /><Meter label={stage.boss ? '守護者生命' : '關卡生命'} value={battle.enemyHp} max={stage.maxHp} danger /><p className="pet-note">答對 {battle.correct} 題 · 答錯 {battle.miss} 題</p></div>
          <details className="exp-skills exp-card" data-adventure-skill-hand><summary>{activeSkill.emoji} {activeSkill.zh} <small>目前技能 · 可更換</small></summary><p className="pet-note">技能已自動裝備，直接答題就會使用。</p><div className="exp-skill-options" data-adventure-skill-grid>{getPetAdventureSkillCards(activePet).filter(card => card.unlocked).map(card => <button key={card.skill.id} disabled={!!feedback} aria-pressed={activeSkill.id === card.skill.id} onClick={() => setSkillId(card.skill.id)}><b>{card.skill.emoji} {card.skill.zh}</b><small>{card.skill.desc}</small></button>)}</div></details>
        </aside></div>}
      </div>{noticeView}
      {exitOpen && <div className="exp-dialog-backdrop"><section className="exp-dialog" role="dialog" aria-modal="true" aria-labelledby="exp-exit-title"><span className="pet-eyebrow">冒險暫停中</span><h2 id="exp-exit-title">夥伴在這裡等你</h2><p>目前的隊伍、題目和營地選擇會保存在這台裝置。回來就能接著走。</p><div className="exp-actions"><button autoFocus className="pet-primary" onClick={() => setExitOpen(false)}>繼續冒險</button><button className="pet-secondary" onClick={() => { clearSpeech(); onBack(); }}>保存進度，回樂園</button></div><button className="exp-text-button" onClick={() => { const reward = settle(false, battle, true); if (reward) commit({ ...session, result: reward, phase: 'result' }); setExitOpen(false); }}>結束這趟遠征（不領獎勵）</button></section></div>}
    </div>;
  }

  const morale = selectedPets.length ? getTeamAdventureMorale(selectedPets) : null;
  const needsFood = selectedPets.filter(p => clamp(p.hunger) < 80).length, needsClean = selectedPets.filter(p => clamp(p.clean) < 75 || p.poops?.length).length;
  return <div className="pet-world pet-expedition">{pageHeader}
    <section className="exp-hero"><div><span className="pet-eyebrow">FOREST EXPEDITION</span><h2>{step === 'team' ? '和夥伴，走進森林' : '背包準備好了嗎？'}</h2><p>{step === 'team' ? '帶 1–3 位夥伴，用英文解開路上的挑戰。每個地點之間，都有一座可以歇腳的小營地。' : '吃飽、洗乾淨，看看今天的體力。照顧得越好，旅程越有精神。'}</p><div className="exp-hero-tags"><span>{bossReady ? '3 個地點＋守護者' : '3 個森林地點'}</span><span>免費出發</span><span>進度自動保存</span></div></div><PetHabitatScene pets={selectedPets.length ? selectedPets : availablePets.slice(0, 3)} theme="pond" compact /></section>
    {!availablePets.length ? <section className="exp-card exp-empty"><span>🥚</span><h3>先迎接第一位小夥伴</h3><p>孵出一位寵物，就可以一起探索森林。</p><button className="pet-primary" onClick={() => onNavigate ? onNavigate('pets', 'eggs') : onBack()}>去孵化小屋 →</button></section> : step === 'team' ? <>
      <div className="exp-section-title"><div><h3>今天和誰一起出發？</h3><p>已選 {selectedPets.length}/3 位。只有一位，也可以出發。</p></div><button className="pet-secondary" onClick={() => { setSelectedIds([...availablePets].sort((a, b) => getPetAdventureScore(b) - getPetAdventureScore(a)).slice(0, 3).map(p => p.petId)); setNotice('已依照狀態與戰力選好隊伍，你也可以再調整。'); }}>幫我選隊</button></div>
      <div className="exp-team-grid">{availablePets.map(pet => { const selected = selectedIds.includes(pet.petId), ready = getPetReadiness(pet), def = getAdventurePetDef(pet); return <button key={pet.petId} className="exp-pet-card" data-expedition-pet={pet.petId} aria-pressed={selected} disabled={!selected && selectedPets.length >= 3} onClick={() => togglePet(pet.petId)}><span className="exp-pet-check">{selected ? '✓ 已選' : '＋ 邀請'}</span><div className="exp-pet-portrait">{portrait(pet, 110)}</div><h3>{pet.nickname || def.name}</h3><span>Lv.{pet.level || 1} · {ready.label}</span><small>體力 {clamp(pet.energy)} · 飽食 {clamp(pet.hunger)}</small></button>; })}</div>{noticeView}<div className="exp-actions"><span>下一步：確認照顧狀態與技能</span><button className="pet-primary" disabled={!selectedPets.length} onClick={() => { setStep('prepare'); setNotice(''); }}>選好夥伴，下一步 →</button></div>
    </> : <>
      <div className="exp-prep-grid"><section className="exp-card"><div className="exp-section-title"><h3>夥伴的行前檢查</h3><button className="exp-text-button" disabled={starting} onClick={() => { setStep('team'); setNotice(''); }}>調整隊伍</button></div><div className="exp-care-list">{selectedPets.map(pet => <div key={pet.petId} className="exp-care-row"><div>{portrait(pet, 62)}<b>{getAdventurePetDef(pet)?.name}</b></div><div className="exp-care-meters"><Meter label="飽食" value={clamp(pet.hunger)} /><Meter label="清潔" value={clamp(pet.clean)} /><Meter label="體力" value={clamp(pet.energy)} danger={clamp(pet.energy) < 20} /></div></div>)}</div>{(needsFood > 0 || needsClean > 0) && <><p className="pet-note">需要餵食 {needsFood} 位、清潔 {needsClean} 位。餵食會使用背包食物，每位最多一份。</p><button className="pet-secondary" disabled={starting} onClick={prepareTeam}>餵食與清潔</button></>}{lowEnergy.length > 0 && <p className="exp-notice">{lowEnergy.map(p => getAdventurePetDef(p)?.name).join('、')} 的體力不足 20，需要先回家休息，或換一位夥伴。</p>}{noticeView}</section>
        <aside className="exp-card exp-plan"><span className="pet-eyebrow">這次的小旅行</span><h3>{bossReady ? '尋找森林守護者' : '森林探索'}</h3><p>難度 Lv.{difficulty} · {bossReady ? 4 : 3} 個地點</p><ol><li>答對英文，夥伴自動使用技能。</li><li>走完一個地點，選一份營地補給。</li><li>完成全程，金幣與食物自動入帳。</li></ol><span className="exp-saved">{morale?.emoji} 隊伍狀態：{morale?.label}</span><p className="pet-note">{bossReady ? '最後會多一關守護者挑戰，獎勵也更豐富。' : `守護者足跡 ${progress.bossCharge || 0}/${PET_ADVENTURE_BOSS_REQUIRED_CLEARS}，每完成一趟增加一次。`}</p><p className="pet-note">遠征結束會消耗寵物體力；營地生命與日常體力分開計算。</p></aside></div>
      <details className="exp-card exp-skills"><summary>夥伴的技能 <small>已自動裝備，可直接出發</small></summary><div className="exp-loadouts">{selectedPets.map(pet => { const skill = getSelectedPetAdventureSkill(pet, skillLoadout); return <fieldset key={pet.petId}><legend>{getAdventurePetDef(pet)?.name} · {skill.emoji} {skill.zh}</legend><div className="exp-skill-options">{getPetAdventureSkillCards(pet).filter(card => card.unlocked).map(card => <button key={card.skill.id} disabled={starting} aria-pressed={skill.id === card.skill.id} onClick={() => setSkillLoadout(previous => ({ ...previous, [pet.petId]: card.skill.id }))}><b>{card.skill.emoji} {card.skill.zh}</b><small>{card.skill.desc}</small></button>)}</div></fieldset>; })}</div><p className="pet-note">照顧、學習和遠征都能累積經驗，升級後會解鎖更多技能。</p></details>
      <div className="exp-actions"><button className="pet-secondary" disabled={starting} onClick={goCare}>回家照顧</button><button className="pet-primary" disabled={starting || !!lowEnergy.length || !selectedPets.length} onClick={start}>{starting ? '正在準備森林路線…' : '出發，探索森林 →'}</button></div>
    </>}
  </div>;
}
