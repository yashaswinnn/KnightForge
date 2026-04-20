import React, { useState } from 'react';
import { Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { getLeaderboard, getLeaderboardStats } from '../lib/api.js';
import { Avatar } from '../components/Avatar.jsx';

function PresenceDot({ online }) {
  return <span className={`cf-dot ${online ? 'cf-dot-on' : 'cf-dot-off'}`} title={online ? 'Online' : 'Offline'} />;
}

export default function Leaderboard() {
  const [tab, setTab] = useState('Global');
  const scope = tab.toLowerCase();
  const { data: stats } = useQuery({ queryKey: ['lb-stats'], queryFn: getLeaderboardStats });
  const { data: lb, isLoading } = useQuery({
    queryKey: ['leaderboard', scope],
    queryFn: () => getLeaderboard({ limit: 50, scope }),
    refetchInterval: 5000,
  });

  const entries = lb?.entries || [];
  const top3 = entries.slice(0, 3);
  const ratingLabel = tab === 'Weekly' ? 'Weekly Score' : 'Rating';
  const subtitle = tab === 'Global'
    ? 'Compete with the best players worldwide'
    : tab === 'Friends'
      ? 'See how you rank against your friends'
      : 'Weekly shows points earned in the last 7 days';

  return (
    <div className="cf-lb-outer" style={{ minHeight: '100vh', padding: '32px 36px', position: 'relative', background: 'radial-gradient(ellipse 65% 50% at 25% 20%, rgba(35,15,110,0.5) 0%, transparent 60%), linear-gradient(180deg,#070a12 0%,#0d1018 100%)' }}>

      <div style={{ animation: 'fadeUp 0.5s ease both' }}>
        <h1 className="font-serif" style={{ fontSize: 'clamp(1.6rem,3.5vw,2.8rem)', fontWeight: 700 }}>Leaderboard</h1>
        <p style={{ fontSize: '0.76rem', color: 'hsl(var(--muted-foreground))', marginTop: 4 }}>{subtitle}</p>
        <div style={{ display: 'flex', gap: 4, marginTop: 14, background: 'rgba(255,255,255,0.05)', borderRadius: 8, padding: 3, width: 'fit-content' }}>
          {['Global', 'Friends', 'Weekly'].map(t => (
            <button key={t} onClick={() => setTab(t)} style={{ padding: '5px 16px', borderRadius: 6, border: 'none', fontSize: '0.76rem', fontWeight: 500, cursor: 'pointer', background: tab === t ? 'hsl(var(--primary))' : 'transparent', color: tab === t ? 'hsl(var(--primary-foreground))' : 'hsl(var(--muted-foreground))', transition: 'all 0.15s', fontFamily: 'inherit' }}>
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Podium */}
      {top3.length >= 3 && (
        <div className="cf-podium-wrap" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 16, margin: '30px 0 24px', animation: 'fadeUp 0.55s 0.1s ease both', overflowX: 'auto', paddingBottom: 4 }}>
          {[top3[1], top3[0], top3[2]].map((p, i) => {
            const rankNum = i === 1 ? 1 : i === 0 ? 2 : 3;
            const medals = { 1: '🥇', 2: '🥈', 3: '🥉' };
            const isFirst = rankNum === 1;
            return (
              <div key={p.user.id} className="cf-podium-item">
                <div style={{ width: isFirst ? 46 : 38, height: isFirst ? 46 : 38, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: isFirst ? '1.3rem' : '1.1rem', background: rankNum === 1 ? 'linear-gradient(135deg,#f5c518,#d48000)' : rankNum === 2 ? 'linear-gradient(135deg,#b8c4d0,#8898a8)' : 'linear-gradient(135deg,#cd8a5e,#a06840)', animation: `rankPop 0.5s ${i * 0.1 + 0.2}s ease both` }}>
                  {medals[rankNum]}
                </div>
                <div className={`cf-podium-card${isFirst ? ' first' : ''}`} style={{ padding: isFirst ? '16px 22px' : '12px 18px', minWidth: isFirst ? 120 : 100, animationDelay: `${i * 0.1 + 0.1}s` }}>
                  <Avatar src={p.user.avatar} username={p.user.username} size={isFirst ? 'md' : 'sm'} style={{ margin: '0 auto 8px' }} />
                  <div style={{ fontSize: '0.8rem', fontWeight: 600 }}>{p.user.username}</div>
                  <div style={{ color: 'hsl(var(--primary))', fontWeight: 700, fontSize: '0.9rem', marginTop: 2 }}>{p.rating}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Table — wrapped in scroll container for mobile */}
      <div style={{ background: 'rgba(8,12,22,0.75)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, overflow: 'hidden', backdropFilter: 'blur(12px)' }}>
        <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <table className="cf-lb-table" style={{ width: '100%', borderCollapse: 'collapse', minWidth: 280 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)' }}>
                <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: '0.71rem', fontWeight: 500, color: 'hsl(var(--muted-foreground))', whiteSpace: 'nowrap' }}>#</th>
                <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: '0.71rem', fontWeight: 500, color: 'hsl(var(--muted-foreground))', whiteSpace: 'nowrap' }}>Player</th>
                <th style={{ padding: '10px 14px', textAlign: 'right', fontSize: '0.71rem', fontWeight: 500, color: 'hsl(var(--muted-foreground))', whiteSpace: 'nowrap' }}>{ratingLabel}</th>
                <th className="cf-lb-col-hide" style={{ padding: '10px 14px', textAlign: 'right', fontSize: '0.71rem', fontWeight: 500, color: 'hsl(var(--muted-foreground))', whiteSpace: 'nowrap' }}>Games</th>
                <th className="cf-lb-col-hide" style={{ padding: '10px 14px', textAlign: 'right', fontSize: '0.71rem', fontWeight: 500, color: 'hsl(var(--muted-foreground))', whiteSpace: 'nowrap' }}>Win %</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan="5" style={{ textAlign: 'center', padding: '24px', color: 'hsl(var(--muted-foreground))', fontSize: '0.8rem' }}>Loading...</td></tr>
              ) : entries.length === 0 ? (
                <tr><td colSpan="5" style={{ textAlign: 'center', padding: '24px', color: 'hsl(var(--muted-foreground))', fontSize: '0.8rem' }}>
                  {tab === 'Friends' ? 'Add friends to see your friends leaderboard.' : 'No leaderboard data available yet.'}
                </td></tr>
              ) : (
                entries.map((entry, i) => (
                  <tr key={entry.user.id} className={`cf-lb-row${entry.user.id === 'me' ? ' me' : ''}`} style={{ animationDelay: `${i * 0.05 + 0.15}s` }}>
                    <td style={{ padding: '10px 14px', fontSize: '0.76rem', color: 'hsl(var(--muted-foreground))', whiteSpace: 'nowrap' }}>
                      {entry.rank <= 3 ? ['1st', '2nd', '3rd'][entry.rank - 1] : entry.rank}
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <Link href={`/profile/${entry.user.id}`}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ position: 'relative', flexShrink: 0 }}>
                            <Avatar src={entry.user.avatar} username={entry.user.username} size="sm" />
                            <PresenceDot online={entry.user.online} />
                          </div>
                          <span style={{ fontSize: '0.8rem', fontWeight: 500, whiteSpace: 'nowrap' }}>{entry.user.username}</span>
                        </div>
                      </Link>
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', color: 'hsl(var(--primary))', fontWeight: 700, fontSize: '0.8rem', whiteSpace: 'nowrap' }}>{entry.rating}</td>
                    <td className="cf-lb-col-hide" style={{ padding: '10px 14px', textAlign: 'right', color: 'hsl(var(--muted-foreground))', fontSize: '0.78rem' }}>{entry.gamesPlayed}</td>
                    <td className="cf-lb-col-hide" style={{ padding: '10px 14px', textAlign: 'right', color: 'hsl(var(--muted-foreground))', fontSize: '0.78rem' }}>
                      {entry.gamesPlayed > 0 ? `${Math.round(entry.winRate * 100)}%` : '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
