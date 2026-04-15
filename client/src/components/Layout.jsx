import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { io } from 'socket.io-client';
import { useAuth } from '../hooks/useAuth.js';
import { cn } from '../lib/utils.js';
import { Avatar } from './Avatar.jsx';
import { NotificationBell } from './NotificationBell.jsx';

const NAV_LINKS = [
  { href: '/',            label: 'Home'     },
  { href: '/play',        label: 'Play'     },
  { href: '/ai',          label: 'vs AI'    },
  { href: '/leaderboard', label: 'Rankings' },
  { href: '/friends',     label: 'Friends'  },
];

/* ── SVG icons for bottom nav ── */
function IconHome({ active }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? 'hsl(var(--primary))' : 'currentColor'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z"/>
      <path d="M9 21V12h6v9"/>
    </svg>
  );
}
function IconPlay({ active }) {
  // Chess board / crossed swords feel — use a play/board icon
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? 'hsl(var(--primary))' : 'currentColor'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="8" height="8" rx="1"/>
      <rect x="13" y="3" width="8" height="8" rx="1"/>
      <rect x="3" y="13" width="8" height="8" rx="1"/>
      <rect x="13" y="13" width="8" height="8" rx="1"/>
    </svg>
  );
}
function IconAI({ active }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? 'hsl(var(--primary))' : 'currentColor'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4"/>
      <path d="M6 20c0-3.314 2.686-6 6-6s6 2.686 6 6"/>
      <path d="M18 5l2-2M6 5L4 3M12 3V1"/>
      <circle cx="18" cy="5" r="1" fill={active ? 'hsl(var(--primary))' : 'currentColor'} stroke="none"/>
      <circle cx="6"  cy="5" r="1" fill={active ? 'hsl(var(--primary))' : 'currentColor'} stroke="none"/>
      <circle cx="12" cy="1" r="1" fill={active ? 'hsl(var(--primary))' : 'currentColor'} stroke="none"/>
    </svg>
  );
}
function IconRankings({ active }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? 'hsl(var(--primary))' : 'currentColor'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2"  y="14" width="5" height="8" rx="1"/>
      <rect x="9"  y="9"  width="5" height="13" rx="1"/>
      <rect x="16" y="4"  width="5" height="18" rx="1"/>
      <path d="M4 14l4-6 5 3 5-8"/>
    </svg>
  );
}
function IconFriends({ active }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? 'hsl(var(--primary))' : 'currentColor'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9"  cy="7"  r="3"/>
      <circle cx="17" cy="7"  r="2.2"/>
      <path d="M3 20c0-3 2.7-5 6-5s6 2 6 5"/>
      <path d="M17 12c2.2 0 4 1.5 4 4"/>
    </svg>
  );
}

const BOTTOM_NAV = [
  { href: '/',            label: 'Home',    Icon: IconHome     },
  { href: '/play',        label: 'Play',    Icon: IconPlay     },
  { href: '/ai',          label: 'vs AI',   Icon: IconAI       },
  { href: '/leaderboard', label: 'Ranks',   Icon: IconRankings },
  { href: '/friends',     label: 'Friends', Icon: IconFriends  },
];

