import {render,screen as ui,fireEvent,waitFor,act} from '@testing-library/react';
import {afterEach,it,expect,vi} from 'vitest';
import PetDisplayMode from './PetDisplayMode.jsx';
const descriptor=Object.getOwnPropertyDescriptor(document,'fullscreenElement');
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();if(descriptor)Object.defineProperty(document,'fullscreenElement',descriptor);else delete document.fullscreenElement;delete document.exitFullscreen});
it('does not request fullscreen automatically and explains unsupported browsers',()=>{
 const target={};render(<PetDisplayMode targetRef={{current:target}}/>);expect(ui.queryByRole('status')).not.toBeInTheDocument();fireEvent.click(ui.getByRole('button'));expect(ui.getByRole('status')).toHaveTextContent('請將手機轉橫');expect(ui.getByRole('button')).toHaveAttribute('aria-pressed','false');
});
it('locks only after fullscreen succeeds and releases the owned lock on exit',async()=>{
 const lock=vi.fn().mockResolvedValue(),unlock=vi.fn();vi.stubGlobal('screen',{orientation:{lock,unlock}});
 const target={requestFullscreen:vi.fn(async()=>{Object.defineProperty(document,'fullscreenElement',{configurable:true,value:target});document.dispatchEvent(new Event('fullscreenchange'))})};document.exitFullscreen=vi.fn(async()=>{Object.defineProperty(document,'fullscreenElement',{configurable:true,value:null});document.dispatchEvent(new Event('fullscreenchange'))});
 render(<PetDisplayMode targetRef={{current:target}}/>);expect(target.requestFullscreen).not.toHaveBeenCalled();fireEvent.click(ui.getByRole('button'));await waitFor(()=>expect(lock).toHaveBeenCalledWith('landscape'));expect(ui.getByRole('button',{name:'退出全螢幕'})).toHaveAttribute('aria-pressed','true');fireEvent.click(ui.getByRole('button'));await waitFor(()=>expect(unlock).toHaveBeenCalledOnce());expect(ui.getByRole('button',{name:'橫向全螢幕'})).toBeEnabled();
});
it('keeps an exit button when orientation locking is rejected',async()=>{
 vi.stubGlobal('screen',{orientation:{lock:vi.fn().mockRejectedValue(new Error('unsupported')),unlock:vi.fn()}});const target={requestFullscreen:vi.fn(async()=>Object.defineProperty(document,'fullscreenElement',{configurable:true,value:target}))};render(<PetDisplayMode targetRef={{current:target}}/>);fireEvent.click(ui.getByRole('button'));await waitFor(()=>expect(ui.getByRole('status')).toHaveTextContent('請將手機轉橫觀看'));expect(ui.getByRole('button',{name:'退出全螢幕'})).toBeEnabled();
});
it('does not lock orientation if fullscreen is denied',async()=>{
 const lock=vi.fn();vi.stubGlobal('screen',{orientation:{lock}});render(<PetDisplayMode targetRef={{current:{requestFullscreen:vi.fn().mockRejectedValue(new Error('denied'))}}}/>);fireEvent.click(ui.getByRole('button'));await waitFor(()=>expect(ui.getByRole('status')).toHaveTextContent('也可以繼續直向操作'));expect(lock).not.toHaveBeenCalled();expect(ui.getByRole('button')).toBeEnabled();
});
it('releases a late orientation lock when the view has unmounted',async()=>{
 let resolve;const unlock=vi.fn();vi.stubGlobal('screen',{orientation:{lock:vi.fn(()=>new Promise(r=>{resolve=r})),unlock}});const target={requestFullscreen:vi.fn(async()=>Object.defineProperty(document,'fullscreenElement',{configurable:true,value:target}))};const view=render(<PetDisplayMode targetRef={{current:target}}/>);fireEvent.click(ui.getByRole('button'));await waitFor(()=>expect(resolve).toBeTypeOf('function'));view.unmount();await act(async()=>resolve());expect(unlock).toHaveBeenCalledOnce();
});
