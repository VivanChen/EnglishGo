import catalog from './vocabularyEnrichment.json';

const primaryPos=value=>String(value||'').toLowerCase().match(/[a-z]+/)?.[0]||'';

export function enrichVocabularyCard(card,level=card?.level) {
  if(!card||typeof card.w!=='string')return card;
  const item=catalog[`${level}:${card.w.trim().toLowerCase()}`];
  if(!item)return card;
  // A custom deck may deliberately teach a different part of speech or pronunciation.
  if(card.p&&item.p&&primaryPos(card.p)!==primaryPos(item.p))return card;
  const forms=(Array.isArray(card.f)?card.f:[]).filter(form=>form&&typeof form.w==='string').map(form=>({...form}));
  for(const form of item.f){
    const old=forms.find(value=>value.w.toLowerCase()===form.w.toLowerCase()&&value.p===form.p);
    if(!old)forms.push({...form});
    else if(!old.n?.includes(form.n))old.n=old.n?`${old.n}；${form.n}`:form.n;
  }
  const collocations=[...new Set([...(Array.isArray(card.c)?card.c:[]),...item.c])];
  return {...card,ph:typeof card.ph==='string'&&card.ph.trim()?card.ph:item.ph,f:forms,c:collocations};
}

export function enrichVocabularyLevels(levels) {
  return Object.fromEntries(Object.entries(levels).map(([level,cards])=>[level,cards.map(card=>enrichVocabularyCard(card,level))]));
}
