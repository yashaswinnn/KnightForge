import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Chess } from 'chess.js';
import { ChessBoard } from '../components/ChessBoard.jsx';
import { Button } from '../components/ui/button.jsx';
import { cn } from '../lib/utils.js';
import { toast } from '../hooks/use-toast.js';
import AiChat from '../components/AiChat.jsx';

const STOCKFISH_CDN = 'https://cdn.jsdelivr.net/npm/stockfish.js@10.0.2/stockfish.js';
const SKILL_LEVELS = { easy: 2, medium: 8, hard: 18 };
const DIFFICULTIES = ['easy', 'medium', 'hard'];

function AIOrb() {
  return (
    <svg viewBox="0 0 200 260" fill="none" style={{ width: '100%', height: '100%' }}>
      <ellipse cx="100" cy="230" rx="70" ry="20" fill="#5020a0" opacity="0.2"/>
      <ellipse cx="100" cy="130" rx="78" ry="98" fill="url(#aiG1)" opacity="0.7"/>
      <circle cx="100" cy="90" r="55" fill="url(#aiG2)"/>
      <circle cx="82" cy="76" r="20" fill="rgba(180,140,255,0.12)"/>
      <text x="100" y="102" textAnchor="middle" fontSize="36" fontWeight="700" fill="rgba(220,200,255,0.95)" fontFamily="Inter,sans-serif">AI</text>
      <circle cx="100" cy="90" r="62" stroke="rgba(140,100,255,0.25)" strokeWidth="1.5" fill="none"/>
      {[[32,150],[168,162],[145,40],[55,38],[20,100],[180,100]].map(([x,y],i)=>(
        <circle key={i} cx={x} cy={y} r="3.5" fill="rgba(160,120,255,0.5)" style={{animation:`sparkle ${1.5+i*0.3}s ${i*0.2}s ease-in-out infinite`}}/>
      ))}
      <defs>
        <radialGradient id="aiG1" cx="0.5" cy="0.42"><stop offset="0%" stopColor="#7040d0" stopOpacity="0.75"/><stop offset="100%" stopColor="#180870" stopOpacity="0.08"/></radialGradient>
        <radialGradient id="aiG2" cx="0.4" cy="0.35"><stop offset="0%" stopColor="#a070f0" stopOpacity="0.95"/><stop offset="100%" stopColor="#3820a0" stopOpacity="0.6"/></radialGradient>
      </defs>
    </svg>
  );
}

