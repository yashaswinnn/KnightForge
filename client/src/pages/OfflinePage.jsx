import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Chess } from 'chess.js';
import { ChessBoard } from '../components/ChessBoard.jsx';
import { Button } from '../components/ui/button.jsx';
import { cn } from '../lib/utils.js';
import { toast } from '../hooks/use-toast.js';

/* ─── Stockfish ────────────────────────────────────────────── */
const STOCKFISH_CDN = 'https://cdn.jsdelivr.net/npm/stockfish.js@10.0.2/stockfish.js';
const SKILL_LEVELS  = { easy: 2, medium: 8, hard: 18 };

/* ─── Time controls for local game ─────────────────────────── */
const TIME_CONTROLS = [
  { label: 'Bullet 1m',   seconds: 60   },
  { label: 'Blitz 3m',    seconds: 180  },
  { label: 'Rapid 10m',   seconds: 600  },
  { label: '∞ Unlimited', seconds: null },
];

function formatTime(secs) {
  if (secs == null) return '∞';
  const m = Math.floor(secs / 60).toString().padStart(2, '0');
  const s = (secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

/* ══════════════════════════════════════════════════════════════
   MOVE LIST – shared by both modes
══════════════════════════════════════════════════════════════ */
function MoveList({ moves }) {
  const endRef = useRef(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [moves]);

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="px-3 py-2 border-b border-border text-xs text-muted-foreground font-medium">
        Moves
      </div>
      <div className="p-3 max-h-64 overflow-y-auto">
        <div className="grid grid-cols-[auto_1fr_1fr] gap-x-2 gap-y-0.5 text-sm font-mono">
          {Array.from({ length: Math.ceil(moves.length / 2) }).map((_, i) => {
            const white = moves[i * 2];
            const black = moves[i * 2 + 1];
            return (
              <React.Fragment key={i}>
                <span className="text-muted-foreground text-xs">{i + 1}.</span>
                <span>{white?.san || ''}</span>
                <span>{black?.san || ''}</span>
              </React.Fragment>
            );
          })}
        </div>
        <div ref={endRef} />
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   MODE SELECTOR – landing screen
══════════════════════════════════════════════════════════════ */
function ModeSelector({ onSelect }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] gap-8 px-4">

      {/* Offline badge */}
      <div className="flex items-center gap-2 bg-destructive/10 border border-destructive/30 rounded-full px-4 py-1.5">
        <span className="w-2 h-2 rounded-full bg-destructive animate-pulse inline-block" />
        <span className="text-destructive text-sm font-medium">You're offline</span>
      </div>

      <div className="text-center space-y-2">
        <h1 className="font-serif text-4xl md:text-5xl font-bold">
          Play Chess <span className="text-primary">Offline</span>
        </h1>
        <p className="text-muted-foreground text-sm max-w-sm mx-auto">
          No internet? No problem. Choose a mode below to keep playing.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-5 w-full max-w-xl">
        {/* vs AI card */}
        <button
          onClick={() => onSelect('ai')}
          className="group bg-card border border-border hover:border-primary/60 rounded-2xl p-7 text-left transition-all hover:shadow-[0_0_24px_rgba(245,197,24,0.12)] space-y-3"
        >
          <div className="text-5xl">🤖</div>
          <div>
            <h2 className="text-lg font-bold group-hover:text-primary transition-colors">Play vs AI</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Challenge Stockfish at Easy, Medium, or Hard difficulty.
            </p>
          </div>
          <div className="text-xs text-primary font-medium opacity-0 group-hover:opacity-100 transition-opacity">
            Start playing →
          </div>
        </button>

        {/* 2-player card */}
        <button
          onClick={() => onSelect('local')}
          className="group bg-card border border-border hover:border-primary/60 rounded-2xl p-7 text-left transition-all hover:shadow-[0_0_24px_rgba(245,197,24,0.12)] space-y-3"
        >
          <div className="text-5xl">♟</div>
          <div>
            <h2 className="text-lg font-bold group-hover:text-primary transition-colors">2-Player Local</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Pass &amp; play on the same screen with a friend.
            </p>
          </div>
          <div className="text-xs text-primary font-medium opacity-0 group-hover:opacity-100 transition-opacity">
            Start playing →
          </div>
        </button>
      </div>

      <p className="text-xs text-muted-foreground">
        Internet restored?{' '}
        <button
          className="text-primary underline underline-offset-2"
          onClick={() => {
            if (navigator.onLine) {
              window.location.assign('/');
            } else {
              window.location.reload();
            }
          }}
        >
          Reload the app
        </button>
      </p>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   AI GAME
══════════════════════════════════════════════════════════════ */
function AIGame({ onBack }) {
  const [difficulty, setDifficulty]   = useState('medium');
  const [playerColor, setPlayerColor] = useState('white');
  const [started, setStarted]         = useState(false);

  const [chess]       = useState(() => new Chess());
  const [fen, setFen] = useState(chess.fen());
  const [legalMoves, setLegalMoves]   = useState([]);
  const [lastMove, setLastMove]       = useState(null);
  const [gameOver, setGameOver]       = useState(null);
  const [thinking, setThinking]       = useState(false);
  const [moveHistory, setMoveHistory] = useState([]);

  const sfRef       = useRef(null);
  const waitingMove = useRef(false);

  const updateLegal = useCallback(() => {
    setLegalMoves(chess.moves({ verbose: true }).map(m => m.from + m.to + (m.promotion || '')));
  }, [chess]);

  const initStockfish = useCallback((skill) => {
    if (sfRef.current) sfRef.current.terminate();
    const blob = new Blob([`importScripts('${STOCKFISH_CDN}');`], { type: 'application/javascript' });
    const sf   = new Worker(URL.createObjectURL(blob));
    sfRef.current = sf;
    sf.postMessage('uci');
    sf.postMessage(`setoption name Skill Level value ${SKILL_LEVELS[skill]}`);
    sf.postMessage('isready');
    sf.onmessage = (e) => {
      const msg = e.data;
      if (msg.startsWith('bestmove') && waitingMove.current) {
        waitingMove.current = false;
        const best = msg.split(' ')[1];
        if (!best || best === '(none)') return;
        const from = best.slice(0, 2), to = best.slice(2, 4), promo = best[4];
        const move = chess.move({ from, to, promotion: promo || 'q' });
        if (move) {
          setFen(chess.fen());
          setLastMove(from + to);
          setMoveHistory(h => [...h, { san: move.san, color: move.color }]);
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
    if (chess.isCheckmate())             { result = chess.turn() === 'w' ? 'black' : 'white'; reason = 'checkmate'; }
    else if (chess.isStalemate())        reason = 'stalemate';
    else if (chess.isThreefoldRepetition()) reason = 'repetition';
    else if (chess.isInsufficientMaterial()) reason = 'insufficient material';
    setGameOver({ result, reason });
    toast({ title: 'Game Over', description: `${result === 'draw' ? 'Draw' : result + ' wins'} by ${reason}` });
  }

  const requestAiMove = useCallback(() => {
    if (!sfRef.current || gameOver) return;
    waitingMove.current = true;
    setThinking(true);
    sfRef.current.postMessage(`position fen ${chess.fen()}`);
    sfRef.current.postMessage('go movetime 1000');
  }, [chess, gameOver]);

  const handleMove = useCallback((uci) => {
    if (thinking || gameOver) return;
    if ((chess.turn() === 'w' ? 'white' : 'black') !== playerColor) return;
    const from = uci.slice(0, 2), to = uci.slice(2, 4), promo = uci[4];
    const move = chess.move({ from, to, promotion: promo || 'q' });
    if (!move) return;
    setFen(chess.fen());
    setLastMove(from + to);
    setMoveHistory(h => [...h, { san: move.san, color: move.color }]);
    updateLegal();
    if (chess.isGameOver()) { checkGameOver(); return; }
    setTimeout(requestAiMove, 200);
  }, [chess, playerColor, thinking, gameOver, updateLegal, requestAiMove]);

  function startGame() {
    chess.reset();
    setFen(chess.fen());
    setLastMove(null);
    setGameOver(null);
    setMoveHistory([]);
    setThinking(false);
    waitingMove.current = false;
    updateLegal();
    initStockfish(difficulty);
    setStarted(true);
    if (playerColor === 'black') setTimeout(requestAiMove, 500);
  }

  useEffect(() => () => sfRef.current?.terminate(), []);

  const flipped    = playerColor === 'black';
  const inCheck    = chess.inCheck()
    ? chess.board().flat().find(p => p?.type === 'k' && p.color === chess.turn())?.square
    : null;

  /* Setup screen */
  if (!started) {
    return (
      <div className="max-w-md mx-auto mt-8 space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="text-muted-foreground hover:text-foreground transition-colors text-sm flex items-center gap-1">
            ← Back
          </button>
          <div>
            <h1 className="font-serif text-2xl font-bold">Play vs AI</h1>
            <p className="text-muted-foreground text-xs">Powered by Stockfish</p>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-6 space-y-5">
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Difficulty</label>
            <div className="flex gap-2">
              {['easy', 'medium', 'hard'].map(d => (
                <button
                  key={d}
                  onClick={() => setDifficulty(d)}
                  className={cn(
                    'flex-1 py-2 rounded-lg border text-sm font-medium capitalize transition-all',
                    difficulty === d
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-muted border-border hover:border-primary/40'
                  )}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Play as</label>
            <div className="flex gap-2">
              {['white', 'black'].map(c => (
                <button
                  key={c}
                  onClick={() => setPlayerColor(c)}
                  className={cn(
                    'flex-1 py-2 rounded-lg border text-sm font-medium capitalize transition-all',
                    playerColor === c
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-muted border-border hover:border-primary/40'
                  )}
                >
                  {c === 'white' ? '♔ White' : '♚ Black'}
                </button>
              ))}
            </div>
          </div>

          <Button className="w-full" size="lg" onClick={startGame}>Start Game</Button>
        </div>
      </div>
    );
  }

  /* Game screen */
  return (
    <div className="grid lg:grid-cols-[1fr_260px] gap-6 max-w-5xl mx-auto">
      <div className="space-y-2">
        <div className="flex items-center justify-between bg-card border border-border rounded-lg px-4 py-2 text-sm">
          <span className="font-medium">🤖 Stockfish ({difficulty})</span>
          {thinking && <span className="text-muted-foreground text-xs animate-pulse">Thinking…</span>}
        </div>

        <ChessBoard
          fen={fen}
          flipped={flipped}
          legalMoves={!gameOver ? legalMoves : []}
          onMove={handleMove}
          lastMove={lastMove}
          highlightCheck={inCheck}
        />

        <div className="flex items-center justify-between bg-card border border-border rounded-lg px-4 py-2 text-sm">
          <span className="font-medium capitalize">You ({playerColor})</span>
          {gameOver && <span className="text-primary font-semibold text-xs">Game over</span>}
        </div>
      </div>

      <div className="space-y-4">
        {gameOver ? (
          <div className="bg-primary/10 border border-primary rounded-lg p-4 text-center space-y-2">
            <p className="font-bold text-primary text-lg">Game Over</p>
            <p className="text-sm capitalize">
              {gameOver.result === 'draw' ? 'Draw' : gameOver.result === playerColor ? 'You win! 🎉' : 'You lose.'} · {gameOver.reason}
            </p>
            <div className="flex gap-2 justify-center">
              <Button size="sm" onClick={() => setStarted(false)}>New Game</Button>
              <Button size="sm" variant="outline" onClick={onBack}>Menu</Button>
            </div>
          </div>
        ) : (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex-1" onClick={() => setStarted(false)}>New Game</Button>
            <Button variant="ghost" size="sm" onClick={onBack}>Menu</Button>
          </div>
        )}

        <MoveList moves={moveHistory} />
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   LOCAL 2-PLAYER GAME
══════════════════════════════════════════════════════════════ */
function LocalGame({ onBack }) {
  const [timeControl, setTimeControl] = useState(TIME_CONTROLS[1]); // Blitz 3m default
  const [started, setStarted]         = useState(false);

  const [chess]       = useState(() => new Chess());
  const [fen, setFen] = useState(chess.fen());
  const [legalMoves, setLegalMoves]   = useState([]);
  const [lastMove, setLastMove]       = useState(null);
  const [gameOver, setGameOver]       = useState(null);
  const [moveHistory, setMoveHistory] = useState([]);
  const [timeWhite, setTimeWhite]     = useState(null);
  const [timeBlack, setTimeBlack]     = useState(null);

  const timerRef = useRef(null);

  const updateLegal = useCallback(() => {
    setLegalMoves(chess.moves({ verbose: true }).map(m => m.from + m.to + (m.promotion || '')));
  }, [chess]);

  function startGame() {
    chess.reset();
    setFen(chess.fen());
    setLastMove(null);
    setGameOver(null);
    setMoveHistory([]);
    setTimeWhite(timeControl.seconds);
    setTimeBlack(timeControl.seconds);
    updateLegal();
    setStarted(true);
  }

  /* Clock */
  useEffect(() => {
    if (!started || gameOver || timeControl.seconds === null) return;
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      const turn = chess.turn();
      if (turn === 'w') {
        setTimeWhite(t => {
          if (t <= 1) { clearInterval(timerRef.current); endGame({ result: 'black', reason: 'timeout' }); return 0; }
          return t - 1;
        });
      } else {
        setTimeBlack(t => {
          if (t <= 1) { clearInterval(timerRef.current); endGame({ result: 'white', reason: 'timeout' }); return 0; }
          return t - 1;
        });
      }
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [started, gameOver, fen]);

  function endGame(info) {
    clearInterval(timerRef.current);
    setGameOver(info);
    const title = info.result === 'draw' ? 'Draw!' : `${info.result === 'white' ? '♔ White' : '♚ Black'} wins!`;
    toast({ title, description: `by ${info.reason}` });
  }

  const handleMove = useCallback((uci) => {
    if (gameOver) return;
    const from = uci.slice(0, 2), to = uci.slice(2, 4), promo = uci[4];
    const move = chess.move({ from, to, promotion: promo || 'q' });
    if (!move) return;
    setFen(chess.fen());
    setLastMove(from + to);
    setMoveHistory(h => [...h, { san: move.san, color: move.color }]);
    updateLegal();
    if (chess.isGameOver()) {
      let result = 'draw', reason = 'stalemate';
      if (chess.isCheckmate())             { result = move.color === 'w' ? 'white' : 'black'; reason = 'checkmate'; }
      else if (chess.isStalemate())        reason = 'stalemate';
      else if (chess.isThreefoldRepetition()) reason = 'repetition';
      else if (chess.isInsufficientMaterial()) reason = 'insufficient material';
      endGame({ result, reason });
    }
  }, [chess, gameOver, updateLegal]);

  function resign() {
    if (gameOver) return;
    const turn    = chess.turn();
    const winner  = turn === 'w' ? 'black' : 'white';
    endGame({ result: winner, reason: 'resignation' });
  }

  function offerDraw() {
    if (gameOver) return;
    const next = chess.turn() === 'w' ? 'Black' : 'White';
    if (window.confirm(`${next}: accept the draw offer?`)) endGame({ result: 'draw', reason: 'agreement' });
  }

  const turn     = chess.turn();
  const inCheck  = chess.inCheck()
    ? chess.board().flat().find(p => p?.type === 'k' && p.color === turn)?.square
    : null;
  const hasClock = timeControl.seconds !== null;

  /* Setup screen */
  if (!started) {
    return (
      <div className="max-w-md mx-auto mt-8 space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="text-muted-foreground hover:text-foreground transition-colors text-sm flex items-center gap-1">
            ← Back
          </button>
          <div>
            <h1 className="font-serif text-2xl font-bold">2-Player Local</h1>
            <p className="text-muted-foreground text-xs">Pass &amp; play on the same screen</p>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-6 space-y-5">
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Time Control</label>
            <div className="grid grid-cols-2 gap-2">
              {TIME_CONTROLS.map(tc => (
                <button
                  key={tc.label}
                  onClick={() => setTimeControl(tc)}
                  className={cn(
                    'py-2 rounded-lg border text-sm font-medium transition-all',
                    timeControl.label === tc.label
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-muted border-border hover:border-primary/40'
                  )}
                >
                  {tc.label}
                </button>
              ))}
            </div>
          </div>

          <Button className="w-full" size="lg" onClick={startGame}>Start Game</Button>
        </div>
      </div>
    );
  }

  /* Game screen */
  return (
    <div className="grid lg:grid-cols-[1fr_260px] gap-6 max-w-5xl mx-auto">
      <div className="space-y-2">
        {/* Top player (Black) */}
        <div className="flex items-center justify-between bg-card border border-border rounded-lg px-4 py-2">
          <span className="font-medium text-sm">♚ Black</span>
          {hasClock && (
            <span className={cn('font-mono text-lg font-bold', timeBlack != null && timeBlack <= 10 && 'text-red-500')}>
              {formatTime(timeBlack)}
            </span>
          )}
        </div>

        {/* Turn indicator */}
        {!gameOver && (
          <div className={cn(
            'text-center text-sm font-semibold py-1.5 rounded-lg border transition-colors',
            turn === 'w'
              ? 'bg-primary/10 border-primary/30 text-primary'
              : 'bg-muted border-border text-muted-foreground'
          )}>
            {turn === 'w' ? '♔ White to move' : '♚ Black to move'}
          </div>
        )}

        <ChessBoard
          fen={fen}
          legalMoves={!gameOver ? legalMoves : []}
          onMove={handleMove}
          lastMove={lastMove}
          highlightCheck={inCheck}
        />

        {/* Bottom player (White) */}
        <div className="flex items-center justify-between bg-card border border-border rounded-lg px-4 py-2">
          <span className="font-medium text-sm">♔ White</span>
          {hasClock && (
            <span className={cn('font-mono text-lg font-bold', timeWhite != null && timeWhite <= 10 && 'text-red-500')}>
              {formatTime(timeWhite)}
            </span>
          )}
        </div>
      </div>

      <div className="space-y-4">
        {gameOver ? (
          <div className="bg-primary/10 border border-primary rounded-lg p-4 text-center space-y-2">
            <p className="font-bold text-primary text-lg">
              {gameOver.result === 'draw' ? 'Draw!' : `${gameOver.result === 'white' ? '♔ White' : '♚ Black'} wins!`}
            </p>
            <p className="text-sm text-muted-foreground">by {gameOver.reason}</p>
            <div className="flex gap-2 justify-center">
              <Button size="sm" onClick={startGame}>New Game</Button>
              <Button size="sm" variant="outline" onClick={onBack}>Menu</Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <Button variant="destructive" size="sm" className="w-full" onClick={resign}>Resign</Button>
            <Button variant="outline"     size="sm" className="w-full" onClick={offerDraw}>Offer Draw</Button>
            <Button variant="ghost"       size="sm" className="w-full" onClick={onBack}>Menu</Button>
          </div>
        )}

        <MoveList moves={moveHistory} />
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   ROOT EXPORT
══════════════════════════════════════════════════════════════ */
export default function OfflinePage() {
  const [mode, setMode] = useState(null); // null | 'ai' | 'local'

  if (mode === 'ai')    return <AIGame    onBack={() => setMode(null)} />;
  if (mode === 'local') return <LocalGame onBack={() => setMode(null)} />;
  return <ModeSelector onSelect={setMode} />;
}