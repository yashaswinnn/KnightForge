import React, { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'wouter';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getMyFriends, getUserGames, getUserProfile, sendFriendRequest, updateMyProfile, uploadMyAvatar } from '../lib/api.js';
import { useAuth } from '../hooks/useAuth.js';
import { Button } from '../components/ui/button.jsx';
import { toast } from '../hooks/use-toast.js';
import { useAuthStore } from '../store/authStore.js';
import { Avatar } from '../components/Avatar.jsx';

function RatingChart({ games }) {
  if (!games || games.length < 2) return null;
  const last10 = games.slice(-10);
  const W = 320, H = 100, pad = 14;
  const vals = last10.map((_, i) => 1150 + Math.round(Math.sin(i) * 30 + i * 3));
  const mn = Math.min(...vals) - 15, mx = Math.max(...vals) + 15;
  const tx = i => pad + (i / (vals.length - 1)) * (W - pad * 2);
  const ty = v => H - pad - ((v - mn) / (mx - mn)) * (H - pad * 2);
  const pts = vals.map((v, i) => `${tx(i)},${ty(v)}`).join(' ');
  const area = `M${tx(0)},${ty(vals[0])} ` + vals.map((v, i) => `L${tx(i)},${ty(v)}`).join(' ') + ` L${tx(vals.length-1)},${H} L${tx(0)},${H} Z`;
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
      <defs><linearGradient id="rcg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f5c518" stopOpacity=".3"/><stop offset="100%" stopColor="#f5c518" stopOpacity="0"/></linearGradient></defs>
      <path d={area} fill="url(#rcg)"/>
      <polyline points={pts} fill="none" stroke="#f5c518" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      {vals.map((v, i) => <circle key={i} cx={tx(i)} cy={ty(v)} r={i === vals.length-1 ? 4 : 3} fill="#f5c518" stroke="#0d1018" strokeWidth="2"/>)}
    </svg>
  );
}

