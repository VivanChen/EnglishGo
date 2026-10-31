import {render,screen,fireEvent,within} from '@testing-library/react';
import {describe,it,expect,vi} from 'vitest';
vi.mock('./TownScene.jsx',()=>({default:({activity,onEnvironment,onStatus,onPlacementSelect})=><div><button onClick={()=>onStatus('ready')}>模型完成</button><button onClick={()=>onStatus('fallback')}>輕量場景</button><button onClick={()=>onPlacementSelect('explore-shell')}>點貝殼</button><button onClick={()=>onEnvironment({placementId:activity?.placementId,phase:'arrived'})}>抵達</button></div>}));
import WorldExplorer from './WorldExplorer.jsx';
const setup=(props={})=>{const dispatch=vi.fn();render(<WorldExplorer pet={{id:'pet-harbor-cat',speciesId:'harbor-cat'}} receipts={[]} dispatch={dispatch} {...props}/>);return dispatch;};
const click=name=>fireEvent.click(screen.getByRole('button',{name,exact:true}));
describe('world map encounters',()=>{
  it('waits for arrival, allows retries and records only a correct discovery',()=>{
    const dispatch=setup();click('前往潮汐灣');click('模型完成');click('尋找貝殼 探索 →');
    expect(screen.queryByText('What should we do with this shell?')).not.toBeInTheDocument();click('抵達');
    click('Take it home. 帶回家。');expect(dispatch).not.toHaveBeenCalled();
    click('Leave it here. 留在這裡。');expect(dispatch).toHaveBeenCalledWith({type:'EXPLORE_DISCOVERY',placeId:'tidepool',taskId:'shell',answer:1});
    expect(screen.getByRole('button',{name:'Leave it here. 留在這裡。'})).toBeDisabled();
    click('海邊歇腳 探索 →');expect(screen.queryByText(/發現已收藏/)).not.toBeInTheDocument();
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
