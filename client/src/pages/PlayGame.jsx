import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useParams } from 'wouter';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { io } from 'socket.io-client';
import { Chess } from 'chess.js';
import { createGame, getGame } from '../lib/api.js';
import { useAuth } from '../hooks/useAuth.js';
import { useAuthStore } from '../store/authStore.js';
import { ChessBoard } from '../components/ChessBoard.jsx';
import { Button } from '../components/ui/button.jsx';
import { Input } from '../components/ui/input.jsx';
import { Avatar } from '../components/Avatar.jsx';
import { toast } from '../hooks/use-toast.js';

function formatTime(secs) {
  const safeSeconds = Math.max(0, secs ?? 0);
  const m = Math.floor(safeSeconds / 60).toString().padStart(2, '0');
  const s = (safeSeconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

const GRACE_SECONDS = 15;

export default function PlayGame() {
  const { gameId } = useParams();
  const { user } = useAuth();
  const { token } = useAuthStore();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const [chess] = useState(() => new Chess());
  const [fen, setFen] = useState(chess.fen());
  const [legalMoves, setLegalMoves] = useState([]);
  const [lastMove, setLastMove] = useState(null);
  const [gameOver, setGameOver] = useState(null);
  const [myColor, setMyColor] = useState(null);
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [timeWhite, setTimeWhite] = useState(null);
  const [timeBlack, setTimeBlack] = useState(null);
  const [, setClockTick] = useState(0);
  const [drawOffered, setDrawOffered] = useState(false);
  const [rematchRequested, setRematchRequested] = useState(false);
  const [incomingRematch, setIncomingRematch] = useState(false);
  const [rematchFrom, setRematchFrom] = useState(null);
  const [rematchResponse, setRematchResponse] = useState(null);
  const [waitingLeft, setWaitingLeft] = useState(120);
  const [phase, setPhase] = useState('waiting');
  const [graceLeft, setGraceLeft] = useState(GRACE_SECONDS);
  const [ratingChange, setRatingChange] = useState(null);
  const [replayMode, setReplayMode] = useState(false);
  const [replayMoves, setReplayMoves] = useState([]);
  const [replayIndex, setReplayIndex] = useState(0);
  const [actionPending, setActionPending] = useState(null);

  const phaseRef = useRef('waiting');
  const socketRef = useRef(null);
  const timerRef = useRef(null);
  const graceRef = useRef(null);
  const waitingRef = useRef(null);
  const chatEndRef = useRef(null);
  const abandonSentRef = useRef(false);
  const flagSentRef = useRef(false);
  const serverTimeRef = useRef(null);
  const localTimeRef = useRef(null);
  const timeWhiteRef = useRef(null);
  const timeBlackRef = useRef(null);

  const setPhaseSync = (nextPhase) => {
    phaseRef.current = nextPhase;
    setPhase(nextPhase);
  };

  useEffect(() => { timeWhiteRef.current = timeWhite; }, [timeWhite]);
  useEffect(() => { timeBlackRef.current = timeBlack; }, [timeBlack]);

  const { data: gameData, refetch } = useQuery({
    queryKey: ['game', gameId],
    queryFn: () => getGame(gameId),
    enabled: !!gameId,
  });

  const createNextGame = useMutation({
    mutationFn: (data) => createGame(data),
    onSuccess: (game) => { setLocation(`/play/${game.id || game._id}`); },
    onError: (err) => {
      toast({ title: 'Unable to start next game', description: err.message, variant: 'destructive' });
    },
  });

  const updateLegal = useCallback(() => {
    setLegalMoves(chess.moves({ verbose: true }).map((move) => move.from + move.to + (move.promotion || '')));
  }, [chess]);

  const getDisplayedClocks = useCallback(() => {
    const whiteBase = timeWhiteRef.current;
    const blackBase = timeBlackRef.current;

    if (whiteBase == null || blackBase == null) {
      return { white: whiteBase, black: blackBase };
    }

    if (phaseRef.current !== 'playing' || gameOver || localTimeRef.current == null) {
      return { white: whiteBase, black: blackBase };
    }

    const elapsedSeconds = Math.floor((Date.now() - localTimeRef.current) / 1000);
    if (elapsedSeconds <= 0) {
      return { white: whiteBase, black: blackBase };
    }

    if (chess.turn() === 'w') {
      return {
        white: Math.max(0, whiteBase - elapsedSeconds),
        black: blackBase,
      };
    }

    return {
      white: whiteBase,
      black: Math.max(0, blackBase - elapsedSeconds),
    };
  }, [chess, gameOver]);

  const syncClockAnchor = useCallback((serverTime, useReceiptTime = false) => {
    if (!serverTime) {
      serverTimeRef.current = null;
      localTimeRef.current = null;
      return;
    }

    serverTimeRef.current = serverTime;
    localTimeRef.current = useReceiptTime ? Date.now() : serverTime;
  }, []);

  const getGameOverText = (over) => {
    if (!over) return '';
    if (over.reason === 'abandoned') return 'Match abandoned';
    if (over.result === 'draw') return `Draw by ${over.reason}`;
    return `${over.result} wins by ${over.reason}`;
  };

  const getOutcomeContent = useCallback(() => {
    if (!gameOver) {
      return {
        title: 'Game Over',
        subtitle: '',
        accent: 'hsl(var(--primary))',
      };
    }

    if (gameOver.result === 'draw') {
      return {
        title: 'Draw Game',
        subtitle: 'The match ended in a draw.',
        accent: '#d97706',
      };
    }

    if (!myColor) {
      return {
        title: 'Game Over',
        subtitle: getGameOverText(gameOver),
        accent: 'hsl(var(--primary))',
      };
    }

    const won = gameOver.result === myColor;
    return {
      title: won ? 'Congratulations, You Win!' : 'Oops, Better Luck Next Time',
      subtitle: won ? 'You won this match.' : 'Your opponent won this match.',
      accent: won ? '#16a34a' : '#dc2626',
    };
  }, [gameOver, myColor]);

  const formatRatingChange = (delta) => {
    if (typeof delta !== 'number') return '';
    if (delta > 0) return `+${delta} up`;
    if (delta < 0) return `${delta} down`;
    return '0';
  };

  const buildReplayState = useCallback((pgnText) => {
    const replayGame = new Chess();
    if (pgnText) replayGame.loadPgn(pgnText);
    const history = replayGame.history({ verbose: true });
    const walker = new Chess();
    history.forEach((move) => {
      try {
        walker.move(move);
      } catch {}
    });
    setReplayMoves(history);
    setReplayIndex(history.length);
    setFen(walker.fen());
    return { history };
  }, []);

  useEffect(() => {
    chess.reset();
    setFen(chess.fen());
    setLegalMoves([]);
    setLastMove(null);
    setGameOver(null);
    setMyColor(null);
    setMessages([]);
    setChatInput('');
    setTimeWhite(null);
    setTimeBlack(null);
    setDrawOffered(false);
    setRematchRequested(false);
    setIncomingRematch(false);
    setRematchFrom(null);
    setRematchResponse(null);
    setWaitingLeft(120);
    setGraceLeft(GRACE_SECONDS);
    setRatingChange(null);
    setReplayMode(false);
    setReplayMoves([]);
    setReplayIndex(0);
    setActionPending(null);
    abandonSentRef.current = false;
    flagSentRef.current = false;
    syncClockAnchor(null);
    clearInterval(timerRef.current);
    clearInterval(graceRef.current);
    clearInterval(waitingRef.current);
    setPhaseSync('waiting');
    updateLegal();
  }, [gameId, chess, updateLegal, syncClockAnchor]);

  useEffect(() => {
    if (!gameData || !user) return;

    const uid = user._id || user.id;
    if (gameData.whitePlayerId === uid) setMyColor('white');
    else if (gameData.blackPlayerId === uid) setMyColor('black');
    else setMyColor(null);

    if (gameData.fen) {
      chess.load(gameData.fen);
      setFen(gameData.fen);
    }

    if (gameData.timeWhite != null) setTimeWhite(gameData.timeWhite);
    if (gameData.timeBlack != null) setTimeBlack(gameData.timeBlack);

    if (gameData.lastMoveAt && (gameData.moveCount || 0) > 0) {
      const lastMoveMs = new Date(gameData.lastMoveAt).getTime();
      syncClockAnchor(Number.isNaN(lastMoveMs) ? null : lastMoveMs);
    } else {
      syncClockAnchor(null);
    }

    updateLegal();

    if (gameData.status === 'completed') {
      setReplayMode(true);
      buildReplayState(gameData.pgn || '');
      setGameOver({ result: gameData.result, reason: gameData.termination });
      setPhaseSync('over');
      clearInterval(timerRef.current);
      clearInterval(graceRef.current);
      clearInterval(waitingRef.current);
      return;
    }

    setReplayMode(false);
    setReplayMoves([]);
    setReplayIndex(0);

    const hasHistory = chess.history().length > 0;
    const bothJoined = !!(gameData.whitePlayerId && gameData.blackPlayerId);

    setGameOver(null);
    setRatingChange(null);

    if (hasHistory) {
      setPhaseSync('playing');
      clearInterval(waitingRef.current);
    } else if (bothJoined) {
      startGrace();
      clearInterval(waitingRef.current);
    } else {
      setPhaseSync('waiting');
      setWaitingLeft(120);
      clearInterval(waitingRef.current);
      waitingRef.current = setInterval(() => {
        setWaitingLeft((prev) => {
          if (prev <= 1) {
            clearInterval(waitingRef.current);
            setPhaseSync('retry');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
  }, [gameData, user, chess, updateLegal, buildReplayState, syncClockAnchor]);

  function startGrace() {
    if (phaseRef.current === 'grace' || phaseRef.current === 'playing') return;
    abandonSentRef.current = false;
    setPhaseSync('grace');
    setGraceLeft(GRACE_SECONDS);
    clearInterval(graceRef.current);
    graceRef.current = setInterval(() => {
      setGraceLeft((prev) => {
        if (prev <= 1) {
          clearInterval(graceRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  useEffect(() => {
    if (phase !== 'grace' || graceLeft > 0 || gameOver || abandonSentRef.current) return;
    abandonSentRef.current = true;
    clearInterval(graceRef.current);
    setGameOver({ result: 'black', reason: 'abandoned' });
    setPhaseSync('over');
    socketRef.current?.emit('abandon_game', { gameId });
  }, [phase, graceLeft, gameOver, gameId]);

  useEffect(() => () => clearInterval(waitingRef.current), []);

  useEffect(() => {
    if (phase !== 'playing' || gameOver || timeWhite == null || timeBlack == null) {
      clearInterval(timerRef.current);
      return;
    }

    flagSentRef.current = false;
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      if (phaseRef.current !== 'playing') return;

      const displayed = getDisplayedClocks();
      const activeTime = chess.turn() === 'w' ? displayed.white : displayed.black;

      setClockTick((prev) => prev + 1);

      if (activeTime === 0 && !flagSentRef.current) {
        flagSentRef.current = true;
        clearInterval(timerRef.current);
        socketRef.current?.emit('flag', { gameId });
      }
    }, 250);

    return () => clearInterval(timerRef.current);
  }, [phase, gameOver, chess, timeWhite, timeBlack, gameId, getDisplayedClocks]);

  useEffect(() => {
    const SOCKET_URL = import.meta.env.VITE_API_URL || '';
    const socket = io(SOCKET_URL, { path: '/ws/socket.io', auth: { token } });
    socketRef.current = socket;

    socket.emit('join_game', { gameId });

    socket.on('opponent_joined', () => {
      refetch().then(() => {
        if (phaseRef.current === 'waiting') startGrace();
      });
    });

    socket.on('game_update', ({ fen: nextFen, move, pgn, timeWhite: tw, timeBlack: tb, serverTime }) => {
      chess.load(nextFen);
      setFen(nextFen);
      setLastMove(move);
      updateLegal();

      if (tw != null) setTimeWhite(tw);
      if (tb != null) setTimeBlack(tb);

      syncClockAnchor(serverTime, true);
      flagSentRef.current = false;

      if (phaseRef.current !== 'playing') {
        clearInterval(graceRef.current);
        setPhaseSync('playing');
      }
    });

    socket.on('game_over', ({ result, reason, ratingChanges }) => {
      const uid = user?._id || user?.id;
      let myDelta = null;

      if (uid && ratingChanges) {
        if (ratingChanges.white?.playerId === uid) myDelta = ratingChanges.white.delta;
        else if (ratingChanges.black?.playerId === uid) myDelta = ratingChanges.black.delta;
      }

      setRatingChange(myDelta);
      queryClient.invalidateQueries({ queryKey: ['me'] });
      queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
      queryClient.invalidateQueries({ queryKey: ['leaderboard-stats'] });
      queryClient.invalidateQueries({ queryKey: ['lb-stats'] });

      flagSentRef.current = false;
      setGameOver({ result, reason });
      setPhaseSync('over');
      clearInterval(timerRef.current);
      clearInterval(graceRef.current);

      toast({
        title: reason === 'abandoned' ? 'Match abandoned' : 'Game Over',
        description: reason === 'abandoned'
          ? 'White did not make the first move in time.'
          : `Result: ${result}${reason ? ` by ${reason}` : ''}`,
      });
    });

    socket.on('draw_offered', ({ username }) => {
      setDrawOffered(true);
      toast({ title: 'Draw offered', description: `${username} offers a draw.` });
    });

    socket.on('rematch_requested', ({ username }) => {
      setIncomingRematch(true);
      setRematchFrom(username);
      setRematchResponse(null);
      toast({ title: 'Rematch request', description: `${username} wants a rematch.` });
    });

    socket.on('rematch_declined', ({ username }) => {
      setRematchRequested(false);
      setRematchResponse('declined');
      setActionPending(null);
      toast({ title: 'Rematch declined', description: `${username} declined the rematch.` });
    });

    socket.on('rematch_started', ({ newGameId }) => {
      setDrawOffered(false);
      setRematchRequested(false);
      setIncomingRematch(false);
      setRematchFrom(null);
      setRematchResponse(null);
      setActionPending(null);
      toast({ title: 'Rematch started', description: 'Redirecting to the new game.' });
      setLocation(`/play/${newGameId}`);
    });

    socket.on('chat_message', (msg) => setMessages((prev) => [...prev, msg]));
    socket.on('opponent_disconnected', () => {
      if (phaseRef.current === 'over') return;
      toast({ title: 'Opponent disconnected', variant: 'destructive' });
    });

    return () => {
      socket.disconnect();
      clearInterval(timerRef.current);
      clearInterval(graceRef.current);
      clearInterval(waitingRef.current);
    };
  }, [gameId, token, chess, refetch, updateLegal, user, queryClient, setLocation, syncClockAnchor]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleMove = useCallback((uci) => {
    if (!myColor || gameOver || phaseRef.current === 'over') return;

    const displayed = getDisplayedClocks();
    const myDisplayedTime = myColor === 'white' ? displayed.white : displayed.black;
    if (myDisplayedTime != null && myDisplayedTime <= 0) return;

    const turn = chess.turn() === 'w' ? 'white' : 'black';
    if (turn !== myColor) return;

    const from = uci.slice(0, 2);
    const to = uci.slice(2, 4);
    const promo = uci[4];
    const uciKey = from + to + (promo || '');
    if (!legalMoves.includes(uciKey)) return;

    let move;
    try {
      move = chess.move({ from, to, promotion: promo || 'q' });
    } catch {
      return;
    }

    if (!move) return;

    const nextFen = chess.fen();
    setFen(nextFen);
    setLastMove(from + to);
    updateLegal();

    localTimeRef.current = Date.now();
    flagSentRef.current = false;

    if (phaseRef.current !== 'playing') {
      clearInterval(graceRef.current);
      setPhaseSync('playing');
    }

    socketRef.current?.emit('make_move', { gameId, move: uci, fen: nextFen, pgn: chess.pgn() });

    if (chess.isGameOver()) {
      let result = 'draw';
      let reason = 'draw';

      if (chess.isCheckmate()) {
        result = myColor === 'white' ? 'white' : 'black';
        reason = 'checkmate';
      } else if (chess.isStalemate()) {
        reason = 'stalemate';
      } else if (chess.isThreefoldRepetition()) {
        reason = 'repetition';
      } else if (chess.isInsufficientMaterial()) {
        reason = 'insufficient material';
      }

      socketRef.current?.emit('game_over', { gameId, result, reason, fen: nextFen, pgn: chess.pgn() });
      setGameOver({ result, reason });
      setPhaseSync('over');
      clearInterval(timerRef.current);
      clearInterval(graceRef.current);
    }
  }, [myColor, chess, gameId, gameOver, legalMoves, updateLegal, getDisplayedClocks]);

  const resign = () => socketRef.current?.emit('resign', { gameId });
  const offerDraw = () => socketRef.current?.emit('offer_draw', { gameId });
  const acceptDraw = () => {
    socketRef.current?.emit('accept_draw', { gameId });
    setDrawOffered(false);
  };

  const handleGoBackToPlay = useCallback(() => {
    if (actionPending) return;
    setActionPending('leave');
    setLocation('/play');
  }, [actionPending, setLocation]);

  const handlePlayNextGame = useCallback(() => {
    if (actionPending || createNextGame.isPending) return;
    setActionPending('next');
    createNextGame.mutate(
      { timeControl: gameData?.timeControl || 'blitz', color: 'random' },
      { onError: () => setActionPending(null) }
    );
  }, [actionPending, createNextGame, gameData?.timeControl]);

  const requestRematch = useCallback(() => {
    if (!gameOver || rematchRequested || actionPending) return;
    setActionPending('rematch');
    socketRef.current?.emit('request_rematch', { gameId });
    setRematchRequested(true);
    setRematchResponse('waiting');
  }, [actionPending, gameId, gameOver, rematchRequested]);

  const respondRematch = (accepted) => {
    if (!incomingRematch) return;
    socketRef.current?.emit('respond_rematch', { gameId, accepted });
    setIncomingRematch(false);
    setRematchResponse(accepted ? 'accepted' : 'declined');
  };

  const sendChat = (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    socketRef.current?.emit('chat_message', { gameId, message: chatInput });
    setChatInput('');
  };

  const flipped = myColor === 'black';
  const turnColor = chess.turn() === 'w' ? 'white' : 'black';
  const inCheck = chess.inCheck()
    ? chess.board().flat().find((piece) => piece?.type === 'k' && piece.color === chess.turn())?.square
    : null;
  const topPlayer = flipped ? gameData?.whitePlayer : gameData?.blackPlayer;
  const bottomPlayer = flipped ? gameData?.blackPlayer : gameData?.whitePlayer;
  const displayedClocks = getDisplayedClocks();
  const topTime = flipped ? displayedClocks.white : displayedClocks.black;
  const bottomTime = flipped ? displayedClocks.black : displayedClocks.white;
  const graceUrgent = graceLeft <= 5;
  const outcomeContent = getOutcomeContent();

  const statusText = !myColor ? 'Spectating'
    : gameOver?.reason === 'abandoned' ? 'Match abandoned'
    : phase === 'waiting' ? 'Waiting for opponent...'
    : phase === 'retry' ? 'No opponent joined within 2 minutes'
    : phase === 'grace' ? `${graceLeft}s to start - make your first move`
    : phase === 'over' ? 'Game over'
    : `${turnColor}'s turn`;

  const cardStyle = {
    background: 'hsl(var(--card))',
    border: '1px solid hsl(var(--border))',
    borderRadius: 10,
  };

  const playerBarStyle = {
    ...cardStyle,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 14px',
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20, maxWidth: 980, margin: '0 auto', padding: 20 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={playerBarStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Avatar src={topPlayer?.avatar} username={topPlayer?.username || (flipped ? 'White' : 'Black')} size="sm" />
            <span style={{ fontWeight: 500, fontSize: '0.85rem' }}>{topPlayer?.username || (flipped ? 'White' : 'Black')}</span>
          </div>
          {phase === 'playing' && topTime != null ? (
            <span style={{ fontFamily: 'monospace', fontSize: '1.1rem', fontWeight: 700, color: topTime <= 10 ? '#ef4444' : 'hsl(var(--foreground))' }}>
              {formatTime(topTime)}
            </span>
          ) : (
            <span style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: 'hsl(var(--muted-foreground))' }}>-</span>
          )}
        </div>

        {phase === 'waiting' && (
          <div className="cf-waiting-bar">
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#7c3aed', animation: 'pulse 1.4s ease-in-out infinite', flexShrink: 0 }} />
            <div>
              <p style={{ fontSize: '0.8rem', fontWeight: 600, color: '#a78bfa', margin: 0 }}>Waiting for opponent to join...</p>
              <p style={{ fontSize: '0.72rem', color: 'hsl(var(--muted-foreground))', margin: '2px 0 0' }}>Share this page URL with a friend to invite them.</p>
              <p style={{ fontSize: '0.7rem', color: 'hsl(var(--muted-foreground))', margin: '4px 0 0' }}>
                {Math.floor(waitingLeft / 60).toString().padStart(2, '0')}:{(waitingLeft % 60).toString().padStart(2, '0')} remaining
              </p>
            </div>
          </div>
        )}

        {phase === 'retry' && (
          <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, padding: '14px 18px' }}>
            <p style={{ fontSize: '0.8rem', fontWeight: 600, color: '#b91c1c', margin: '0 0 6px' }}>Opponent not found in time.</p>
            <p style={{ fontSize: '0.72rem', color: 'hsl(var(--muted-foreground))', margin: '0 0 10px' }}>If no opponent connects in 2 minutes, you can try again.</p>
            <Button size="sm" style={{ width: '100%' }} onClick={() => setLocation('/play')}>Find Opponent Again</Button>
          </div>
        )}

        {phase === 'grace' && !gameOver && (
          <div className="cf-grace-bar" style={{ background: graceUrgent ? 'rgba(220,50,50,0.1)' : 'rgba(124,58,237,0.08)', border: `1px solid ${graceUrgent ? '#c0392b55' : 'rgba(124,58,237,0.3)'}` }}>
            <div style={{ position: 'relative', width: 50, height: 50, flexShrink: 0 }}>
              <svg width="50" height="50" style={{ transform: 'rotate(-90deg)' }}>
                <circle cx="25" cy="25" r="21" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="4" />
                <circle
                  cx="25"
                  cy="25"
                  r="21"
                  fill="none"
                  stroke={graceUrgent ? '#e74c3c' : '#7c3aed'}
                  strokeWidth="4"
                  strokeDasharray={`${2 * Math.PI * 21}`}
                  strokeDashoffset={`${2 * Math.PI * 21 * (1 - graceLeft / GRACE_SECONDS)}`}
                  strokeLinecap="round"
                  style={{ transition: 'stroke-dashoffset 0.9s linear, stroke 0.3s' }}
                />
              </svg>
              <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 800, color: graceUrgent ? '#e74c3c' : '#a78bfa', fontFamily: 'monospace' }}>
                {graceLeft}
              </span>
            </div>
            <div>
              <p style={{ fontSize: '0.8rem', fontWeight: 600, color: graceUrgent ? '#e74c3c' : '#a78bfa', margin: 0 }}>
                {myColor === 'white' ? 'Make your first move!' : "Waiting for White's first move"}
              </p>
              <p style={{ fontSize: '0.72rem', color: 'hsl(var(--muted-foreground))', margin: '2px 0 0' }}>Clock starts after White moves - {graceLeft}s remaining</p>
            </div>
          </div>
        )}

        <ChessBoard
          fen={fen}
          flipped={flipped}
          legalMoves={myColor && !gameOver && !replayMode && phase !== 'waiting' && phase !== 'over' ? legalMoves : []}
          onMove={handleMove}
          lastMove={lastMove}
          highlightCheck={inCheck}
        />

        <div style={playerBarStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Avatar src={bottomPlayer?.avatar} username={bottomPlayer?.username || myColor || 'You'} size="sm" />
            <span style={{ fontWeight: 500, fontSize: '0.85rem' }}>{bottomPlayer?.username || myColor || 'You'}</span>
          </div>
          {phase === 'playing' && bottomTime != null ? (
            <span style={{ fontFamily: 'monospace', fontSize: '1.1rem', fontWeight: 700, color: bottomTime <= 10 ? '#ef4444' : 'hsl(var(--foreground))' }}>
              {formatTime(bottomTime)}
            </span>
          ) : (
            <span style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: 'hsl(var(--muted-foreground))' }}>-</span>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {gameOver && (
          <div style={{ background: 'rgba(245,197,24,0.08)', border: '1px solid hsl(var(--primary))', borderRadius: 10, padding: 14, textAlign: 'center' }}>
            <p style={{ fontWeight: 800, color: outcomeContent.accent, fontSize: '1.35rem', lineHeight: 1.2, marginBottom: 6 }}>{outcomeContent.title}</p>
            <p style={{ fontSize: '0.84rem', color: outcomeContent.accent, marginBottom: 6 }}>{outcomeContent.subtitle}</p>
            <p style={{ fontSize: '0.8rem', textTransform: 'capitalize', marginBottom: 6 }}>{getGameOverText(gameOver)}</p>
            {typeof ratingChange === 'number' && (
              <p style={{ fontSize: '0.8rem', fontWeight: 600, color: ratingChange >= 0 ? '#22c55e' : '#ef4444', marginBottom: 8 }}>
                Rating: {formatRatingChange(ratingChange)}
              </p>
            )}
            {gameOver.reason === 'abandoned' && (
              <p style={{ fontSize: '0.7rem', color: 'hsl(var(--muted-foreground))', marginBottom: 8 }}>White did not make the first move within 15 seconds.</p>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <Button size="sm" style={{ width: '100%' }} onClick={handleGoBackToPlay} disabled={!!actionPending}>Go Back To Play</Button>
              <Button size="sm" variant="outline" style={{ width: '100%' }} onClick={handlePlayNextGame} disabled={!!actionPending || createNextGame.isPending}>
                {createNextGame.isPending ? 'Finding opponent...' : 'Play Next Game'}
              </Button>
              <Button size="sm" variant="secondary" style={{ width: '100%' }} onClick={requestRematch} disabled={!!actionPending || rematchRequested}>
                {rematchRequested ? 'Rematch Requested' : 'Play Again With Same Player'}
              </Button>
              {rematchResponse === 'waiting' && <p style={{ fontSize: '0.7rem', color: 'hsl(var(--muted-foreground))' }}>Waiting for opponent to accept...</p>}
              {rematchResponse === 'declined' && <p style={{ fontSize: '0.7rem', color: '#ef4444' }}>Opponent declined the rematch.</p>}
            </div>
          </div>
        )}

        {incomingRematch && (
          <div style={{ ...cardStyle, padding: 12 }}>
            <p style={{ fontWeight: 600, marginBottom: 4, fontSize: '0.85rem' }}>Rematch request</p>
            <p style={{ fontSize: '0.78rem', color: 'hsl(var(--muted-foreground))', marginBottom: 8 }}>{rematchFrom || 'Your opponent'} wants to play again.</p>
            <div style={{ display: 'flex', gap: 6 }}>
              <Button size="sm" style={{ flex: 1 }} onClick={() => respondRematch(true)}>Accept</Button>
              <Button size="sm" variant="outline" style={{ flex: 1 }} onClick={() => respondRematch(false)}>Decline</Button>
            </div>
          </div>
        )}

        {replayMode && replayMoves.length > 0 && (
          <div style={{ ...cardStyle, padding: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <p style={{ fontWeight: 600, fontSize: '0.85rem' }}>Replay</p>
              <p style={{ fontSize: '0.7rem', color: 'hsl(var(--muted-foreground))' }}>Move {replayIndex} / {replayMoves.length}</p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 4, marginBottom: 8 }}>
              {[
                { lbl: 'First', disabled: replayIndex === 0, fn: () => { const replayGame = new Chess(); setReplayIndex(0); setFen(replayGame.fen()); setLastMove(null); } },
                { lbl: 'Prev', disabled: replayIndex === 0, fn: () => { const nextIndex = Math.max(0, replayIndex - 1); const replayGame = new Chess(); replayMoves.slice(0, nextIndex).forEach((move) => replayGame.move(move)); setReplayIndex(nextIndex); setFen(replayGame.fen()); const prevMove = replayMoves[nextIndex - 1]; setLastMove(prevMove ? prevMove.from + prevMove.to : null); } },
                { lbl: 'Next', disabled: replayIndex === replayMoves.length, fn: () => { const nextIndex = Math.min(replayMoves.length, replayIndex + 1); const replayGame = new Chess(); replayMoves.slice(0, nextIndex).forEach((move) => replayGame.move(move)); setReplayIndex(nextIndex); setFen(replayGame.fen()); const prevMove = replayMoves[nextIndex - 1]; setLastMove(prevMove ? prevMove.from + prevMove.to : null); } },
                { lbl: 'Last', disabled: replayIndex === replayMoves.length, fn: () => { const replayGame = new Chess(); replayMoves.forEach((move) => replayGame.move(move)); setReplayIndex(replayMoves.length); setFen(replayGame.fen()); const finalMove = replayMoves[replayMoves.length - 1]; setLastMove(finalMove ? finalMove.from + finalMove.to : null); } },
              ].map(({ lbl, disabled, fn }) => (
                <Button key={lbl} size="sm" variant="outline" onClick={fn} disabled={disabled} style={{ padding: '4px' }}>{lbl}</Button>
              ))}
            </div>
            <div style={{ maxHeight: 140, overflowY: 'auto', border: '1px solid hsl(var(--border))', borderRadius: 6, padding: 8, fontSize: '0.75rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr 1fr', gap: '1px 6px', fontFamily: 'monospace' }}>
                {Array.from({ length: Math.ceil(replayMoves.length / 2) }).map((_, index) => {
                  const whiteMove = replayMoves[index * 2];
                  const blackMove = replayMoves[index * 2 + 1];
                  return (
                    <React.Fragment key={index}>
                      <span style={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.68rem' }}>{index + 1}.</span>
                      <span style={{ color: replayIndex === index * 2 + 1 ? 'hsl(var(--primary))' : undefined, fontWeight: replayIndex === index * 2 + 1 ? 700 : undefined }}>{whiteMove?.san || ''}</span>
                      <span style={{ color: replayIndex === index * 2 + 2 ? 'hsl(var(--primary))' : undefined, fontWeight: replayIndex === index * 2 + 2 ? 700 : undefined }}>{blackMove?.san || ''}</span>
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {drawOffered && !gameOver && (
          <div style={{ ...cardStyle, padding: 12 }}>
            <p style={{ fontSize: '0.82rem', marginBottom: 8 }}>Draw offered!</p>
            <div style={{ display: 'flex', gap: 6 }}>
              <Button size="sm" onClick={acceptDraw}>Accept</Button>
              <Button size="sm" variant="ghost" onClick={() => setDrawOffered(false)}>Decline</Button>
            </div>
          </div>
        )}

        {myColor && !gameOver && (
          <div style={{ ...cardStyle, padding: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Button variant="outline" size="sm" style={{ width: '100%' }} onClick={offerDraw} disabled={phase === 'waiting' || phase === 'grace'}>Offer Draw</Button>
            <Button variant="destructive" size="sm" style={{ width: '100%' }} onClick={resign}>Resign</Button>
          </div>
        )}

        <div style={{ ...cardStyle, padding: '10px 14px', fontSize: '0.76rem', color: 'hsl(var(--muted-foreground))' }}>
          {!myColor ? 'Spectating' : `You play ${myColor}`} - {statusText}
        </div>

        <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', height: 220, overflow: 'hidden' }}>
          <div style={{ padding: '8px 12px', borderBottom: '1px solid hsl(var(--border))', fontSize: '0.7rem', color: 'hsl(var(--muted-foreground))', fontWeight: 600 }}>Chat</div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 3, fontSize: '0.78rem' }}>
            {messages.map((msg, index) => (
              <p key={index} style={{ margin: 0 }}>
                <span style={{ fontWeight: 600, color: 'hsl(var(--primary))' }}>{msg.username}:</span>{' '}{msg.message}
              </p>
            ))}
            <div ref={chatEndRef} />
          </div>
          <form onSubmit={sendChat} style={{ display: 'flex', gap: 6, padding: '6px 8px', borderTop: '1px solid hsl(var(--border))' }}>
            <Input className="h-7 text-xs flex-1" value={chatInput} onChange={(e) => setChatInput(e.target.value)} placeholder="Message..." style={{ height: 28, fontSize: '0.75rem' }} />
            <Button size="sm" type="submit" style={{ height: 28, fontSize: '0.75rem', padding: '0 10px' }}>Send</Button>
          </form>
        </div>
      </div>
    </div>
  );
}
