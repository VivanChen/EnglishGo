/** Original vector tools stay crisp and consistent across desktop and mobile. */
export default function CareTool({ tool }) {
  const art = {
    sponge: <><path d="M12 22Q30 12 53 21L56 43Q36 57 12 45Z" fill="#e8c477"/><path d="M12 22Q32 34 53 21L56 32Q34 47 12 34Z" fill="#f6dda0"/><g fill="#c29d55"><circle cx="21" cy="39" r="2"/><circle cx="43" cy="42" r="2"/><circle cx="33" cy="29" r="2"/></g><g fill="#f4ffff" stroke="#9fc6c5"><circle cx="17" cy="17" r="7"/><circle cx="28" cy="12" r="5"/><circle cx="42" cy="15" r="8"/></g></>,
    bubbles: <g fill="#efffff" fillOpacity=".85" stroke="#8ab8b7" strokeWidth="1.5"><circle cx="27" cy="34" r="16"/><circle cx="46" cy="20" r="11"/><circle cx="47" cy="47" r="8"/><path d="M18 31q1-7 8-8M40 18q1-4 5-5" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round"/></g>,
    shower: <><path d="M47 58V31Q47 16 32 14" fill="none" stroke="#688b93" strokeWidth="8" strokeLinecap="round"/><path d="M14 22Q17 6 31 12Q43 17 35 31Z" fill="#a7c9c8" stroke="#587d85" strokeWidth="2"/><path d="m15 31-3 6m12-1-3 6m12-1-3 6M9 44l-3 6m12-1-3 6m12-1-3 6" stroke="#79b7d2" strokeWidth="3" strokeLinecap="round"/></>,
    towel: <><rect x="9" y="13" width="46" height="40" rx="9" fill="#dbb28d"/><path d="M13 14h35q7 0 7 8v20H19q-6 0-6-7Z" fill="#f3dfbd"/><path d="M19 15v27m7-27v27M15 47h35" stroke="#d3b58c" strokeWidth="2"/><path d="M20 23h23m-23 5h16" stroke="#fff5de" strokeWidth="2" strokeLinecap="round"/></>,
    carrot: <><path d="M25 20Q11 30 24 53Q31 60 43 27Z" fill="#e6a36a"/><path d="m29 21-5-14m10 13 8-13m-9 12 1-14" stroke="#789b70" strokeWidth="5" strokeLinecap="round"/><path d="m23 30 9 4m-7 8 5 2" stroke="#bd8054" strokeWidth="2"/></>,
    biscuit: <><path d="M52 31a22 22 0 1 1-20-21q-1 10 9 10-1 11 11 11Z" fill="#dbaf79" stroke="#b8885c" strokeWidth="2"/><g fill="#89684f"><circle cx="21" cy="25" r="3"/><circle cx="35" cy="35" r="3"/><circle cx="22" cy="44" r="2.5"/><circle cx="42" cy="45" r="2"/></g></>,
    apple: <><path d="M32 23C6 4 5 43 21 54q7 4 11-1 6 5 13 0c19-20 10-43-13-30Z" fill="#c97b6d"/><path d="M32 24q-3-12 3-17" fill="none" stroke="#86725a" strokeWidth="4" strokeLinecap="round"/><path d="M35 17Q40 4 53 10 50 23 35 17" fill="#8ca879"/><path d="M19 27q-6 8-2 15" fill="none" stroke="#ecc0ab" strokeWidth="4" strokeLinecap="round"/></>,
    ball: <><circle cx="32" cy="32" r="23" fill="#a4ba84" stroke="#738e6a" strokeWidth="2"/><path d="M15 16q25 11 5 36M45 14q-22 19 6 33" fill="none" stroke="#f6edcd" strokeWidth="4"/></>,
    blanket: <><path d="M10 20q20-10 44 0v32q-24-8-44 0Z" fill="#9cb8bb"/><path d="M10 20q20-10 44 0v10q-24-8-44 0Z" fill="#e5efdf"/><path d="M18 33v13m9-15v13m10-13v13m9-11v13" stroke="#7e9d9f" strokeWidth="2"/></>,
    moon: <><path d="M40 8A24 24 0 1 0 56 41C29 51 16 23 40 8" fill="#e7cb8c" stroke="#c5a771" strokeWidth="1.5"/><path d="m48 12 2 6 6 2-6 2-2 6-2-6-6-2 6-2Z" fill="#f6e9c0"/></>,
    hand: <><path d="M21 34V16q0-7 6-5v19V9q6-5 8 2v19V14q7-4 7 3v16V23q7-3 7 4v16Q46 59 30 57 19 55 13 43L7 33q0-8 7-4l7 8Z" fill="#e9c8aa" stroke="#bc9c85" strokeWidth="1.5" strokeLinejoin="round"/><path d="M27 40q8-5 13 1" fill="none" stroke="#c5a58d" strokeWidth="2" strokeLinecap="round"/></>,
  };
  return <svg viewBox="0 0 64 64" width="64" height="64" aria-hidden="true" data-care-tool={tool}>{art[tool] || art.hand}</svg>;
}
