export default function PracticeArt({ kind = 'quiz', complete = false }) {
  return <svg className="practice-art" viewBox="0 0 380 250" aria-hidden="true">
    <rect width="380" height="250" rx="28" fill={kind === 'listening' ? '#dbe8ef' : '#e5ebd6'} />
    <circle cx="319" cy="54" r="29" fill="#f4d990" /><path d="M0 205 Q90 140 192 205 T380 192 V250 H0Z" fill="#c4d3b0" />
    <g fill="#fffdf3" opacity=".8"><path d="M24 61a15 15 0 0130-5a12 12 0 0124 7H24Z" /><path d="M260 106a13 13 0 0126-4a12 12 0 0120 8h-46Z" /></g>
    {kind === 'listening' ? <g stroke="#507364" strokeWidth="6" strokeLinejoin="round">
      <rect x="102" y="76" width="177" height="128" rx="23" fill="#fff3d2" />
      <path d="M146 76V60q0-12 12-12h65q12 0 12 12v16" fill="none" />
      <circle cx="158" cy="140" r="35" fill="#c8d9ca" /><circle cx="158" cy="140" r="18" fill="#fefbee" />
      <path d="M215 104h36m-36 18h36" strokeWidth="4" /><circle cx="229" cy="166" r="15" fill="#e0b675" />
      <path className="practice-note" d="M70 99V75l18-4v19m-18 9c0 10-16 10-16 2s16-11 16-2m18-9c0 10-16 10-16 2s16-11 16-2" fill="#507364" strokeWidth="2" />
    </g> : kind === 'review' ? <g stroke="#507364" strokeWidth="5" strokeLinejoin="round">
      <path d="M155 159h72l-11 55h-50Z" fill="#d5a780" /><path d="M190 160v-56" fill="none" />
      <path d="M190 138q-58 0-58-45q55-5 58 45Z" fill="#a9c69b" /><path d="M190 123q55-6 50-55q-52 6-50 55Z" fill="#739d78" />
      <path d="M273 148l6-21m-28 44l22 8" stroke="#79a3b1" /><path d="M76 192l20-29 19 13-20 29Z" fill="#f3d78f" />
    </g> : <g stroke="#507364" strokeWidth="5" strokeLinejoin="round">
      <path d="M105 78q45-14 86 9q42-23 86-9v119q-44-10-86 9q-43-19-86-9Z" fill="#fffdf3" /><path d="M191 87v118" fill="none" />
      <path d="M126 108h43m-43 19h33m-33 44h43m42-63h43m-43 19h33" strokeWidth="4" />
      <path d="M220 165l11 11 22-28" fill="none" stroke="#9ab77e" strokeWidth="8" />
      <path d="M64 82l21-17 39 5-27 23-9-16Z" fill="#ecc782" strokeWidth="3" />
    </g>}
    <g fill="#c7a45f"><path d="M302 158l3 8 9 3-9 3-3 9-3-9-8-3 8-3Z" /><path d="M70 126l2 5 6 2-6 2-2 6-2-6-6-2 6-2Z" /></g>
    {complete && <g className="practice-spark"><circle cx="116" cy="40" r="5" fill="#d9ad70" /><circle cx="278" cy="219" r="4" fill="#739d78" /><path d="M191 25l4 10 11 1-9 7 3 11-9-6-9 6 3-11-9-7 11-1Z" fill="#e4bb67" /></g>}
  </svg>;
}
