export default function NovelIllustration({ chapter = 1, cover = false, small = false }) {
  const scenes = ["tree", "fairy", "river", "stones", "lake", "cave", "crystal", "return"];
  const type = cover ? "cover" : scenes[chapter - 1] || "tree";
  const gid = `novel_${type}_${small ? "s" : "l"}`;
  const h = small ? 118 : 210;
  const sky = {
    tree: ["#0B3F35", "#47A978"],
    fairy: ["#1B5D4F", "#9BDDC1"],
    river: ["#126179", "#83D8EF"],
    stones: ["#44515E", "#C6BA8A"],
    lake: ["#123456", "#8FCCFF"],
    cave: ["#383241", "#D7B555"],
    crystal: ["#26133F", "#8F51BD"],
    return: ["#18845F", "#B8E58B"],
    cover: ["#0B3F35", "#77C79D"],
  }[type];

  return (
    <div style={{ height: h, borderRadius: small ? 0 : 18, overflow: "hidden", background: sky[0], position: "relative", boxShadow: small ? "none" : "0 12px 26px rgba(12,56,46,.18)" }}>
      <svg viewBox="0 0 420 240" width="100%" height="100%" preserveAspectRatio="xMidYMid slice" role="img" aria-label="story illustration">
        <defs>
          <linearGradient id={`${gid}sky`} x1="0" x2="1" y1="0" y2="1"><stop stopColor={sky[0]} /><stop offset="1" stopColor={sky[1]} /></linearGradient>
          <radialGradient id={`${gid}glow`} cx="52%" cy="38%" r="45%"><stop stopColor="#FFF6A6" stopOpacity=".95" /><stop offset=".5" stopColor="#B7F7CE" stopOpacity=".42" /><stop offset="1" stopColor="#fff" stopOpacity="0" /></radialGradient>
        </defs>
        <rect width="420" height="240" fill={`url(#${gid}sky)`} />
        <circle cx="330" cy="42" r="42" fill="#FFF4B8" opacity={(type === "lake" || type === "return") ? 0.7 : 0.18} />
        <path d="M0 205 C90 172 160 192 230 170 C300 150 360 178 420 158 L420 240 L0 240Z" fill="#153F35" opacity=".55" />

        {(type === "tree" || type === "fairy" || type === "cover") && <g>
          <path d="M80 222 C118 182 130 130 122 74 C119 45 160 25 178 52 C190 70 180 96 190 124 C204 162 225 190 260 222Z" fill="#6B4427" />
          <path d="M119 80 C76 75 54 46 72 25 C91 2 130 23 137 52 C154 19 201 8 229 34 C252 55 231 92 190 92 C179 124 137 120 119 80Z" fill="#1F6B42" />
          <circle cx="165" cy="108" r="14" fill="#FFE49A" />
          <circle cx="146" cy="106" r="5" fill="#2B2B2B" /><circle cx="184" cy="106" r="5" fill="#2B2B2B" />
          <path d="M148 129 Q166 143 184 129" fill="none" stroke="#2B2B2B" strokeWidth="5" strokeLinecap="round" />
          <circle cx="206" cy="72" r="58" fill={`url(#${gid}glow)`} />
        </g>}

        {(type === "fairy" || type === "cover") && <g transform="translate(234 96)">
          <ellipse cx="-16" cy="-8" rx="26" ry="15" fill="#B8F4FF" opacity=".72" transform="rotate(-32)" />
          <ellipse cx="17" cy="-8" rx="26" ry="15" fill="#B8F4FF" opacity=".72" transform="rotate(32)" />
          <circle cx="0" cy="6" r="14" fill="#FFD4A3" /><path d="M-10 20 Q0 54 12 20Z" fill="#64BBD5" /><circle cx="0" cy="-24" r="8" fill="#FFE778" />
        </g>}

        {type === "river" && <g>
          <path d="M0 162 C90 136 142 168 220 132 C295 98 340 122 420 84 L420 240 L0 240Z" fill="#4CC4E5" />
          <path d="M58 182 C130 166 183 183 258 145" fill="none" stroke="#DFFFFF" strokeWidth="6" opacity=".55" />
          <path d="M254 70 L316 85 L302 170 L238 160Z" fill="#6A4A2C" /><path d="M261 78 L304 88 L294 144 L249 141Z" fill="#FFD76B" /><path d="M280 75 L284 32" stroke="#6A4A2C" strokeWidth="7" strokeLinecap="round" />
          <circle cx="112" cy="170" r="28" fill="#6EC15B" /><circle cx="99" cy="152" r="8" fill="#EAF7B7" /><circle cx="124" cy="152" r="8" fill="#EAF7B7" />
        </g>}

        {type === "stones" && <g>{[95, 190, 285].map((x, i) => <g key={x}><path d={`M${x - 42} 205 Q${x - 38} 92 ${x} 70 Q${x + 42} 92 ${x + 40} 205Z`} fill="#AFA98E" /><text x={x} y="142" textAnchor="middle" fontSize="44" fill={i === 0 ? "#F5D45B" : i === 1 ? "#FFF0A6" : "#E8D58A"}>{i === 0 ? "★" : i === 1 ? "☾" : "◎"}</text></g>)}</g>}

        {type === "lake" && <g><rect x="0" y="120" width="420" height="120" fill="#2D83B5" opacity=".65" /><ellipse cx="216" cy="172" rx="145" ry="42" fill="#BDEFFF" opacity=".42" /><path d="M205 188 C225 162 238 134 226 112" fill="none" stroke="#FFF7BF" strokeWidth="9" strokeLinecap="round" /><circle cx="282" cy="52" r="38" fill="#FFF7BF" /></g>}
        {type === "cave" && <g><path d="M40 220 L120 45 L220 220Z" fill="#5D5755" /><path d="M190 220 L280 40 L390 220Z" fill="#4E4A4B" /><path d="M151 220 Q204 96 265 220Z" fill="#1E1722" /><path d="M188 151 L224 135 L224 94 L250 120" fill="none" stroke="#FAD85C" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" /></g>}
        {type === "crystal" && <g><rect width="420" height="240" fill="#24123B" opacity=".36" /><path d="M210 42 L264 116 L232 202 L188 202 L156 116Z" fill="#E6D7FF" opacity=".9" /><path d="M210 42 L210 202 M156 116 L264 116 M188 202 L210 116 L232 202" stroke="#7A3DFF" strokeWidth="4" opacity=".75" /><circle cx="210" cy="120" r="95" fill={`url(#${gid}glow)`} /><path d="M80 198 C120 124 50 102 70 60 C98 105 150 116 120 198Z" fill="#221029" opacity=".9" /><circle cx="94" cy="92" r="7" fill="#D45CFF" /><circle cx="114" cy="92" r="7" fill="#D45CFF" /></g>}
        {type === "return" && <g><circle cx="314" cy="60" r="22" fill="#88CFFF" /><path d="M300 58 Q314 82 330 58" fill="none" stroke="#2E78A5" strokeWidth="4" /><circle cx="82" cy="170" r="20" fill="#6EC15B" /><circle cx="118" cy="164" r="15" fill="#EAD7A0" /><circle cx="156" cy="176" r="14" fill="#C58B54" /><path d="M0 185 C80 132 150 155 215 122 C300 82 360 117 420 82 L420 240 L0 240Z" fill="#6CCB79" opacity=".5" /></g>}

        <g transform="translate(56 104)">
          <circle cx="34" cy="28" r="18" fill="#FFD1A1" /><path d="M16 29 C18 7 49 2 55 29 C45 15 28 14 16 29Z" fill="#704022" /><rect x="22" y="46" width="28" height="46" rx="10" fill="#F1C446" />
          <path d="M24 91 L13 132 M48 91 L62 132" stroke="#1F5580" strokeWidth="10" strokeLinecap="round" /><path d="M50 55 Q77 60 86 82" stroke="#FFD1A1" strokeWidth="9" strokeLinecap="round" /><rect x="3" y="52" width="20" height="42" rx="8" fill="#D7738F" />
        </g>
      </svg>
    </div>
  );
}