export default function Profile() {
  const { userId } = useParams();
  const { user: me } = useAuth();
  const setAuthUser = useAuthStore(s => s.setUser);
  const qc = useQueryClient();
  const fileInputRef = useRef(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [usernameInput, setUsernameInput] = useState('');

  const { data: user, isLoading: loadingUser } = useQuery({ queryKey: ['user', userId], queryFn: () => getUserProfile(userId), enabled: !!userId });
  const { data: games, isLoading: loadingGames } = useQuery({ queryKey: ['user-games', userId], queryFn: () => getUserGames(userId), enabled: !!userId });
  const { data: friendsData } = useQuery({ queryKey: ['friends'], queryFn: getMyFriends, enabled: !!me });

  const sendRequest = useMutation({ mutationFn: () => sendFriendRequest(userId), onSuccess: () => { qc.invalidateQueries({ queryKey: ['friends'] }); toast({ title: 'Friend request sent!' }); }, onError: err => toast({ title: err.message, variant: 'destructive' }) });
  const updateProfile = useMutation({
    mutationFn: (username) => updateMyProfile({ username }),
    onSuccess: (u) => { setAuthUser(u); qc.setQueryData(['me'], u); qc.setQueryData(['user', userId], u); setUsernameInput(u.username); setIsEditingName(false); toast({ title: 'Username updated!' }); },
    onError: err => toast({ title: err.message, variant: 'destructive' }),
  });
  const avatarUpload = useMutation({
    mutationFn: uploadMyAvatar,
    onSuccess: (u) => { setAuthUser(u); qc.setQueryData(['me'], u); qc.setQueryData(['user', userId], u); toast({ title: 'Avatar updated!' }); },
    onError: err => toast({ title: err.message, variant: 'destructive' }),
  });

  useEffect(() => { if (user?.username) setUsernameInput(user.username); }, [user?.username]);

  if (loadingUser) return <div style={{ padding: 32, color: 'hsl(var(--muted-foreground))' }}>Loading profile...</div>;
  if (!user) return <div style={{ padding: 32, color: 'hsl(var(--muted-foreground))' }}>User not found.</div>;

  const isOwnProfile = me && (me._id === userId || me.id === userId);
  const isFriend = friendsData?.friends?.some(f => f._id === userId);
  const requestSent = friendsData?.sent?.some(f => f._id === userId);
  const requestReceived = friendsData?.received?.some(f => f._id === userId);
  const winRate = user.gamesPlayed > 0 ? Math.round((user.gamesWon / user.gamesPlayed) * 100) : 0;

  const handleNameSave = () => {
    const next = usernameInput.trim();
    if (next === user.username) { setIsEditingName(false); return; }
    updateProfile.mutate(next);
  };

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast({ title: 'Please select an image file', variant: 'destructive' }); return; }
    try {
      const base64 = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(new Error('Failed to read')); r.readAsDataURL(file); });
      const optimized = await new Promise((res, rej) => {
        const img = new Image();
        img.onload = () => {
          const max = 256; const scale = Math.min(max/img.width, max/img.height, 1);
          const w = Math.max(1, Math.round(img.width*scale)), h = Math.max(1, Math.round(img.height*scale));
          const canvas = document.createElement('canvas'); canvas.width=w; canvas.height=h;
          const ctx = canvas.getContext('2d'); if (!ctx) { rej(new Error('Canvas failed')); return; }
          ctx.drawImage(img,0,0,w,h); res(canvas.toDataURL('image/jpeg', 0.82));
        };
        img.onerror = () => rej(new Error('Failed to process')); img.src = base64;
      });
      avatarUpload.mutate(optimized);
    } catch (err) { toast({ title: err.message || 'Upload failed', variant: 'destructive' }); }
    finally { e.target.value = ''; }
  };

  const getTC = tc => ({ bullet:'Bullet 1m', blitz:'Blitz 5m', rapid:'Rapid 10m', classical:'Classical 30m' }[tc] || tc || '-');
  const getOutcome = (game) => {
    const pid = user._id || user.id;
    const isW = game.whitePlayerId === pid;
    const myCol = isW ? 'white' : 'black';
    if (game.result === 'draw') return { label: 'Draw', color: '#f59e0b', delta: '+3' };
    if (game.result === myCol) return { label: 'Win', color: '#22c55e', delta: '+12' };
    return { label: 'Loss', color: '#ef4444', delta: '-8' };
  };

  return (
    /* cf-profile-grid: 2-col → 1-col on mobile; cf-profile-sidebar hides on mobile */
    <div className="cf-profile-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 20, padding: '24px 20px', maxWidth: 980, margin: '0 auto' }}>

      {/* LEFT */}
      <div>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <div style={{ position: 'relative', width: 72, height: 72, borderRadius: '50%', background: 'radial-gradient(circle at 40% 35%, #2a3060, #0d1230)', border: '2px solid rgba(245,197,24,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', animation: 'scaleIn 0.4s ease both' }}>
              {user.avatar ? <img src={user.avatar} alt={user.username} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} /> : <span style={{ fontSize: '1.6rem', fontWeight: 700, color: 'hsl(var(--primary))' }}>{user.username?.[0]?.toUpperCase()}</span>}
            </div>
            {isOwnProfile && (
              <>
                <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarChange} />
                <Button size="sm" variant="outline" style={{ fontSize: '0.65rem' }} onClick={() => fileInputRef.current?.click()} disabled={avatarUpload.isPending}>
                  {avatarUpload.isPending ? 'Uploading...' : 'Avatar'}
                </Button>
              </>
            )}
          </div>

          <div style={{ flex: 1, minWidth: 160 }}>
            {isOwnProfile && isEditingName ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 8 }}>
                <input type="text" value={usernameInput} onChange={e => setUsernameInput(e.target.value)} maxLength={30} disabled={updateProfile.isPending}
                  style={{ borderRadius: 8, border: '1px solid hsl(var(--border))', background: 'rgba(255,255,255,0.05)', padding: '6px 12px', fontSize: '1rem', fontWeight: 600, color: 'hsl(var(--foreground))', fontFamily: 'inherit', outline: 'none', width: '100%' }} />
                <div style={{ display: 'flex', gap: 6 }}>
                  <Button size="sm" onClick={handleNameSave} disabled={updateProfile.isPending}>{updateProfile.isPending ? 'Saving...' : 'Save'}</Button>
                  <Button size="sm" variant="outline" onClick={() => { setUsernameInput(user.username); setIsEditingName(false); }} disabled={updateProfile.isPending}>Cancel</Button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
                <span style={{ fontSize: '1.4rem', fontWeight: 700 }}>{user.username}</span>
                {isOwnProfile && <Button size="sm" variant="outline" style={{ fontSize: '0.65rem' }} onClick={() => setIsEditingName(true)}>Edit</Button>}
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 5 }}>
              <span style={{ fontSize: '1.2rem', fontWeight: 700, color: 'hsl(var(--primary))' }}>{user.rating}</span>
              <span style={{ background: 'rgba(34,197,94,0.12)', color: '#22c55e', fontSize: '0.72rem', fontWeight: 700, padding: '2px 7px', borderRadius: 5 }}>Rating</span>
            </div>
            <div style={{ fontSize: '0.7rem', color: 'hsl(var(--muted-foreground))' }}>Member since {new Date(user.createdAt).toLocaleDateString()}</div>
            {me && !isOwnProfile && (
              <div style={{ marginTop: 10 }}>
                {isFriend ? <span style={{ fontSize: '0.78rem', color: '#22c55e', fontWeight: 600 }}>✓ Friends</span>
                  : requestSent ? <span style={{ fontSize: '0.78rem', color: 'hsl(var(--muted-foreground))' }}>Request sent</span>
                  : requestReceived ? <span style={{ fontSize: '0.78rem', color: '#f59e0b' }}>Wants to be friends</span>
                  : <Button size="sm" onClick={() => sendRequest.mutate()} disabled={sendRequest.isPending}>+ Add Friend</Button>}
              </div>
            )}
          </div>
        </div>

        {/* Achievements — cf-achievements-grid */}
        <div style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.9px', color: 'hsl(var(--primary))', marginBottom: 10 }}>Achievements</div>
        <div className="cf-achievements-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 20 }}>
          {[{ icon: '🏆', name: 'First Win' }, { icon: '🔥', name: 'Win Streak' }, { icon: '🤖', name: 'AI Master' }].map((a, i) => (
            <div key={i} className="cf-achievement" style={{ animationDelay: `${i * 0.1 + 0.1}s` }}>
              <div style={{ fontSize: '1.5rem', marginBottom: 5 }}>{a.icon}</div>
              <div style={{ fontSize: '0.68rem', color: 'hsl(var(--muted-foreground))' }}>{a.name}</div>
            </div>
          ))}
        </div>

        {/* Stats — cf-profile-stats */}
        <div className="cf-profile-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 10, marginBottom: 22 }}>
          {[{ v: user.gamesPlayed, l: 'Games' }, { v: user.gamesWon, l: 'Wins' }, { v: user.gamesLost, l: 'Losses' }, { v: user.gamesDraw, l: 'Draws' }, { v: `${winRate}%`, l: 'Win %' }].map((s, i) => (
            <div key={i} style={{ textAlign: 'center', animation: `countBounce 0.5s ${i * 0.07 + 0.1}s ease both` }}>
              <div style={{ fontSize: '1.3rem', fontWeight: 700, color: 'hsl(var(--primary))' }}>{s.v ?? '-'}</div>
              <div style={{ fontSize: '0.66rem', color: 'hsl(var(--muted-foreground))', marginTop: 2 }}>{s.l}</div>
            </div>
          ))}
        </div>

        {/* Rating chart */}
        <div style={{ fontSize: '0.82rem', fontWeight: 700, marginBottom: 10 }}>Rating Progress</div>
        <div style={{ background: 'rgba(8,12,22,0.6)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: 14 }}>
          <RatingChart games={games?.games} />
          {(!games?.games || games.games.length < 2) && <p style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))', textAlign: 'center', padding: '12px 0' }}>Play more games to see your rating progress.</p>}
        </div>

        {/* Game History */}
        <div style={{ marginTop: 20 }}>
          <h2 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: 12 }}>Game History <span style={{ fontSize: '0.7rem', fontWeight: 400, color: 'hsl(var(--muted-foreground))' }}></span></h2>
          {loadingGames ? (
            <p style={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.8rem' }}>Loading games...</p>
          ) : !games?.games?.length ? (
            <p style={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.8rem' }}>No completed games yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {games.games.slice(0, 10).map((game) => {
                const outcome = getOutcome(game);
                return (
                  <Link key={game.id} href={`/play/${game.id}`}>
                    <div style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 10, padding: '10px 12px', cursor: 'pointer', transition: 'border-color 0.15s', animation: 'slideRight 0.4s ease both' }}
                      onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(245,197,24,0.3)'}
                      onMouseLeave={e => e.currentTarget.style.borderColor = 'hsl(var(--border))'}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem' }}>
                          <span style={{ fontWeight: 500 }}>♔ {game.whitePlayer?.username || 'White'}</span>
                          <span style={{ color: 'hsl(var(--muted-foreground))' }}>vs</span>
                          <span style={{ fontWeight: 500 }}>♚ {game.blackPlayer?.username || 'Black'}</span>
                        </div>
                        <span style={{ fontSize: '0.68rem', color: 'hsl(var(--muted-foreground))' }}>{new Date(game.updatedAt).toLocaleDateString()}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontSize: '0.7rem', color: 'hsl(var(--muted-foreground))' }}>{getTC(game.timeControl)}</span>
                          <span style={{ fontSize: '0.74rem', fontWeight: 600, color: outcome.color }}>{outcome.label}</span>
                        </div>
                        <span style={{ fontSize: '0.74rem', fontWeight: 700, color: outcome.color }}>{outcome.delta}</span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT sidebar — cf-profile-sidebar hides on mobile */}
      <div className="cf-profile-sidebar">
        <div className="cf-milestone" style={{ marginBottom: 14 }}>
          <div style={{ fontSize: '0.63rem', color: 'hsl(var(--muted-foreground))', marginBottom: 4 }}>Next Milestone</div>
          <div style={{ fontSize: '0.78rem', fontWeight: 600 }}>Reach {Math.ceil(user.rating / 100) * 100} Rating</div>
          <div className="cf-progress-bar">
            <div className="cf-progress-fill" style={{ '--w': `${(user.rating % 100)}%` }} />
          </div>
          <div style={{ fontSize: '0.66rem', color: 'hsl(var(--muted-foreground))', marginTop: 5 }}>{user.rating} / {Math.ceil(user.rating / 100) * 100}</div>
          <div style={{ position: 'absolute', right: 14, top: 12, fontSize: '1.2rem' }}>💎</div>
        </div>

        <div style={{ fontSize: '0.82rem', fontWeight: 700, marginBottom: 10 }}>Recent Games</div>
        {(games?.games || []).slice(0, 5).map((game, i) => {
          const outcome = getOutcome(game);
          const opp = game.whitePlayerId === (user._id || user.id) ? game.blackPlayer : game.whitePlayer;
          return (
            <Link key={game.id} href={`/play/${game.id}`}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', animation: `slideRight 0.4s ${i * 0.08}s ease both`, cursor: 'pointer' }}>
                <Avatar src={opp?.avatar} username={opp?.username || '?'} size="sm" style={{ width: 30, height: 30 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.76rem' }}>vs {opp?.username || 'Unknown'}</div>
                  <div style={{ fontSize: '0.7rem', fontWeight: 600, color: outcome.color }}>{outcome.label}</div>
                </div>
                <span style={{ fontSize: '0.76rem', fontWeight: 700, color: outcome.color }}>{outcome.delta}</span>
              </div>
            </Link>
          );
        })}
        {(!games?.games || games.games.length === 0) && <p style={{ fontSize: '0.76rem', color: 'hsl(var(--muted-foreground))' }}>No games yet.</p>}
      </div>
    </div>
  );
}