export default function PlayAI() {
  const [difficulty, setDifficulty] = useState('medium');
  const [playerColor, setPlayerColor] = useState('white');
  const [started, setStarted] = useState(false);
  const [mounted, setMounted] = useState(false);

  const [chess] = useState(() => new Chess());
  const [fen, setFen] = useState(chess.fen());
  const [legalMoves, setLegalMoves] = useState([]);
  const [lastMove, setLastMove] = useState(null);
  const [gameOver, setGameOver] = useState(null);
  const [thinking, setThinking] = useState(false);
  const [moveHistory, setMoveHistory] = useState([]);
  const [lastMoveInfo, setLastMoveInfo] = useState({ move: null, isPlayer: false });

  const sfRef = useRef(null);
  const waitingMove = useRef(false);

  const updateLegal = useCallback(() => {
    setLegalMoves(chess.moves({ verbose: true }).map(m => m.from + m.to + (m.promotion || '')));
  }, [chess]);

  const initEngine = useCallback((skill) => {
    if (sfRef.current) sfRef.current.terminate();
    const blob = new Blob([`importScripts('${STOCKFISH_CDN}');`], { type: 'application/javascript' });
    const engine = new Worker(URL.createObjectURL(blob));
    sfRef.current = engine;
    engine.postMessage('uci');
    engine.postMessage(`setoption name Skill Level value ${SKILL_LEVELS[skill]}`);
    engine.postMessage('isready');
    engine.onmessage = (event) => {
      const msg = event.data;
      if (msg.startsWith('bestmove') && waitingMove.current) {
        waitingMove.current = false;
        const best = msg.split(' ')[1];
        if (!best || best === '(none)') return;
        const move = chess.move({ from: best.slice(0,2), to: best.slice(2,4), promotion: best[4] || 'q' });
        if (move) {
          setFen(chess.fen());
          setLastMove(best.slice(0,2) + best.slice(2,4));
          setMoveHistory(h => [...h, { san: move.san, color: move.color }]);
          setLastMoveInfo({ move: best.slice(0,4), isPlayer: false });
          setThinking(false);
          updateLegal();
          checkGameOver();
        }
      }
    };
  }, [chess, updateLegal]);

  function checkGameOver() {
    if (!chess.isGameOver()) return;
    let result = 'draw', reason = 'stalemate';
    if (chess.isCheckmate()) { result = chess.turn() === 'w' ? 'black' : 'white'; reason = 'checkmate'; }
    else if (chess.isStalemate()) reason = 'stalemate';
    else if (chess.isThreefoldRepetition()) reason = 'repetition';
    else if (chess.isInsufficientMaterial()) reason = 'insufficient material';
    setGameOver({ result, reason });
    toast({ title: 'Game Over', description: `${result === 'draw' ? 'Draw' : `${result} wins`} by ${reason}` });
  }

  function requestAiMove() {
    if (!sfRef.current || gameOver) return;
    waitingMove.current = true;
    setThinking(true);
    sfRef.current.postMessage(`position fen ${chess.fen()}`);
    sfRef.current.postMessage('go movetime 1000');
  }

  const handleMove = useCallback((uci) => {
    if (thinking || gameOver) return;
    const turn = chess.turn() === 'w' ? 'white' : 'black';
    if (turn !== playerColor) return;
    const from = uci.slice(0,2), to = uci.slice(2,4), promo = uci[4];
    const move = chess.move({ from, to, promotion: promo || 'q' });
    if (!move) return;
    setFen(chess.fen());
    setLastMove(from + to);
    setMoveHistory(h => [...h, { san: move.san, color: move.color }]);
    setLastMoveInfo({ move: from + to, isPlayer: true });
    updateLegal();
    if (chess.isGameOver()) { checkGameOver(); return; }
    setTimeout(requestAiMove, 200);
  }, [chess, playerColor, thinking, gameOver, updateLegal]);

  function startGame() {
    chess.reset();
    setFen(chess.fen());
    setLastMove(null);
    setGameOver(null);
    setMoveHistory([]);
    setLastMoveInfo({ move: null, isPlayer: false });
    setThinking(false);
    waitingMove.current = false;
    updateLegal();
    initEngine(difficulty);
    setStarted(true);
    if (playerColor === 'black') setTimeout(requestAiMove, 500);
  }

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 100);
    return () => { clearTimeout(t); sfRef.current?.terminate(); };
  }, []);

  const flipped = playerColor === 'black';
  const inCheck = chess.inCheck()
    ? chess.board().flat().find(p => p?.type === 'k' && p.color === chess.turn())?.square
    : null;

  const DIFF_CONFIG = {
    easy:   { clr: '#22c55e', cls: 'easy',   icon: '♙', sub: 'Best for Beginners' },
    medium: { clr: 'hsl(var(--primary))', cls: 'medium', icon: '♘', sub: 'A Good Challenge' },
    hard:   { clr: '#ef4444', cls: 'hard',   icon: '♛', sub: 'For Experts' },
  };

  const tr = { opacity: mounted ? 1 : 0, transform: mounted ? 'translateY(0)' : 'translateY(20px)', transition: 'all 0.6s ease' };

  if (!started) {
    return (
      <div style={{ minHeight: '100vh', position: 'relative', overflow: 'auto', background: 'radial-gradient(ellipse 68% 65% at 72% 48%, rgba(38,16,100,0.56) 0%, transparent 62%), linear-gradient(175deg,#060810,#0d1018)' }}>
        {/* cf-ai-orb hidden on very small screens */}
        <div className="cf-ai-orb" style={{ position: 'absolute', right: '6%', top: '10%', width: 'min(290px,29vw)', pointerEvents: 'none', animation: 'float 5s ease-in-out infinite', filter: 'drop-shadow(0 0 50px rgba(120,60,240,0.35))' }}>
          <AIOrb />
        </div>

        <div className="cf-playai-pregame" style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 28, paddingBottom: 32, paddingLeft: 16, paddingRight: 16 }}>
          <div style={{ textAlign: 'center', marginBottom: 22, ...tr }}>
            <h1 className="font-serif" style={{ fontSize: 'clamp(1.8rem,3.5vw,2.8rem)', fontWeight: 700 }}>Play vs AI</h1>
            <p style={{ fontSize: '0.76rem', color: 'hsl(var(--muted-foreground))', marginTop: 4 }}>Challenge our advanced AI with adaptive difficulty.</p>
          </div>

          <div className="cf-form-card" style={{ padding: '24px 28px', ...tr, transitionDelay: '0.06s' }}>
            <div style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'hsl(var(--muted-foreground))', marginBottom: 10 }}>Select Difficulty</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 20 }}>
              {DIFFICULTIES.map((lvl, i) => {
                const cfg = DIFF_CONFIG[lvl];
                return (
                  <div key={lvl} className={`cf-diff-btn ${cfg.cls}${difficulty === lvl ? ' active' : ''}`} onClick={() => setDifficulty(lvl)} style={{ animationDelay: `${i * 0.08 + 0.1}s` }}>
                    <div style={{ fontSize: '1.8rem', marginBottom: 7, lineHeight: 1 }}>{cfg.icon}</div>
                    <div style={{ fontSize: '0.84rem', fontWeight: 700, color: cfg.clr, textTransform: 'capitalize' }}>{lvl}</div>
                    <div style={{ fontSize: '0.66rem', color: 'hsl(var(--muted-foreground))', marginTop: 3 }}>{cfg.sub}</div>
                  </div>
                );
              })}
            </div>

            <div style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'hsl(var(--muted-foreground))', marginBottom: 8 }}>Play as</div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, marginBottom: 20 }}>
              <span style={{ fontSize: '0.78rem', color: playerColor === 'white' ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))', fontWeight: playerColor === 'white' ? 600 : 400, transition: 'all 0.2s' }}>White</span>
              <div className={`cf-toggle${playerColor === 'black' ? ' on' : ''}`} onClick={() => setPlayerColor(p => p === 'white' ? 'black' : 'white')}>
                <div className="cf-toggle-knob" />
              </div>
              <span style={{ fontSize: '0.78rem', color: playerColor === 'black' ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))', fontWeight: playerColor === 'black' ? 600 : 400, transition: 'all 0.2s' }}>Black</span>
            </div>

            <button className="cf-find-btn" onClick={startGame}>▶ Start Game</button>
            <div style={{ textAlign: 'center', fontSize: '0.66rem', color: 'hsl(var(--muted-foreground))', marginTop: 10 }}>
              💡 TIP: You can change difficulty anytime during the game
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '12px 10px', maxWidth: 960, margin: '0 auto' }}>
      {/* cf-playai-game: 2-col on desktop, 1-col on mobile */}
      <div className="cf-playai-game" style={{ display: 'grid', gridTemplateColumns: '1fr 260px', gap: 14 }}>

        {/* Board column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, padding: '8px 14px', fontSize: '0.8rem' }}>
            <span style={{ fontWeight: 500, textTransform: 'capitalize' }}>AI Opponent ({difficulty})</span>
            {thinking && <span style={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.72rem', animation: 'pulse 1.2s infinite' }}>Thinking...</span>}
          </div>
          <ChessBoard fen={fen} flipped={flipped} legalMoves={!gameOver ? legalMoves : []} onMove={handleMove} lastMove={lastMove} highlightCheck={inCheck} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, padding: '8px 14px', fontSize: '0.8rem' }}>
            <span style={{ fontWeight: 500, textTransform: 'capitalize' }}>You ({playerColor})</span>
            {gameOver && <span style={{ color: 'hsl(var(--primary))', fontWeight: 600, fontSize: '0.72rem' }}>Game over</span>}
          </div>
        </div>

        {/* Sidebar — cf-playai-sidebar goes horizontal row on mobile */}
        <div className="cf-playai-sidebar" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

          {/* Actions */}
          <div className="cf-playai-actions">
            {gameOver && (
              <div style={{ background: 'rgba(245,197,24,0.08)', border: '1px solid hsl(var(--primary))', borderRadius: 10, padding: 14, textAlign: 'center', marginBottom: 10 }}>
                <p style={{ fontWeight: 700, color: 'hsl(var(--primary))', marginBottom: 6 }}>Game Over</p>
                <p style={{ fontSize: '0.8rem', textTransform: 'capitalize', marginBottom: 10 }}>
                  {gameOver.result === 'draw' ? 'Draw' : gameOver.result === playerColor ? 'You win! 🎉' : 'You lose.'} · {gameOver.reason}
                </p>
                <Button size="sm" onClick={() => setStarted(false)}>New Game</Button>
              </div>
            )}
            {!gameOver && <Button variant="outline" size="sm" style={{ width: '100%' }} onClick={() => setStarted(false)}>← New Game</Button>}
          </div>

          {/* AI Chat */}
          <div className="cf-playai-chat" style={{ minWidth: 0 }}>
            <AiChat
              lastMove={lastMoveInfo.move}
              fen={fen}
              isPlayerMove={lastMoveInfo.isPlayer}
            />
          </div>
        </div>
      </div>
    </div>
  );
}