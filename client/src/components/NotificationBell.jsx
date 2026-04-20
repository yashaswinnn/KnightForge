import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useLocation } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  acceptChallengeRequest,
  acceptFriendRequest,
  declineChallengeRequest,
  declineFriendRequest,
  getMyFriends,
  getRecentGames,
} from '../lib/api.js';
import { useAuth } from '../hooks/useAuth.js';
import { Avatar } from './Avatar.jsx';
import { toast } from '../hooks/use-toast.js';

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function NotificationBell() {
  const { user, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const [open, setOpen] = useState(false);
  const [seenIds, setSeenIds] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem('cf_seen_notifs') || '[]')); }
    catch { return new Set(); }
  });
  const dropdownRef = useRef(null);
  const qc = useQueryClient();

  // Fetch friend requests
  const { data: friendData } = useQuery({
    queryKey: ['friends'],
    queryFn: getMyFriends,
    refetchInterval: 15000,
    enabled: isAuthenticated,
  });

  // Fetch recent games for game result notifications
  const { data: gamesData } = useQuery({
    queryKey: ['recent-games-notif'],
    queryFn: () => getRecentGames({ limit: 5 }),
    refetchInterval: 30000,
    enabled: isAuthenticated,
  });

  const accept = useMutation({
    mutationFn: acceptFriendRequest,
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ['friends'] });
      markSeen('fr_' + id);
      toast({ title: '✅ Friend added!' });
    },
    onError: (err) => toast({ title: err.message, variant: 'destructive' }),
  });

  const decline = useMutation({
    mutationFn: declineFriendRequest,
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ['friends'] });
      markSeen('fr_' + id);
      toast({ title: 'Request declined' });
    },
    onError: (err) => toast({ title: err.message, variant: 'destructive' }),
  });

  const acceptChallenge = useMutation({
    mutationFn: acceptChallengeRequest,
    onSuccess: (res, gameId) => {
      qc.invalidateQueries({ queryKey: ['friends'] });
      markSeen('challenge_' + gameId);
      setOpen(false);
      toast({ title: 'Challenge accepted!', description: 'Opening your match now.' });
      navigate(`/play/${res.gameId}`);
    },
    onError: (err) => toast({ title: err.message, variant: 'destructive' }),
  });

  const declineChallenge = useMutation({
    mutationFn: declineChallengeRequest,
    onSuccess: (_, gameId) => {
      qc.invalidateQueries({ queryKey: ['friends'] });
      markSeen('challenge_' + gameId);
      toast({ title: 'Challenge declined' });
    },
    onError: (err) => toast({ title: err.message, variant: 'destructive' }),
  });

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handler(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  function markSeen(id) {
    setSeenIds(prev => {
      const next = new Set(prev);
      next.add(id);
      localStorage.setItem('cf_seen_notifs', JSON.stringify([...next]));
      return next;
    });
  }

  function markAllSeen() {
    const ids = notifications.map(n => n.id);
    setSeenIds(prev => {
      const next = new Set(prev);
      ids.forEach(id => next.add(id));
      localStorage.setItem('cf_seen_notifs', JSON.stringify([...next]));
      return next;
    });
  }

  // Build notifications list
  const notifications = [];

  // Friend requests
  const received = friendData?.received || [];
  received.forEach(u => {
    notifications.push({
      id: 'fr_' + u._id,
      type: 'friend_request',
      user: u,
      message: `${u.username} sent you a friend request`,
      time: null,
      userId: u._id,
    });
  });

  const incomingChallenges = friendData?.incomingChallenges || [];
  incomingChallenges.forEach((entry) => {
    notifications.push({
      id: 'challenge_' + entry.gameId,
      type: 'challenge_request',
      user: entry.user,
      message: `${entry.user.username} challenged you`,
      time: entry.createdAt,
      gameId: entry.gameId,
      timeControl: entry.timeControl,
    });
  });

  // Recent game results
  const games = gamesData?.games || [];
  games.slice(0, 3).forEach(g => {
    if (!user) return;
    const myId = user._id || user.id;
    const amWhite = g.whitePlayerId === myId || g.whitePlayer?.id === myId;
    const amBlack = g.blackPlayerId === myId || g.blackPlayer?.id === myId;
    if (!amWhite && !amBlack) return;
    let result = '—';
    let color = 'hsl(var(--muted-foreground))';
    if (g.result === 'draw') { result = 'Draw'; color = '#f59e0b'; }
    else if ((g.result === 'white' && amWhite) || (g.result === 'black' && amBlack)) {
      result = 'You won! 🎉'; color = '#22c55e';
    } else {
      result = 'You lost'; color = '#ef4444';
    }
    const opp = amWhite ? g.blackPlayer?.username : g.whitePlayer?.username;
    notifications.push({
      id: 'game_' + g.id,
      type: 'game_result',
      message: `vs ${opp || 'opponent'} · ${result}`,
      resultColor: color,
      time: g.updatedAt,
      gameId: g.id,
    });
  });

  const unreadCount = notifications.filter(n => !seenIds.has(n.id)).length;

  if (!isAuthenticated) return null;

  return (
    <div ref={dropdownRef} style={{ position: 'relative' }}>
      {/* Bell button */}
      <button
        className="cf-nav-icon cf-bell-btn"
        title="Notifications"
        onClick={() => { setOpen(o => !o); if (!open) markAllSeen(); }}
        style={{ position: 'relative' }}
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute', top: 3, right: 3,
            width: 16, height: 16, borderRadius: '50%',
            background: '#ef4444', color: '#fff',
            fontSize: '0.6rem', fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '2px solid hsl(var(--sidebar))',
            lineHeight: 1,
          }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="cf-notif-dropdown" style={{ animation: 'fadeUp 0.18s ease' }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px 8px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
            <span style={{ fontWeight: 700, fontSize: '0.82rem' }}>Notifications</span>
            {notifications.length > 0 && (
              <button onClick={markAllSeen} style={{ fontSize: '0.65rem', color: 'hsl(var(--primary))', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                Mark all read
              </button>
            )}
          </div>

          {/* Items */}
          <div style={{ maxHeight: 360, overflowY: 'auto' }}>
            {notifications.length === 0 ? (
              <div style={{ padding: '28px 14px', textAlign: 'center' }}>
                <div style={{ fontSize: '1.8rem', marginBottom: 8 }}>🔔</div>
                <div style={{ fontSize: '0.76rem', color: 'hsl(var(--muted-foreground))' }}>You're all caught up!</div>
              </div>
            ) : (
              notifications.map(n => {
                const unread = !seenIds.has(n.id);
                return (
                  <div
                    key={n.id}
                    style={{
                      padding: '10px 14px',
                      borderBottom: '1px solid rgba(255,255,255,0.05)',
                      background: unread ? 'rgba(245,197,24,0.04)' : 'transparent',
                      cursor: n.type === 'game_result' ? 'pointer' : 'default',
                      transition: 'background 0.15s',
                    }}
                    onClick={() => {
                      if (n.type === 'game_result' && n.gameId) {
                        navigate(`/play/${n.gameId}`);
                        setOpen(false);
                      }
                      if (n.type === 'friend_request') {
                        navigate('/friends');
                        setOpen(false);
                      }
                      if (n.type === 'challenge_request') {
                        navigate('/friends');
                        setOpen(false);
                      }
                    }}
                    onMouseEnter={e => { if (n.type !== 'default') e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = unread ? 'rgba(245,197,24,0.04)' : 'transparent'; }}
                  >
                    {n.type === 'friend_request' ? (
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 8 }}>
                          {unread && <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'hsl(var(--primary))', flexShrink: 0 }} />}
                          <Avatar src={n.user.avatar} username={n.user.username} size="sm" style={{ flexShrink: 0 }} />
                          <div>
                            <div style={{ fontSize: '0.76rem', fontWeight: 600 }}>{n.user.username}</div>
                            <div style={{ fontSize: '0.68rem', color: 'hsl(var(--muted-foreground))' }}>Sent you a friend request</div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 6, marginLeft: 15 }}>
                          <button
                            onClick={e => { e.stopPropagation(); accept.mutate(n.userId); }}
                            disabled={accept.isPending}
                            style={{ flex: 1, padding: '5px 0', borderRadius: 7, border: 'none', background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
                          >
                            Accept
                          </button>
                          <button
                            onClick={e => { e.stopPropagation(); decline.mutate(n.userId); }}
                            disabled={decline.isPending}
                            style={{ flex: 1, padding: '5px 0', borderRadius: 7, border: '1px solid rgba(255,255,255,0.12)', background: 'transparent', color: 'hsl(var(--muted-foreground))', fontSize: '0.72rem', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}
                          >
                            Decline
                          </button>
                        </div>
                      </div>
                    ) : n.type === 'challenge_request' ? (
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 8 }}>
                          {unread && <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'hsl(var(--primary))', flexShrink: 0 }} />}
                          <Avatar src={n.user.avatar} username={n.user.username} size="sm" style={{ flexShrink: 0 }} />
                          <div>
                            <div style={{ fontSize: '0.76rem', fontWeight: 600 }}>{n.user.username}</div>
                            <div style={{ fontSize: '0.68rem', color: 'hsl(var(--muted-foreground))' }}>{n.timeControl} challenge</div>
                            {n.time && <div style={{ fontSize: '0.64rem', color: 'hsl(var(--muted-foreground))', marginTop: 1 }}>{timeAgo(n.time)}</div>}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 6, marginLeft: 15 }}>
                          <button
                            onClick={e => { e.stopPropagation(); acceptChallenge.mutate(n.gameId); }}
                            disabled={acceptChallenge.isPending}
                            style={{ flex: 1, padding: '5px 0', borderRadius: 7, border: 'none', background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
                          >
                            Accept
                          </button>
                          <button
                            onClick={e => { e.stopPropagation(); declineChallenge.mutate(n.gameId); }}
                            disabled={declineChallenge.isPending}
                            style={{ flex: 1, padding: '5px 0', borderRadius: 7, border: '1px solid rgba(255,255,255,0.12)', background: 'transparent', color: 'hsl(var(--muted-foreground))', fontSize: '0.72rem', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}
                          >
                            Decline
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                        {unread && <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'hsl(var(--primary))', flexShrink: 0 }} />}
                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', flexShrink: 0 }}>♟</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '0.74rem', fontWeight: 600, color: n.resultColor }}>{n.message}</div>
                          {n.time && <div style={{ fontSize: '0.64rem', color: 'hsl(var(--muted-foreground))', marginTop: 1 }}>{timeAgo(n.time)}</div>}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div style={{ padding: '8px 14px', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
            <button
              onClick={() => { navigate('/friends'); setOpen(false); }}
              style={{ width: '100%', padding: '7px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: 'hsl(var(--foreground))', fontSize: '0.72rem', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}
            >
              View all in Friends →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
