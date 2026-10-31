import {render,screen,fireEvent,within} from '@testing-library/react';
import {describe,it,expect,vi} from 'vitest';
vi.mock('./TownScene.jsx',()=>({default:({activity,onEnvironment,onStatus,onPlacementSelect})=><div><button onClick={()=>onStatus('ready')}>模型完成</button><button onClick={()=>onStatus('fallback')}>輕量場景</button><button onClick={()=>onPlacementSelect('explore-shell')}>點貝殼</button><button onClick={()=>onEnvironment({placementId:activity?.placementId,phase:'arrived'})}>抵達</button><button onClick={()=>onEnvironment({placementId:activity?.placementId,phase:'blocked'})}>路被擋住</button><button onClick={()=>onEnvironment({placementId:'explore-shell',phase:'arrived'})}>過期抵達</button></div>}));
import WorldExplorer from './WorldExplorer.jsx';
import {EXPLORATION_PLACES,explorationReceipt} from './explorationData.js';
const setup=(props={})=>{const dispatch=vi.fn();render(<WorldExplorer pet={{id:'pet-harbor-cat',speciesId:'harbor-cat'}} receipts={[]} dispatch={dispatch} {...props}/>);return dispatch;};
const click=name=>fireEvent.click(screen.getByRole('button',{name,exact:true}));
describe('world map encounters',()=>{
  it('filters the journal and reads a collected word without starting a trip',()=>{
    const speak=vi.fn(),stopSpeech=vi.fn();const dispatch=setup({receipts:['explore:tidepool:shell'],speak,stopSpeech});
    fireEvent.click(screen.getByText('翻開旅行手帳 · 1 個發現'));click('已收藏 · 1');
    expect(within(document.querySelector('.town-stamp-grid')).getAllByRole('button')).toHaveLength(2);
    click('朗讀單字 shell');expect(speak).toHaveBeenCalledWith('shell');expect(stopSpeech).toHaveBeenCalled();expect(dispatch).not.toHaveBeenCalled();
    expect(screen.queryByRole('region',{name:'潮汐灣'})).not.toBeInTheDocument();click('待發現 · 11');
    expect(within(document.querySelector('.town-stamp-grid')).getAllByRole('button')).toHaveLength(11);
    expect(screen.queryByRole('button',{name:'朗讀單字 shell'})).not.toBeInTheDocument();
  });
  it('starts the exact journal activity after loading and drops an abandoned destination',()=>{
    setup();fireEvent.click(screen.getByText('翻開旅行手帳 · 0 個發現'));click('探索潮汐灣：海邊歇腳');
    expect(screen.queryByRole('button',{name:'停止前往物件'})).not.toBeInTheDocument();click('模型完成');click('抵達');
    expect(screen.getByText('Where can we sit without getting wet?')).toBeInTheDocument();
    click('探索花語草地：照顧幼苗');click('前往映月池');click('模型完成');click('抵達');
    expect(screen.queryByText('What do the plants need now?')).not.toBeInTheDocument();
    expect(screen.queryByRole('button',{name:'停止前往物件'})).not.toBeInTheDocument();
  });
  it('explains empty journal filters',()=>{
    setup();fireEvent.click(screen.getByText('翻開旅行手帳 · 0 個發現'));click('已收藏 · 0');
    expect(screen.getByText('還沒有收藏，選一個待發現的活動，和夥伴出發吧。')).toBeInTheDocument();
    click('待發現 · 12');expect(within(document.querySelector('.town-stamp-grid')).getAllByRole('button')).toHaveLength(12);
  });
  it('can cancel a walk and ignore its late arrival without granting a discovery',()=>{
    const dispatch=setup();click('前往潮汐灣');click('模型完成');click('尋找貝殼 探索 →');click('先停下來');click('過期抵達');
    expect(screen.queryByText('What should we do with this shell?')).not.toBeInTheDocument();expect(dispatch).not.toHaveBeenCalled();
    click('尋找貝殼 探索 →');click('抵達');expect(screen.getByText('What should we do with this shell?')).toBeInTheDocument();
  });
  it('retries blocked paths and keeps a discovered clue while playing with the companion',()=>{
    const dispatch=setup();click('前往潮汐灣');click('模型完成');click('尋找貝殼 探索 →');click('路被擋住');click('重新靠近');click('抵達');click('伸懶腰');
    expect(screen.getByText('What should we do with this shell?')).toBeInTheDocument();expect(dispatch).not.toHaveBeenCalled();
    click('Leave it here. 留在這裡。');expect(dispatch).toHaveBeenCalledTimes(1);
  });
  it('companion gestures interrupt unfinished walks and never count as discoveries',()=>{
    const dispatch=setup();click('前往潮汐灣');click('模型完成');click('尋找貝殼 探索 →');click('打招呼');click('過期抵達');
    expect(screen.queryByText('What should we do with this shell?')).not.toBeInTheDocument();click('開心跳');expect(dispatch).not.toHaveBeenCalled();
  });

  it('waits for arrival, allows retries and records only a correct discovery',()=>{
    const dispatch=setup();click('前往潮汐灣');click('模型完成');click('尋找貝殼 探索 →');
    expect(screen.queryByText('What should we do with this shell?')).not.toBeInTheDocument();click('抵達');
    click('Take it home. 帶回家。');expect(dispatch).not.toHaveBeenCalled();
    click('Leave it here. 留在這裡。');expect(dispatch).toHaveBeenCalledWith({type:'EXPLORE_DISCOVERY',placeId:'tidepool',taskId:'shell',answer:1});
    expect(screen.getByRole('button',{name:'Leave it here. 留在這裡。'})).toBeDisabled();
    expect(screen.getByRole('button',{name:'Leave it here. 留在這裡。'})).toHaveClass('is-answer-correct');
    click('探索下一個：海邊歇腳');expect(screen.queryByText(/發現已收藏/)).not.toBeInTheDocument();
    click('抵達');expect(screen.getByText('Where can we sit without getting wet?')).toBeInTheDocument();
  });
  it('moves directly to an unfinished destination after completing a stop',()=>{
    setup({receipts:['explore:tidepool:shell']});click('前往潮汐灣');click('輕量場景');click('海邊歇腳 探索 →');
    click('On the bench. 在長椅上。');click('下一站：花語草地');
    expect(screen.getByRole('region',{name:'花語草地'})).toBeInTheDocument();
    expect(screen.queryByText('Where can we sit without getting wet?')).not.toBeInTheDocument();
  });
  it('offers review instead of an unfinished route when the journal is full',()=>{
    setup({receipts:EXPLORATION_PLACES.flatMap(p=>p.tasks.map(t=>explorationReceipt(p.id,t.id)))});
    expect(screen.queryByRole('button',{name:/繼續探索：/})).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('翻開旅行手帳 · 12 個發現'));
    click('重遊映月池：觀察水波');expect(screen.getByRole('region',{name:'映月池'})).toBeInTheDocument();
    expect(screen.getByText('十二個發現都收藏了！選一站，再散步一次吧。')).toBeInTheDocument();
  });
  it('supports exploration without WebGL and clears the encounter when travelling',()=>{
    setup();click('前往潮汐灣');click('輕量場景');click('尋找貝殼 探索 →');
    expect(screen.getByText('What should we do with this shell?')).toBeInTheDocument();
    click('前往花語草地');expect(screen.queryByText('What should we do with this shell?')).not.toBeInTheDocument();
    expect(screen.getByRole('region',{name:'花語草地'})).toBeInTheDocument();
  });
  it('reveals bilingual help on request for older learners and shows saved stamps',()=>{
    setup({level:'senior',receipts:['explore:tidepool:shell']});
    expect(screen.getByLabelText('旅行印記 1 / 12')).toBeInTheDocument();click('前往潮汐灣');click('輕量場景');click('尋找貝殼 ✓ 已收藏');
    expect(screen.queryByText('把貝殼留在海邊，裡面住著一隻小螃蟹。')).not.toBeInTheDocument();
    click('看中文提示');expect(screen.getByText('把貝殼留在海邊，裡面住著一隻小螃蟹。')).toBeInTheDocument();
    click('返回地圖');expect(screen.queryByRole('region',{name:'潮汐灣'})).not.toBeInTheDocument();
  });
});
