import React from 'react';
import { Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../hooks/useAuth.js';
import { getDailyPuzzle, getMyStats, getRecentGames } from '../lib/api.js';
import { Button } from '../components/ui/button.jsx';
import { Avatar } from '../components/Avatar.jsx';

function StatTile({ label, value }) {
  return (
    <div style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 10, padding: '12px 10px', textAlign: 'center', transition: 'transform 0.2s', animation: 'countBounce 0.5s ease both' }}
      onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
      onMouseLeave={e => e.currentTarget.style.transform = ''}>
      <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'hsl(var(--primary))', lineHeight: 1 }}>{value ?? '-'}</div>
      <div style={{ fontSize: '0.66rem', color: 'hsl(var(--muted-foreground))', marginTop: 4 }}>{label}</div>
    </div>
  );
}

export default function Dashboard() {
  const { user, isAuthenticated } = useAuth();
  const { data: stats } = useQuery({ queryKey: ['my-stats'], queryFn: getMyStats, enabled: isAuthenticated });
  const { data: recent } = useQuery({ queryKey: ['recent-games'], queryFn: () => getRecentGames({ limit: 5 }), enabled: isAuthenticated });
  const { data: puzzle } = useQuery({ queryKey: ['daily-puzzle'], queryFn: getDailyPuzzle });

  if (!isAuthenticated) return (
    <div style={{ textAlign: 'center', padding: '80px 20px' }}>
      <p style={{ fontSize: '1rem', color: 'hsl(var(--muted-foreground))', marginBottom: 16 }}>Please sign in to view your dashboard.</p>
      <Link href="/login"><Button>Sign In</Button></Link>
    </div>
  );

  const winRate = stats?.gamesPlayed ? Math.round((stats.gamesWon / stats.gamesPlayed) * 100) : 0;

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, animation: 'fadeUp 0.5s ease both' }}>
        <Avatar src={user?.avatar} username={user?.username} size="md" />
        <div>
          <h1 className="font-serif" style={{ fontSize: 'clamp(1.2rem,4vw,1.6rem)', fontWeight: 700 }}>Welcome back, {user?.username}!</h1>
          <p style={{ fontSize: '0.8rem', color: 'hsl(var(--muted-foreground))', marginTop: 4 }}>
            Rating: <span style={{ color: 'hsl(var(--primary))', fontWeight: 700 }}>{user?.rating || stats?.rating || 1200}</span>
          </p>
        </div>
      </div>

      {/* Stats — cf-dash-stats: 5-col desktop → 3-col tablet → 2-col mobile */}
      <div className="cf-dash-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 10 }}>
        <StatTile label="Games" value={stats?.gamesPlayed} />
        <StatTile label="Wins" value={stats?.gamesWon} />
        <StatTile label="Losses" value={stats?.gamesLost} />
        <StatTile label="Draws" value={stats?.gamesDraw} />
        <StatTile label="Win Rate" value={`${winRate}%`} />
      </div>

      {/* Quick links — cf-dash-links: 3-col → 1-col on mobile */}
      <div className="cf-dash-links" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
        {[
          { href: '/play', icon: '♟', title: 'Play Online', sub: 'Challenge a real opponent', primary: true },
          { href: '/ai',   icon: '🤖', title: 'Play vs AI',  sub: 'Practice with Stockfish',   primary: false },
          { href: '/puzzles', icon: '🧩', title: 'Daily Puzzle', sub: puzzle ? `Difficulty: ${puzzle.difficulty}` : 'Sharpen your tactics', primary: false },
        ].map(c => (
          <Link key={c.href} href={c.href}>
            <div style={{ background: c.primary ? 'rgba(245,197,24,0.08)' : 'hsl(var(--card))', border: `1px solid ${c.primary ? 'rgba(245,197,24,0.25)' : 'hsl(var(--border))'}`, borderRadius: 12, padding: '16px 14px', cursor: 'pointer', transition: 'all 0.18s', animation: 'scaleIn 0.5s ease both', display: 'flex', alignItems: 'center', gap: 12 }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = c.primary ? 'rgba(245,197,24,0.55)' : 'rgba(245,197,24,0.3)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = c.primary ? 'rgba(245,197,24,0.25)' : 'hsl(var(--border))'; e.currentTarget.style.transform = ''; }}>
              <div style={{ fontSize: '1.4rem', flexShrink: 0 }}>{c.icon}</div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.86rem', marginBottom: 2 }}>{c.title}</div>
                <div style={{ fontSize: '0.7rem', color: 'hsl(var(--muted-foreground))' }}>{c.sub}</div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Recent Games */}
      {recent?.games?.length > 0 && (
        <div>
          <h2 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: 10 }}>Recent Games</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {recent.games.map(g => (
              <Link key={g.id} href={`/play/${g.id}`}>
                <div className="cf-game-row">
                  <span style={{ fontSize: '0.8rem' }}>{g.whitePlayer?.username || '?'} vs {g.blackPlayer?.username || '?'}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: '0.72rem', color: 'hsl(var(--muted-foreground))' }}>{g.timeControl}</span>
                    {g.result && <span style={{ fontSize: '0.76rem', fontWeight: 600, color: g.result === 'draw' ? '#f59e0b' : 'hsl(var(--primary))' }}>{g.result === 'draw' ? 'Draw' : `${g.result} wins`}</span>}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
