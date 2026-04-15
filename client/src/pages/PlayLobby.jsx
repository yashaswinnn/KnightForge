import React, { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { createGame, getActiveGames } from '../lib/api.js';
import { useAuth } from '../hooks/useAuth.js';
import { toast } from '../hooks/use-toast.js';
import { Button } from '../components/ui/button.jsx';
import { cn } from '../lib/utils.js';

const TIME_CONTROLS = [
  { value: 'bullet',    label: 'Bullet',    time: '1 min'  },
  { value: 'blitz',     label: 'Blitz',     time: '5 min'  },
  { value: 'rapid',     label: 'Rapid',     time: '10 min' },
  { value: 'classical', label: 'Classical', time: '30 min' },
];

function GoldenPawn() {
  return (
    <svg viewBox="0 0 90 160" fill="none" style={{ width: '100%', height: '100%' }}>
      <ellipse cx="45" cy="148" rx="32" ry="9" fill="#f5a500" opacity="0.22"/>
      <rect x="22" y="128" width="46" height="16" rx="6" fill="url(#pp1)"/>
      <rect x="30" y="95" width="30" height="36" rx="5" fill="url(#pp2)"/>
      <ellipse cx="45" cy="92" rx="18" ry="22" fill="url(#pp3)"/>
      <circle cx="45" cy="60" r="23" fill="url(#pp4)"/>
      <circle cx="38" cy="54" r="8" fill="rgba(255,255,255,0.1)"/>
      <defs>
        <linearGradient id="pp1" x1="22" y1="128" x2="68" y2="144" gradientUnits="userSpaceOnUse"><stop stopColor="#f5c518"/><stop offset="1" stopColor="#7a3500"/></linearGradient>
        <linearGradient id="pp2" x1="30" y1="95" x2="60" y2="131" gradientUnits="userSpaceOnUse"><stop stopColor="#d88010"/><stop offset="1" stopColor="#5a2800"/></linearGradient>
        <linearGradient id="pp3" x1="27" y1="70" x2="63" y2="114" gradientUnits="userSpaceOnUse"><stop stopColor="#f5c518"/><stop offset="1" stopColor="#883500"/></linearGradient>
        <radialGradient id="pp4" cx="0.38" cy="0.32"><stop stopColor="#fff8c0"/><stop offset="0.5" stopColor="#f5c518"/><stop offset="1" stopColor="#b06800"/></radialGradient>
      </defs>
    </svg>
  );
}

export default function PlayLobby() {
  const { user, isAuthenticated } = useAuth();
  const [tc, setTc] = useState('blitz');
  const [color, setColor] = useState('random');
  const [mounted, setMounted] = useState(false);
  const [, navigate] = useLocation();
  const qc = useQueryClient();

  useEffect(() => { const t = setTimeout(() => setMounted(true), 60); return () => clearTimeout(t); }, []);

  const { data, isLoading } = useQuery({
    queryKey: ['active-games', tc],
    queryFn: () => getActiveGames({ timeControl: tc }),
    refetchInterval: 5000,
  });

  const create = useMutation({
    mutationFn: () => createGame({ timeControl: tc, color }),
    onSuccess: (game) => { qc.invalidateQueries({ queryKey: ['active-games'] }); navigate(`/play/${game.id || game._id}`); },
    onError: (err) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  const getPlayerName = (player) => {
    if (!player) return 'Waiting...';
    if (player._id && user?._id && player._id === user._id) return 'You';
    if (player.id && user?.id && player.id === user.id) return 'You';
    return player.username;
  };

  const tr = { opacity: mounted ? 1 : 0, transform: mounted ? 'translateY(0)' : 'translateY(20px)', transition: 'all 0.6s ease' };

  return (
    <div style={{ minHeight: '100vh', position: 'relative', overflow: 'auto', background: 'radial-gradient(ellipse 75% 65% at 78% 62%, rgba(100,60,8,0.5) 0%, transparent 62%), radial-gradient(ellipse 45% 55% at 80% 72%, rgba(190,115,10,0.22) 0%, transparent 50%), linear-gradient(170deg,#04070e 0%,#0d1018 55%,#100c04 85%,#0d1018 100%)' }}>

      {/* Pawn — hidden on very small screens via cf-ai-orb class reuse */}
      <div className="cf-ai-orb" style={{ position: 'absolute', right: '10%', top: '8%', width: 'min(180px,18vw)', animation: 'float 5.5s ease-in-out infinite', filter: 'drop-shadow(0 0 30px rgba(245,140,0,0.35))', pointerEvents: 'none' }}>
        <GoldenPawn />
      </div>

      {/* cf-lobby-inner: padding shrinks on mobile */}
      <div className="cf-lobby-inner" style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 28 }}>
        <div style={{ textAlign: 'center', marginBottom: 20, ...tr }}>
          <h1 className="font-serif" style={{ fontSize: 'clamp(1.8rem,3.5vw,2.8rem)', fontWeight: 700 }}>Play Online</h1>
          <p style={{ fontSize: '0.76rem', color: 'hsl(var(--muted-foreground))', marginTop: 4 }}>Find and challenge players worldwide</p>
        </div>

        <div className="cf-form-card" style={{ padding: '24px 28px', ...tr, transitionDelay: '0.05s' }}>
          {/* Time control — cf-tc-grid: 4-col → 2-col on mobile */}
          <div style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'hsl(var(--muted-foreground))', marginBottom: 8 }}>Choose Time Control</div>
          <div className="cf-tc-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginBottom: 16 }}>
            {TIME_CONTROLS.map(t => (
              <div key={t.value} className={`cf-tc-btn${tc === t.value ? ' active' : ''}`} onClick={() => setTc(t.value)}>
                <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#fff' }}>{t.label}</div>
                <div style={{ fontSize: '0.68rem', color: '#7a8499', marginTop: 2 }}>{t.time}</div>
              </div>
            ))}
          </div>

          {/* Color */}
          <div style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'hsl(var(--muted-foreground))', marginBottom: 8 }}>Choose Color</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
            {['white', 'random', 'black'].map(c => (
              <button key={c} className={`cf-color-btn${color === c ? ' active' : ''}`} onClick={() => setColor(c)}>
                {c === 'white' ? 'White' : c === 'black' ? 'Black' : 'Random'}
              </button>
            ))}
          </div>

          {isAuthenticated ? (
            <button className="cf-find-btn" onClick={() => create.mutate()} disabled={create.isPending}>
              {create.isPending ? (
                <><div className="cf-spinner" /> Finding...</>
              ) : (
                <> 🔍 Find Opponent</>
              )}
            </button>
          ) : (
            <div style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '12px 14px', textAlign: 'center', fontSize: '0.8rem', color: 'hsl(var(--muted-foreground))' }}>
              <a href="/login" style={{ color: 'hsl(var(--primary))' }}>Sign in</a> to create a game.
            </div>
          )}
        </div>

        {/* Open games list */}
        <div style={{ width: 'min(600px,92vw)', marginTop: 20, ...tr, transitionDelay: '0.12s' }}>
          <div style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'hsl(var(--muted-foreground))', marginBottom: 8 }}>
            Open Games — {tc}
          </div>
          {isLoading ? (
            <div style={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.8rem', padding: '10px 0' }}>Loading...</div>
          ) : !data?.games?.length ? (
            <div style={{ background: 'rgba(8,12,22,0.7)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '18px', textAlign: 'center', fontSize: '0.8rem', color: 'hsl(var(--muted-foreground))' }}>
              No open games. Be the first to create one!
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {data.games.map((game) => (
                <div key={game.id} style={{ background: 'rgba(8,12,22,0.8)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', animation: 'slideRight 0.4s ease both' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(245,197,24,0.15)', border: '1px solid rgba(245,197,24,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.82rem', color: 'hsl(var(--primary))', flexShrink: 0 }}>
                      {(game.whitePlayer?.username || game.blackPlayer?.username || '?')[0].toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontSize: '0.8rem', fontWeight: 500 }}>{getPlayerName(game.whitePlayer || game.blackPlayer)}</div>
                      <div style={{ fontSize: '0.68rem', color: 'hsl(var(--muted-foreground))' }}>{game.whitePlayer ? 'White' : 'Black'} · {game.whitePlayer?.rating || game.blackPlayer?.rating || '?'}</div>
                    </div>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => navigate(`/play/${game.id}`)}>Join</Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}