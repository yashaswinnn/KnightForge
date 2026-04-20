import { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Route, Switch, useLocation } from 'wouter';
import { Layout } from './components/Layout.jsx';
import { Toaster } from './components/ui/toaster.jsx';
import { useAuthStore } from './store/authStore.js';
import Home from './pages/Home.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Dashboard from './pages/Dashboard.jsx';
import PlayLobby from './pages/PlayLobby.jsx';
import PlayGame from './pages/PlayGame.jsx';
import PlayAI from './pages/PlayAI.jsx';
import Leaderboard from './pages/Leaderboard.jsx';
import Profile from './pages/Profile.jsx';
import Friends from './pages/Friends.jsx';
import OfflinePage from './pages/OfflinePage.jsx';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
});

/* ── Protected route wrapper ────────────────────────────────── */
function ProtectedRoute({ component: Component }) {
  const { isAuthenticated } = useAuthStore();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!isAuthenticated) navigate('/login');
  }, [isAuthenticated]);

  if (!isAuthenticated) return null;
  return <Component />;
}

/* ── Wrapped protected pages ────────────────────────────────── */
function DashboardPage()   { return <ProtectedRoute component={Dashboard}   />; }
function PlayLobbyPage()   { return <ProtectedRoute component={PlayLobby}   />; }
function PlayGamePage()    { return <ProtectedRoute component={PlayGame}    />; }
function PlayAIPage()      { return <ProtectedRoute component={PlayAI}      />; }
function LeaderboardPage() { return <ProtectedRoute component={Leaderboard} />; }
function ProfilePage()     { return <ProtectedRoute component={Profile}     />; }
function FriendsPage()     { return <ProtectedRoute component={Friends}     />; }

/* ── Offline redirect ───────────────────────────────────────── */
function OfflineRedirect() {
  const [location, navigate] = useLocation();

  useEffect(() => {
    let cancelled = false;

    const goOffline = () => {
      if (location !== '/offline') {
        navigate('/offline');
      }
    };

    const checkConnectivity = async () => {
      if (!navigator.onLine) {
        if (!cancelled && location !== '/offline') {
          navigate('/offline');
        }
        return false;
      }

      const onlineCheckUrl = `/?__online_check=${Date.now()}`;
      const tryFetch = async (method) => {
        const response = await fetch(onlineCheckUrl, {
          method,
          cache: 'no-store',
        });
        return response.ok;
      };

      try {
        let isReachable = await tryFetch('HEAD');
        if (!isReachable) {
          isReachable = await tryFetch('GET');
        }

        if (!cancelled && !isReachable && location !== '/offline') {
          navigate('/offline');
        }
        return isReachable;
      } catch {
        if (!cancelled && location !== '/offline') {
          navigate('/offline');
        }
        return false;
      }
    };

    const syncOnLoad = async () => {
      if (location === '/offline') {
        if (!cancelled && navigator.onLine) {
          navigate('/');
        }
      } else {
        await checkConnectivity();
      }
    };

    syncOnLoad();

    const goOnline = async () => {
      if (!cancelled && location === '/offline') {
        navigate('/');
      }
    };

    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    const intervalId = window.setInterval(() => {
      if (location !== '/offline') {
        checkConnectivity();
      }
    }, 2000);

    return () => {
      cancelled = true;
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
      window.clearInterval(intervalId);
    };
  }, [location, navigate]);

  return null;
}

/* ── App ────────────────────────────────────────────────────── */
export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Layout>
        <OfflineRedirect />
        <Switch>
          {/* Offline — no auth needed */}
          <Route path="/offline"          component={OfflinePage}    />

          {/* Public */}
          <Route path="/"                 component={Home}           />
          <Route path="/login"            component={Login}          />
          <Route path="/register"         component={Register}       />

          {/* Protected */}
          <Route path="/dashboard"        component={DashboardPage}  />
          <Route path="/play"             component={PlayLobbyPage}  />
          <Route path="/play/:gameId"     component={PlayGamePage}   />
          <Route path="/ai"               component={PlayAIPage}     />
          <Route path="/leaderboard"      component={LeaderboardPage}/>
          <Route path="/profile/:userId"  component={ProfilePage}    />
          <Route path="/friends"          component={FriendsPage}    />

          {/* 404 */}
          <Route>
            <div className="p-8 text-center text-muted-foreground">Page not found</div>
          </Route>
        </Switch>
      </Layout>
      <Toaster />
    </QueryClientProvider>
  );
}
