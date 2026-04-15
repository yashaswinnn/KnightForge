// client/src/components/AiChat.jsx
// Shows ONLY the robot + floating speech bubble (no chat history, no input)
import { useState, useEffect, useRef } from "react";

function localFallback(prompt) {
  const lower = prompt.toLowerCase();
  const m = prompt.match(/\b([a-h][1-8][a-h][1-8][qrbn]?)\b/i);
  const move = m ? m[1] : null;
  if (lower.includes("player says:")) return "Your confidence has been noted. I still prefer the board's opinion.";
  if (lower.includes("human just played")) return move ? `${move}? Ambitious. I do admire courage before consequences.` : "Interesting. The board disagrees.";
  if (lower.includes("you (ai) just played")) return move ? `${move}. Clean, efficient, and mildly insulting.` : "A fine move. The position obliges.";
  return "The game continues. I remain composed.";
}

function RobotFace({ mood }) {
  const cfg = {
    idle:      { lx:72,ly:88,lw:16,lh:10, rx:112,ry:88,rw:16,rh:10, mouth:"M80 110 q20 8 40 0" },
    thinking:  { lx:72,ly:91,lw:16,lh:6,  rx:112,ry:91,rw:16,rh:6,  mouth:"M84 110 q16 3 32 0" },
    happy:     { lx:70,ly:86,lw:18,lh:12, rx:112,ry:86,rw:18,rh:12, mouth:"M76 108 q24 14 48 0" },
    smug:      { lx:72,ly:90,lw:16,lh:8,  rx:112,ry:86,rw:16,rh:12, mouth:"M80 112 q24 2 40 -4" },
    surprised: { lx:70,ly:84,lw:20,lh:16, rx:110,ry:84,rw:20,rh:16, mouth:"M88 110 q12 12 24 0" },
  };
  const c = cfg[mood] || cfg.idle;
  return (
    <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" style={{width:"100%",height:"100%"}}>
      <ellipse cx="100" cy="188" rx="44" ry="9" fill="rgba(0,0,0,0.15)"/>
      <ellipse cx="30"  cy="112" rx="15" ry="23" fill="#e2e2e2"/>
      <ellipse cx="170" cy="112" rx="15" ry="23" fill="#e2e2e2"/>
      <ellipse cx="30"  cy="112" rx="9"  ry="15" fill="#ccc"/>
      <ellipse cx="170" cy="112" rx="9"  ry="15" fill="#ccc"/>
      <rect x="42" y="58" width="116" height="122" rx="30" fill="url(#rcbg)"/>
      <polygon points="56,60 68,26 84,60"    fill="#e2e2e2"/>
      <polygon points="116,60 132,26 146,60" fill="#e2e2e2"/>
      <polygon points="62,60 68,36 78,60"    fill="#d4d4d4"/>
      <polygon points="122,60 132,36 142,60" fill="#d4d4d4"/>
      <rect x="52" y="72" width="96" height="80" rx="13" fill="#0f0f0f"/>
      <rect x="56" y="76" width="32" height="20" rx="5"  fill="rgba(255,255,255,0.05)"/>
      <rect x={c.lx} y={c.ly} width={c.lw} height={c.lh} rx="2" fill="rgba(255,255,255,0.93)"/>
      <rect x={c.rx} y={c.ry} width={c.rw} height={c.rh} rx="2" fill="rgba(255,255,255,0.93)"/>
      <path d={c.mouth} stroke="rgba(255,255,255,0.88)" strokeWidth="3" strokeLinecap="round" fill="none"/>
      <rect x="97" y="42" width="6" height="18" rx="3" fill="#bbb"/>
      <circle cx="100" cy="38" r="8"   fill="#efefef"/>
      <circle cx="100" cy="38" r="4.5" fill="rgba(160,210,255,0.95)"/>
      <defs>
        <radialGradient id="rcbg" cx="0.42" cy="0.28">
          <stop offset="0%"   stopColor="#f6f6f6"/>
          <stop offset="100%" stopColor="#c6c6c6"/>
        </radialGradient>
      </defs>
    </svg>
  );
}

export default function AiChat({ lastMove, fen, isPlayerMove }) {
  const [mood, setMood]       = useState("idle");
  const [typing, setTyping]   = useState(false);
  const [bubble, setBubble]   = useState("I hope you're ready. This will not be easy.");
  const moodTimer = useRef(null);

  useEffect(() => {
    if (!lastMove) return;
    setTimeout(() => triggerAiMessage(lastMove, fen, isPlayerMove), Math.random()*500+600);
  }, [lastMove]);

  function setMoodFor(m, ms=3000) {
    setMood(m);
    clearTimeout(moodTimer.current);
    moodTimer.current = setTimeout(() => setMood("idle"), ms);
  }

  async function triggerAiMessage(move, position, playerMoved) {
    setTyping(true);
    setMoodFor("thinking", 99999);
    setBubble(null); // hide while typing

    const prompt = playerMoved
      ? `The human just played ${move}. Board FEN: ${position}. React briefly as the AI opponent. One or two sentences max, witty.`
      : `You (AI) just played ${move}. Board FEN: ${position}. Comment on your move. One or two sentences max, witty.`;

    let reply = localFallback(prompt);
    try {
      const res  = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json();
      if (data?.message) reply = data.message;
    } catch(_) {}

    setTyping(false);
    setBubble(reply);
    setMoodFor(playerMoved ? ["smug","surprised","idle"][Math.floor(Math.random()*3)] : "happy");
  }

  return (
    <div className="rc-widget">
      {/* Robot */}
      <div className={typing ? "rc-bot rc-bob" : "rc-bot rc-float"}>
        <RobotFace mood={mood}/>
      </div>

      {/* Right side: bubble + label */}
      <div className="rc-right">
        {/* Speech bubble */}
        {(bubble || typing) && (
          <div className="rc-bubble-wrap rc-speech-pop">
            {typing
              ? <span className="rc-typing-row"><span className="rc-dot"/><span className="rc-dot"/><span className="rc-dot"/></span>
              : <p className="rc-bubble-text">{bubble}</p>
            }
            {/* tail pointing left toward robot */}
            <span className="rc-speech-tail"/>
          </div>
        )}

        {/* Name + status */}
        <div className="rc-label">
          <span className="rc-name">AI Opponent</span>
          <span className="rc-status">
            <span className={typing ? "rc-dot-status rc-dot-blue" : "rc-dot-status rc-dot-green"}/>
            {typing ? "typing…" : "online"}
          </span>
        </div>
      </div>
    </div>
  );
}