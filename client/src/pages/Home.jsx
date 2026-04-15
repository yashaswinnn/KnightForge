import React, { useEffect, useState } from 'react';
import { Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../hooks/useAuth.js';
import { getLeaderboardStats, getRecentGames } from '../lib/api.js';
import { Button } from '../components/ui/button.jsx';

function GoldenKing() {
  return (
    <svg viewBox="0 0 280 360" fill="none" style={{ width: '100%', height: '100%' }}>
      <ellipse cx="140" cy="330" rx="90" ry="18" fill="#f5a500" opacity="0.18"/>
      <ellipse cx="140" cy="330" rx="55" ry="10" fill="#f5c518" opacity="0.22"/>
      <rect x="65" y="290" width="150" height="26" rx="9" fill="url(#hg1)"/>
      <rect x="88" y="220" width="104" height="74" rx="7" fill="url(#hg2)"/>
      <polygon points="88,220 108,152 130,196 140,145 150,196 172,152 192,220" fill="url(#hg3)"/>
      <rect x="134" y="110" width="12" height="38" rx="4" fill="url(#hg4)"/>
      <rect x="122" y="120" width="36" height="11" rx="4" fill="url(#hg4)"/>
      <circle cx="140" cy="107" r="7" fill="url(#hg5)"/>
      <circle cx="113" cy="248" r="6.5" fill="rgba(255,255,255,0.5)"/>
      <circle cx="140" cy="252" r="7.5" fill="#f5c518" opacity=".9"/>
      <circle cx="167" cy="248" r="6.5" fill="rgba(255,255,255,0.5)"/>
      {[[42,70],[230,88],[268,190],[22,230],[258,290],[80,310],[200,38]].map(([x,y],i)=>(
        <circle key={i} cx={x} cy={y} r={i%2===0?2.5:2} fill="#f5c518"
          style={{animation:`sparkle ${1.4+i*0.25}s ${i*0.18}s ease-in-out infinite`}}/>
      ))}
      <ellipse cx="140" cy="200" rx="110" ry="140" fill="url(#hfireGlow)" opacity="0.35"/>
      <defs>
        <linearGradient id="hg1" x1="65" y1="290" x2="215" y2="316" gradientUnits="userSpaceOnUse"><stop stopColor="#f5c518"/><stop offset="1" stopColor="#8a4a00"/></linearGradient>
        <linearGradient id="hg2" x1="88" y1="220" x2="192" y2="294" gradientUnits="userSpaceOnUse"><stop stopColor="#e09010"/><stop offset="1" stopColor="#6a3000"/></linearGradient>
        <linearGradient id="hg3" x1="88" y1="145" x2="192" y2="220" gradientUnits="userSpaceOnUse"><stop stopColor="#f5c518"/><stop offset="0.5" stopColor="#d08000"/><stop offset="1" stopColor="#a05000"/></linearGradient>
        <linearGradient id="hg4" x1="122" y1="110" x2="158" y2="148" gradientUnits="userSpaceOnUse"><stop stopColor="#fffbe0"/><stop offset="1" stopColor="#f5c518"/></linearGradient>
        <radialGradient id="hg5" cx="0.4" cy="0.35"><stop stopColor="#fff8d0"/><stop offset="1" stopColor="#f5c518"/></radialGradient>
        <radialGradient id="hfireGlow" cx="0.5" cy="0.5"><stop stopColor="#f56018" stopOpacity="0.6"/><stop offset="1" stopColor="#f56018" stopOpacity="0"/></radialGradient>
      </defs>
    </svg>
  );
}

function StatTile({ icon, label, value, iconBg, delay = 0 }) {
  return (
    <div className="cf-stat-tile" style={{ animationDelay: `${delay}s` }}>
      <div style={{ width: 36, height: 36, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', flexShrink: 0, background: iconBg }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'hsl(var(--primary))', lineHeight: 1 }}>{value ?? '0'}</div>
        <div style={{ fontSize: '0.68rem', color: 'hsl(var(--muted-foreground))', marginTop: 2 }}>{label}</div>
      </div>
    </div>
  );
}

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const { isAuthenticated } = useAuth();
  const { data: stats } = useQuery({ queryKey: ['leaderboard-stats'], queryFn: getLeaderboardStats, refetchOnMount: 'always' });
  const { data: recent } = useQuery({ queryKey: ['recent-games', 5], queryFn: () => getRecentGames({ limit: 5 }) });

  useEffect(() => { const t = setTimeout(() => setMounted(true), 60); return () => clearTimeout(t); }, []);
  const a = (d = 0) => ({ animation: mounted ? `fadeUp 0.55s ${d}s ease both` : 'none', opacity: mounted ? undefined : 0 });

  const resultColor = (r) => r === 'white' || r === 'black' ? 'hsl(var(--primary))' : r === 'draw' ? '#f59e0b' : 'hsl(var(--muted-foreground))';

  return (
    <div style={{ minHeight: '100vh', position: 'relative', overflow: 'auto', background: 'radial-gradient(ellipse 70% 75% at 62% 45%, rgba(110,52,6,0.55) 0%, transparent 65%), radial-gradient(ellipse 45% 55% at 72% 38%, rgba(160,78,0,0.32) 0%, transparent 55%), linear-gradient(160deg,#05080e 0%,#0d1018 45%,#130e06 80%,#0d1018 100%)' }}>

      {/* Floating golden king — cf-home-king class enables mobile override */}
      <div className="cf-home-king" style={{ position: 'absolute', right: '5%', top: '3%', width: 'min(400px,40vw)', pointerEvents: 'none', animation: 'float 5s ease-in-out infinite', filter: 'drop-shadow(0 0 40px rgba(245,120,0,0.35))' }}>
        <GoldenKing />
      </div>

      {/* Hero content — cf-home-hero class enables mobile padding override */}
      <div className="cf-home-hero" style={{ position: 'relative', zIndex: 2, padding: '36px 36px 0' }}>
        <div style={{ ...a(0), display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(245,197,24,0.12)', border: '1px solid rgba(245,197,24,0.28)', borderRadius: 20, padding: '4px 14px', fontSize: '0.68rem', fontWeight: 700, color: 'hsl(var(--primary))', letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: 14 }}>
          ⭐ {isAuthenticated ? 'WELCOME BACK!' : 'WELCOME TO KnightForge!'}
        </div>

        <h1 className="font-serif" style={{ ...a(0.07), fontSize: 'clamp(1.7rem,4vw,3.2rem)', fontWeight: 700, lineHeight: 1.05, marginBottom: 14 }}>
          Forge Your <span style={{ color: 'hsl(var(--primary))' }}>Strategy.</span><br />Dominate the Board.
        </h1>

        <p style={{ ...a(0.13), fontSize: '0.83rem', color: '#8a94a8', lineHeight: 1.65, maxWidth: 360, marginBottom: 20 }}>
          Play online, challenge AI, climb the rankings, and connect with players worldwide.
        </p>

        <div style={{ ...a(0.19), display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 28 }}>
          <Link href="/play"><Button size="lg">▶ Play Online</Button></Link>
          <Link href="/ai"><Button size="lg" variant="outline">🤖 Play vs AI</Button></Link>
          {!isAuthenticated && <Link href="/register"><Button size="lg" variant="secondary">Create Account</Button></Link>}
        </div>
      </div>

      {/* Stats — cf-stats-grid collapses to 2×2 on mobile */}
      {stats && (
        <div className="cf-stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, padding: '0 36px', animation: mounted ? 'fadeUp 0.55s 0.28s ease both' : 'none' }}>
          <StatTile icon="👥" iconBg="rgba(139,92,246,0.15)" label="Active Players" value={stats.totalUsers?.toLocaleString() || '0'} delay={0.28} />
          <StatTile icon="♟"  iconBg="rgba(245,158,11,0.15)"  label="Games Played"  value={stats.totalGames?.toLocaleString() || '0'} delay={0.35} />
          <StatTile icon="🏆" iconBg="rgba(245,197,24,0.15)" label="Top Rating"    value={stats.topRating || '-'} delay={0.42} />
          <StatTile icon="👫" iconBg="rgba(20,184,166,0.15)"  label="Active Now"    value={stats.activeGamesNow || '0'} delay={0.49} />
        </div>
      )}

      {/* Recent games + AI card — cf-home-bottom stacks on mobile */}
      <div className="cf-home-bottom" style={{ display: 'grid', gridTemplateColumns: '1fr 270px', gap: 14, padding: '20px 36px 36px', animation: mounted ? 'fadeUp 0.55s 0.36s ease both' : 'none' }}>

        {recent?.games?.length > 0 && (
          <div>
            <div className="cf-sec-title">
              <span>Recent Games</span>
              <Link href="/dashboard"><span className="cf-view-all">View All</span></Link>
            </div>
            {recent.games.map((g, i) => (
              <Link key={g.id} href={`/play/${g.id}`}>
                <div className="cf-game-row" style={{ animationDelay: `${0.36 + i * 0.08}s` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.76rem' }}>
                    <span style={{ fontWeight: 500 }}>{g.whitePlayer?.username || 'White'}</span>
                    <span style={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.7rem' }}>vs</span>
                    <span style={{ fontWeight: 500 }}>{g.blackPlayer?.username || 'Black'}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.72rem' }}>
                    <span style={{ color: 'hsl(var(--muted-foreground))' }}>{g.timeControl}</span>
                    {g.result && (
                      <span style={{ color: resultColor(g.result), fontWeight: 600 }}>
                        {g.result === 'draw' ? 'Draw' : `${g.result} wins`}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* AI Challenge card */}
        <div style={{ background: 'radial-gradient(ellipse at 60% 50%, rgba(80,40,160,0.48) 0%, transparent 68%), rgba(12,10,22,0.92)', border: '1px solid rgba(100,65,200,0.22)', borderRadius: 12, padding: 18, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', position: 'relative', overflow: 'hidden', minHeight: 160 }}>
          <div style={{ position: 'absolute', right: -8, bottom: -8, width: 90, opacity: 0.5, pointerEvents: 'none' }}>
            <svg viewBox="0 0 80 100" fill="none"><ellipse cx="40" cy="50" rx="30" ry="42" fill="rgba(120,80,220,0.35)"/><circle cx="40" cy="30" r="14" fill="rgba(140,90,255,0.4)"/><text x="40" y="36" textAnchor="middle" fontSize="12" fill="rgba(200,160,255,0.9)" fontWeight="700">AI</text></svg>
          </div>
          <div>
            <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'hsl(var(--primary))', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 7 }}>AI Challenge</div>
            <div style={{ fontSize: '0.84rem', fontWeight: 600, lineHeight: 1.4, marginBottom: 6 }}>Ready to improve?</div>
            <div style={{ fontSize: '0.72rem', color: '#8090a8', lineHeight: 1.55 }}>Challenge our advanced AI<br />with adaptive difficulty.</div>
          </div>
          <Link href="/ai"><Button size="sm" style={{ marginTop: 14, alignSelf: 'flex-start' }}>▶ Play vs AI</Button></Link>
        </div>
      </div>
    </div>
  );
}