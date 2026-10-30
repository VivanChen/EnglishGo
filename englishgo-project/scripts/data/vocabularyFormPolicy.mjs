// Dictionary-only forms; no neural/OOV guessing is allowed in the content build.
export const MASS_NOUNS = new Set(`advice air alcohol anger art beauty bread butter cash cheese clothing coffee courage cream darkness education electricity equipment evidence fiction flour food freedom fun furniture garbage grass guidance happiness health heat homework honey hunger ice information knowledge laughter leisure lightning luck luggage machinery meat milk money music news oxygen patience peace pollution poverty progress rain recreation research rice rubbish safety salt sand scenery seafood shopping smoke snow software soup spaghetti stuff sugar sunshine tea thirst tourism traffic transport transportation trash travel trust underwear violence vocabulary water wealth weather welfare wildlife work`.split(' '));

export const SPECIAL_FORMS = {
  be:[['am','v.','現在式，主詞 I'],['is','v.','現在式，第三人稱單數'],['are','v.','現在式，主詞 you／we／they'],['was','v.','過去式，主詞 I／he／she／it'],['were','v.','過去式，主詞 you／we／they'],['been','v.','過去分詞'],['being','v.','現在分詞']],
  am:[['be','v.','原形'],['was','v.','過去式，主詞 I'],['been','v.','過去分詞'],['being','v.','現在分詞']],
  is:[['be','v.','原形'],['was','v.','過去式'],['been','v.','過去分詞'],['being','v.','現在分詞']],
  are:[['be','v.','原形'],['were','v.','過去式'],['been','v.','過去分詞'],['being','v.','現在分詞']],
  can:[['could','v.','情態動詞的過去式；也可表示委婉語氣']],
  could:[['can','v.','對應的現在式；could 也可表示委婉語氣']],
  may:[['might','v.','對應形式；may／might 可表示可能性']],
  might:[['may','v.','對應形式；may／might 可表示可能性']],
  will:[['would','v.','對應的過去式；也可表示假設或委婉語氣']],
  would:[['will','v.','對應的現在式；would 也可表示假設或委婉語氣']],
  shall:[['should','v.','對應形式；should 常表示建議或義務']],
  should:[['shall','v.','對應形式；should 常表示建議或義務']],
  must:[],
  has:[['have','v.','原形'],['had','v.','過去式／過去分詞'],['having','v.','現在分詞']],
  doing:[['do','v.','原形'],['did','v.','過去式'],['done','v.','過去分詞'],['does','v.','第三人稱單數現在式']],
  reading:[['read','v.','原形，讀 /riːd/'],['read','v.','過去式／過去分詞，讀 /red/'],['reads','v.','第三人稱單數現在式']],
  running:[['run','v.','原形／過去分詞'],['ran','v.','過去式'],['runs','v.','第三人稱單數現在式']],
  writing:[['write','v.','原形'],['wrote','v.','過去式'],['written','v.','過去分詞'],['writes','v.','第三人稱單數現在式']],
  get:[['gets','v.','第三人稱單數現在式'],['got','v.','過去式'],['gotten','v.','過去分詞，美式常用'],['getting','v.','現在分詞']],
  person:[['people','n.','常用複數'],['persons','n.','正式或法律語境中的複數']],
  child:[['children','n.','不規則複數']],
  fish:[['fish','n.','常用複數，單複數同形']], sheep:[['sheep','n.','複數，單複數同形']],
  deer:[['deer','n.','複數，單複數同形']], species:[['species','n.','單複數同形']],
  series:[['series','n.','單複數同形']],
  people:[['person','n.','對應的單數']], children:[['child','n.','單數']],
  men:[['man','n.','單數']], women:[['woman','n.','單數']], feet:[['foot','n.','單數']], teeth:[['tooth','n.','單數']],
  parents:[['parent','n.','單數']],
  'get up':[['gets up','v.','第三人稱單數現在式'],['got up','v.','過去式'],['gotten up','v.','過去分詞，美式'],['getting up','v.','現在分詞']],
};

export const PERIPHRASTIC_ADJECTIVES = new Set(`beautiful careful careless cheerful comfortable confident curious dangerous delicious different difficult enjoyable exciting expensive famous friendly helpful important interesting modern peaceful popular powerful serious successful surprising useful wonderful worried`.split(' '));

export function reviewedForms(row, lexical) {
  const word=row.word.toLowerCase().trim();
  const pos=new Set(String(row.pos||'').toLowerCase().match(/[a-z]+/g)||[]);
  const verb=[...pos].some(p=>['v','vt','vi','verb'].includes(p));
  const noun=pos.has('n')||pos.has('noun');
  if(Object.hasOwn(SPECIAL_FORMS,word)&&(verb||noun))return SPECIAL_FORMS[word].map(([w,p,n])=>({w,p,n}));
  const forms=[];
  const add=(values,p,n)=>{for(const w of (values||[]).slice(0,2))if(w&&(!noun||w!==word||p==='v.'))forms.push({w,p,n})};
  if(verb&&lexical.inflections.VERB?.VB?.includes(word)) {
    const inf=lexical.inflections.VERB;
    // lie has two different inflections. Attach each to the intended meaning.
    if(word==='lie'){
      if(/躺|平放/.test(row.meaning))add(['lay'],'v.','過去式，躺');
      if(/躺|平放/.test(row.meaning))add(['lain'],'v.','過去分詞，躺');
      if(/謊/.test(row.meaning))add(['lied'],'v.','過去式／過去分詞，說謊');
    }else if(word==='hang'&&!/絞|吊死/.test(row.meaning))add(['hung'],'v.','過去式／過去分詞，懸掛');
    else {
      add(inf.VBD,'v.','過去式');
      const regularPast=inf.VBD?.filter(w=>w.endsWith('ed')||w===word);
      add(inf.VBN?.length?inf.VBN:regularPast,'v.','過去分詞');
    }
    add(inf.VBG,'v.','現在分詞');add(inf.VBZ,'v.','第三人稱單數現在式');
  }
  if(noun&&lexical.zipf>=4&&!MASS_NOUNS.has(word)&&!pos.has('pl')&&!pos.has('plural')) {
    add(lexical.inflections.NOUN?.NNS,'n.','複數');
  }
  if(pos.has('adj')||pos.has('adjective')) {
    if(PERIPHRASTIC_ADJECTIVES.has(word)){
      add([`more ${word}`],'adj.','比較級');add([`most ${word}`],'adj.','最高級');
    }else {add(lexical.inflections.ADJ?.JJR,'adj.','比較級');add(lexical.inflections.ADJ?.JJS,'adj.','最高級');}
  }
  const combined=new Map();
  for(const form of forms){
    if(word==='read'&&form.w==='read')form.n+='，讀 /red/';
    const key=`${form.w}:${form.p}`;const old=combined.get(key);if(old&&!old.n.includes(form.n))old.n+='／'+form.n;else if(!old)combined.set(key,{...form});
  }
  return [...combined.values()];
}