export function Layout({ children }) {
  const { user, isAuthenticated, logout, token } = useAuth();
  const [location] = useLocation();
  const hideNavbar = location === '/offline';

  useEffect(() => {
    if (!isAuthenticated || !token) return;
    const SOCKET_URL = import.meta.env.VITE_API_URL || '';
const socket = io(SOCKET_URL, { path: '/ws/socket.io', auth: { token } });
    return () => socket.disconnect();
  }, [isAuthenticated, token]);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'hsl(var(--background))', color: 'hsl(var(--foreground))' }}>
      {!hideNavbar && (
        <header className="cf-navbar">
          <div className="cf-nav-inner">

            {/* Logo */}
            <Link href="/" className="cf-brand">
              <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
                <rect width="36" height="36" rx="7" fill="#141c2e"/>
                <rect x="2"  y="2"  width="8" height="8" rx="1.5" fill="#f5c518" opacity=".9"/>
                <rect x="11" y="2"  width="8" height="8" rx="1.5" fill="#f5c518" opacity=".2"/>
                <rect x="20" y="2"  width="8" height="8" rx="1.5" fill="#f5c518" opacity=".9"/>
                <rect x="2"  y="11" width="8" height="8" rx="1.5" fill="#f5c518" opacity=".2"/>
                <rect x="11" y="11" width="8" height="8" rx="1.5" fill="#f5c518" opacity=".9"/>
                <rect x="20" y="11" width="8" height="8" rx="1.5" fill="#f5c518" opacity=".2"/>
                <g transform="translate(7,19)">
                  <rect x="1" y="11" width="20" height="3" rx="1.5" fill="#f5c518"/>
                  <rect x="3" y="7"  width="16" height="5" rx="1"   fill="#f5c518"/>
                  <polygon points="3,7 6,2 10,6 11,1 12,6 16,2 19,7" fill="#f5c518"/>
                </g>
              </svg>
              <span className="cf-brand-name">KnightForge</span>
            </Link>

            {/* Desktop nav links */}
            <nav className="cf-nav-links-desktop" style={{ display: 'flex', gap: 2, flex: 1 }}>
              {NAV_LINKS.map(({ href, label }) => (
                <Link key={href} href={href}>
                  <button className={cn('cf-nav-link', location === href && 'active')}>{label}</button>
                </Link>
              ))}
            </nav>

            {/* Desktop right */}
            <div className="cf-nav-right-desktop" style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
              {isAuthenticated && user ? (
                <>
                  <Link href={`/profile/${user._id || user.id}`}>
                    <div className="cf-nav-user">
                      <Avatar src={user.avatar} username={user.username} size="sm" style={{ width: 30, height: 30 }}/>
                      <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{user.username}</span>
                      <span style={{ fontSize: '0.8rem', color: 'hsl(var(--muted-foreground))' }}>({user.rating || 1200})</span>
                    </div>
                  </Link>
                  <NotificationBell />
                  <button onClick={logout} className="cf-nav-icon" title="Sign out" style={{ color: 'hsl(var(--muted-foreground))' }}>
                    <svg width="15" height="15" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                      <path d="M7.5 3.5H5.5C4.4 3.5 3.5 4.4 3.5 5.5V14.5C3.5 15.6 4.4 16.5 5.5 16.5H7.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                      <path d="M12 6.5L16 10L12 13.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M8 10H16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                    </svg>
                  </button>
                </>
              ) : (
                <>
                  <Link href="/login"><button className="cf-nav-link">Sign in</button></Link>
                  <Link href="/register">
                    <button style={{ background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))', padding: '8px 16px', borderRadius: 8, border: 'none', fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer', fontFamily: 'inherit' }}>
                      Register
                    </button>
                  </Link>
                </>
              )}
            </div>

            {/* Mobile: show user avatar only (no hamburger) */}
            {isAuthenticated && user && (
              <Link href={`/profile/${user._id || user.id}`} className="cf-mobile-avatar-btn">
                <Avatar src={user.avatar} username={user.username} size="sm" style={{ width: 30, height: 30 }}/>
              </Link>
            )}

          </div>
        </header>
      )}

      {/* Page content — padded bottom on mobile so bottom nav doesn't cover it */}
      <main className={cn('cf-main flex-1 w-full px-0', location === '/' && 'pt-0')}>
        {children}
      </main>

      {/* ── Desktop footer ── */}
      {!hideNavbar && (
        <footer className="cf-desktop-footer" style={{ borderTop: '1px solid hsl(var(--border))', padding: '14px', textAlign: 'center', fontSize: '0.72rem', color: 'hsl(var(--muted-foreground))', background: 'hsl(var(--sidebar))' }}>
          © {new Date().getFullYear()} KnightForge — MERN Stack
        </footer>
      )}

      {/* ── Mobile bottom navigation bar ── */}
      {!hideNavbar && (
        <nav className="cf-bottom-nav" aria-label="Main navigation">
          {BOTTOM_NAV.map(({ href, label, Icon }) => {
            const active = location === href;
            return (
              <Link key={href} href={href} className="cf-bottom-nav-item">
                <div className={cn('cf-bottom-nav-icon', active && 'active')}>
                  <Icon active={active} />
                  {active && <span className="cf-bottom-nav-dot" />}
                </div>
                <span className={cn('cf-bottom-nav-label', active && 'active')}>{label}</span>
              </Link>
            );
          })}
        </nav>
      )}
    </div>
  );
}