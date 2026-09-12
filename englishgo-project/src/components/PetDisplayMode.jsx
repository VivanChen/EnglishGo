import {useEffect,useRef,useState} from 'react';

// Fullscreen and orientation locks require a deliberate browser gesture.
export default function PetDisplayMode({targetRef}) {
 const [fullscreen,setFullscreen]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const alive=useRef(true),pending=useRef(false),ownsLock=useRef(false);
 useEffect(()=>{
  alive.current=true;
  const release=()=>{if(ownsLock.current){ownsLock.current=false;try{screen.orientation?.unlock?.()}catch{}}};
  const changed=()=>{const active=document.fullscreenElement===targetRef.current;setFullscreen(active);if(!active){release();setMessage('')}};
  document.addEventListener('fullscreenchange',changed);
  return()=>{alive.current=false;document.removeEventListener('fullscreenchange',changed);release()};
 },[targetRef]);
 const toggle=async()=>{
  if(pending.current)return;
  const target=targetRef.current;if(!target)return;
  if(document.fullscreenElement===target){try{await document.exitFullscreen()}catch{setMessage('請使用瀏覽器的退出全螢幕操作。')}return}
  if(!target.requestFullscreen){setMessage('請將手機轉橫，版面會自動展開；目前瀏覽器不支援此全螢幕功能。');return}
  pending.current=true;setBusy(true);setMessage('');
  try{
   await target.requestFullscreen();
   if(!alive.current||document.fullscreenElement!==target)return;
   setFullscreen(true);
   if(screen.orientation?.lock){try{await screen.orientation.lock('landscape');if(alive.current&&document.fullscreenElement===target)ownsLock.current=true;else screen.orientation.unlock?.()}catch{if(alive.current)setMessage(window.matchMedia?.('(orientation: landscape)')?.matches?'':'已開啟全螢幕，請將手機轉橫觀看。')}}
   else setMessage(window.matchMedia?.('(orientation: landscape)')?.matches?'':'已開啟全螢幕，請將手機轉橫觀看。');
  }catch{if(alive.current)setMessage('請將手機轉橫，版面會自動展開；也可以繼續直向操作。')}
  finally{pending.current=false;if(alive.current)setBusy(false)}
 };
 return <div className="showcase-display"><button type="button" disabled={busy} onClick={toggle} aria-pressed={fullscreen}>{busy?'正在開啟…':fullscreen?'退出全螢幕':'橫向全螢幕'}</button>{message&&<span role="status" className="showcase-display-message">{message}</span>}</div>;
}
