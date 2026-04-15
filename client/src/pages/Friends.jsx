import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { acceptFriendRequest, declineFriendRequest, getMyFriends, searchUsers, sendFriendRequest } from '../lib/api.js';
import { Button } from '../components/ui/button.jsx';
import { toast } from '../hooks/use-toast.js';
import { Avatar } from '../components/Avatar.jsx';

function PresenceDot({ online }) {
  return <span className={`cf-dot ${online ? 'cf-dot-on' : 'cf-dot-off'}`} style={{ position: 'absolute', bottom: 0, right: 0 }} title={online ? 'Online' : 'Offline'} />;
}

function UserRow({ user, children, onClick }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', animation: 'slideRight 0.4s ease both' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }} onClick={onClick}>
        <div style={{ position: 'relative' }}>
          <Avatar src={user.avatar} username={user.username} size="sm" />
          <PresenceDot online={user.online} />
        </div>
        <div>
          <p style={{ fontWeight: 600, fontSize: '0.82rem', margin: 0 }}>{user.username}</p>
          <p style={{ fontSize: '0.68rem', color: 'hsl(var(--muted-foreground))', margin: 0 }}>Rating: {user.rating}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

function SectionLabel({ children }) {
  return (
    <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'hsl(var(--primary))', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 10 }}>
      {children}
    </div>
  );
}

export default function Friends() {
  const qc = useQueryClient();
  const [, navigate] = useLocation();
  const [searchQ, setSearchQ] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);

  const { data, isLoading, refetch } = useQuery({ queryKey: ['friends'], queryFn: getMyFriends, refetchInterval: 5000 });

  const accept = useMutation({
    mutationFn: acceptFriendRequest,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['friends'] }); refetch(); toast({ title: 'Friend added!' }); },
    onError: (err) => toast({ title: err.message, variant: 'destructive' }),
  });
  const decline = useMutation({
    mutationFn: declineFriendRequest,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['friends'] }); refetch(); toast({ title: 'Request declined' }); },
    onError: (err) => toast({ title: err.message, variant: 'destructive' }),
  });
  const sendReq = useMutation({
    mutationFn: sendFriendRequest,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['friends'] }); toast({ title: 'Friend request sent!' }); },
    onError: (err) => toast({ title: err.message, variant: 'destructive' }),
  });

  async function handleSearch() {
    if (searchQ.length < 2) return;
    setSearching(true);
    try { const res = await searchUsers(searchQ); setSearchResults(res.users || []); }
    catch (err) { toast({ title: err.message || 'Search failed', variant: 'destructive' }); }
    finally { setSearching(false); }
  }

  if (isLoading) return <div style={{ padding: 32, textAlign: 'center', color: 'hsl(var(--muted-foreground))' }}>Loading...</div>;

  const friends = data?.friends || [];
  const received = data?.received || [];
  const sent = data?.sent || [];
  const onlineFriends = friends.filter(f => f.online);

  return (
    <div style={{ minHeight: '100vh', padding: '0' }}>

      {/* ── MOBILE layout: single column with all sections ── */}
      <div className="cf-friends-mobile">
        <div style={{ padding: '20px 16px' }}>
          <h1 className="font-serif" style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: 20 }}>Friends</h1>

          {/* Online Now */}
          {onlineFriends.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <SectionLabel>Online Now ({onlineFriends.length})</SectionLabel>
              {onlineFriends.map((f, i) => (
                <div key={f._id} className="cf-friend-item" style={{ animationDelay: `${i * 0.07}s` }}
                  onClick={() => navigate(`/profile/${f._id}`)}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                    <div style={{ position: 'relative' }}>
                      <Avatar src={f.avatar} username={f.username} size="sm" />
                      <PresenceDot online={f.online} />
                    </div>
                    <div>
                      <div style={{ fontSize: '0.78rem', fontWeight: 600 }}>{f.username}</div>
                      <div style={{ fontSize: '0.66rem', color: 'hsl(var(--primary))' }}>Online</div>
                    </div>
                  </div>
                  <Button size="sm" variant="outline" onClick={e => { e.stopPropagation(); toast({ title: `Challenge sent to ${f.username}!` }); }}>Challenge</Button>
                </div>
              ))}
              <div style={{ height: 1, background: 'hsl(var(--border))', margin: '16px 0' }} />
            </div>
          )}

          {/* Incoming requests */}
          {received.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <SectionLabel>Requests ({received.length})</SectionLabel>
              {received.map((u, i) => (
                <div key={u._id} className="cf-friend-item" style={{ animationDelay: `${i * 0.07}s` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9 }} onClick={() => navigate(`/profile/${u._id}`)}>
                    <div style={{ position: 'relative' }}><Avatar src={u.avatar} username={u.username} size="sm" /><PresenceDot online={u.online} /></div>
                    <div><div style={{ fontSize: '0.78rem', fontWeight: 600 }}>{u.username}</div></div>
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <Button size="sm" onClick={() => accept.mutate(u._id)} disabled={accept.isPending}>✓</Button>
                    <Button size="sm" variant="ghost" onClick={() => decline.mutate(u._id)} disabled={decline.isPending}>✗</Button>
                  </div>
                </div>
              ))}
              <div style={{ height: 1, background: 'hsl(var(--border))', margin: '16px 0' }} />
            </div>
          )}

          {/* My Friends */}
          <div style={{ marginBottom: 20 }}>
            <SectionLabel>My Friends ({friends.length})</SectionLabel>
            {friends.length === 0
              ? <p style={{ fontSize: '0.8rem', color: 'hsl(var(--muted-foreground))' }}>No friends yet.</p>
              : friends.map((f, i) => (
                <div key={f._id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', animation: `slideRight 0.4s ${i * 0.08}s ease both` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }} onClick={() => navigate(`/profile/${f._id}`)}>
                    <div style={{ position: 'relative' }}>
                      <Avatar src={f.avatar} username={f.username} size="sm" />
                      <PresenceDot online={f.online} />
                    </div>
                    <div>
                      <div style={{ fontSize: '0.81rem', fontWeight: 600 }}>{f.username}</div>
                      <div style={{ fontSize: '0.68rem', color: 'hsl(var(--muted-foreground))' }}>Rating: {f.rating}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: '0.68rem', color: 'hsl(var(--muted-foreground))' }}>{f.online ? 'Online' : 'Offline'}</span>
                    <div className={`cf-dot ${f.online ? 'cf-dot-on' : 'cf-dot-off'}`} />
                  </div>
                </div>
              ))
            }
          </div>

          <div style={{ height: 1, background: 'hsl(var(--border))', margin: '4px 0 20px' }} />

          {/* Find Players */}
          <div style={{ marginBottom: 20 }}>
            <SectionLabel>Find Players</SectionLabel>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <input placeholder="Search by username..." value={searchQ} onChange={e => setSearchQ(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                style={{ flex: 1, minWidth: 0, background: 'rgba(255,255,255,0.05)', border: '1px solid hsl(var(--border))', borderRadius: 8, padding: '7px 12px', fontSize: '0.78rem', color: 'hsl(var(--foreground))', outline: 'none', fontFamily: 'inherit' }} />
              <Button onClick={handleSearch} disabled={searching} size="sm">
                {searching ? '…' : 'Search'}
              </Button>
            </div>
            {searchResults.length > 0 && searchResults.map((u) => {
              const isFriend = friends.some(f => f._id === u._id);
              const isSent = sent.some(f => f._id === u._id);
              const isReceived = received.some(f => f._id === u._id);
              return (
                <UserRow key={u._id} user={u} onClick={() => navigate(`/profile/${u._id}`)}>
                  {isFriend ? <span style={{ fontSize: '0.72rem', color: '#22c55e', fontWeight: 600 }}>Friends</span>
                    : isSent ? <span style={{ fontSize: '0.72rem', color: 'hsl(var(--muted-foreground))' }}>Sent</span>
                    : isReceived ? (
                      <div style={{ display: 'flex', gap: 4 }}>
                        <Button size="sm" onClick={() => accept.mutate(u._id)}>Accept</Button>
                        <Button size="sm" variant="outline" onClick={() => decline.mutate(u._id)}>Decline</Button>
                      </div>
                    ) : (
                      <Button size="sm" onClick={() => sendReq.mutate(u._id)} disabled={sendReq.isPending}>+ Add</Button>
                    )
                  }
                </UserRow>
              );
            })}
          </div>

          {/* Pending sent */}
          {sent.length > 0 && (
            <div>
              <SectionLabel>Pending ({sent.length})</SectionLabel>
              {sent.map((u) => (
                <div key={u._id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer' }} onClick={() => navigate(`/profile/${u._id}`)}>
                    <Avatar src={u.avatar} username={u.username} size="sm" />
                    <span style={{ fontSize: '0.8rem' }}>{u.username}</span>
                  </div>
                  <span style={{ fontSize: '0.7rem', color: 'hsl(var(--muted-foreground))' }}>Awaiting</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── DESKTOP layout: 2-column ── */}
      <div className="cf-friends-desktop cf-friends-layout" style={{ minHeight: '100vh', display: 'grid', gridTemplateColumns: '240px 1fr' }}>

        {/* Left panel */}
        <div className="cf-friends-left" style={{ borderRight: '1px solid hsl(var(--border))', padding: '24px 18px' }}>
          <h1 className="font-serif" style={{ fontSize: '1.6rem', fontWeight: 700, marginBottom: 20, animation: 'fadeUp 0.5s ease both' }}>Friends</h1>

          <div style={{ marginBottom: 18 }}>
            <SectionLabel>Online Now ({onlineFriends.length})</SectionLabel>
            {onlineFriends.length === 0 && <p style={{ fontSize: '0.76rem', color: 'hsl(var(--muted-foreground))' }}>No friends online.</p>}
            {onlineFriends.map((f, i) => (
              <div key={f._id} className="cf-friend-item" style={{ animationDelay: `${i * 0.07}s` }}
                onClick={() => navigate(`/profile/${f._id}`)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                  <div style={{ position: 'relative' }}>
                    <Avatar src={f.avatar} username={f.username} size="sm" />
                    <PresenceDot online={f.online} />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.78rem', fontWeight: 600 }}>{f.username}</div>
                    <div style={{ fontSize: '0.66rem', color: 'hsl(var(--primary))' }}>Online</div>
                  </div>
                </div>
                <Button size="sm" variant="outline" onClick={e => { e.stopPropagation(); toast({ title: `Challenge sent to ${f.username}!` }); }}>Challenge</Button>
              </div>
            ))}
          </div>

          {received.length > 0 && (
            <div style={{ marginBottom: 18 }}>
              <div style={{ height: 1, background: 'hsl(var(--border))', margin: '0 0 14px' }} />
              <SectionLabel>Requests ({received.length})</SectionLabel>
              {received.map((u, i) => (
                <div key={u._id} className="cf-friend-item" style={{ animationDelay: `${i * 0.07}s` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9 }} onClick={() => navigate(`/profile/${u._id}`)}>
                    <div style={{ position: 'relative' }}><Avatar src={u.avatar} username={u.username} size="sm" /><PresenceDot online={u.online} /></div>
                    <div><div style={{ fontSize: '0.78rem', fontWeight: 600 }}>{u.username}</div></div>
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <Button size="sm" onClick={() => accept.mutate(u._id)} disabled={accept.isPending}>✓</Button>
                    <Button size="sm" variant="ghost" onClick={() => decline.mutate(u._id)} disabled={decline.isPending}>✗</Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right panel */}
        <div className="cf-friends-right" style={{ padding: '24px 24px' }}>
          <div style={{ fontSize: '0.86rem', fontWeight: 700, marginBottom: 14 }}>My Friends ({friends.length})</div>

          {friends.map((f, i) => (
            <div key={f._id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', animation: `slideRight 0.4s ${i * 0.08}s ease both` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }} onClick={() => navigate(`/profile/${f._id}`)}>
                <div style={{ position: 'relative' }}>
                  <Avatar src={f.avatar} username={f.username} size="sm" />
                  <PresenceDot online={f.online} />
                </div>
                <div>
                  <div style={{ fontSize: '0.81rem', fontWeight: 600 }}>{f.username}</div>
                  <div style={{ fontSize: '0.68rem', color: 'hsl(var(--muted-foreground))' }}>Rating: {f.rating}</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: '0.68rem', color: 'hsl(var(--muted-foreground))' }}>{f.online ? 'Online' : 'Offline'}</span>
                <div className={`cf-dot ${f.online ? 'cf-dot-on' : 'cf-dot-off'}`} />
              </div>
            </div>
          ))}
          {friends.length === 0 && <p style={{ fontSize: '0.8rem', color: 'hsl(var(--muted-foreground))' }}>No friends yet.</p>}

          <div style={{ height: 1, background: 'hsl(var(--border))', margin: '20px 0' }} />

          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: '0.82rem', fontWeight: 700, marginBottom: 10 }}>Find Players</div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <input placeholder="Search by username..." value={searchQ} onChange={e => setSearchQ(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                style={{ flex: 1, minWidth: 0, background: 'rgba(255,255,255,0.05)', border: '1px solid hsl(var(--border))', borderRadius: 8, padding: '7px 12px', fontSize: '0.78rem', color: 'hsl(var(--foreground))', outline: 'none', fontFamily: 'inherit' }} />
              <Button onClick={handleSearch} disabled={searching} size="sm">
                {searching ? '…' : 'Search'}
              </Button>
            </div>
            {searchResults.length > 0 && searchResults.map((u) => {
              const isFriend = friends.some(f => f._id === u._id);
              const isSent = sent.some(f => f._id === u._id);
              const isReceived = received.some(f => f._id === u._id);
              return (
                <UserRow key={u._id} user={u} onClick={() => navigate(`/profile/${u._id}`)}>
                  {isFriend ? <span style={{ fontSize: '0.72rem', color: '#22c55e', fontWeight: 600 }}>Friends</span>
                    : isSent ? <span style={{ fontSize: '0.72rem', color: 'hsl(var(--muted-foreground))' }}>Sent</span>
                    : isReceived ? (
                      <div style={{ display: 'flex', gap: 4 }}>
                        <Button size="sm" onClick={() => accept.mutate(u._id)}>Accept</Button>
                        <Button size="sm" variant="outline" onClick={() => decline.mutate(u._id)}>Decline</Button>
                      </div>
                    ) : (
                      <Button size="sm" onClick={() => sendReq.mutate(u._id)} disabled={sendReq.isPending}>+ Add</Button>
                    )
                  }
                </UserRow>
              );
            })}
          </div>

          {sent.length > 0 && (
            <div>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, marginBottom: 8 }}>Pending ({sent.length})</div>
              {sent.map((u) => (
                <div key={u._id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer' }} onClick={() => navigate(`/profile/${u._id}`)}>
                    <Avatar src={u.avatar} username={u.username} size="sm" />
                    <span style={{ fontSize: '0.8rem' }}>{u.username}</span>
                  </div>
                  <span style={{ fontSize: '0.7rem', color: 'hsl(var(--muted-foreground))' }}>Awaiting</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}