const API_BASE = import.meta.env.VITE_API_URL || '';

function getToken() {
  return localStorage.getItem('chess_token');
}

async function request(path, options = {}) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message || `Request failed: ${res.status}`);
  }
  return res.json();
}

export const api = {
  get:    (path)       => request(path),
  post:   (path, body) => request(path, { method: 'POST',   body: JSON.stringify(body) }),
  put:    (path, body) => request(path, { method: 'PUT',    body: JSON.stringify(body) }),
  delete: (path)       => request(path, { method: 'DELETE' }),
};

// ── Auth ────────────────────────────────────────────────────
export const login    = (data) => api.post('/api/auth/login', data);
export const register = (data) => api.post('/api/auth/register', data);
export const getMe    = ()     => api.get('/api/auth/me');

// ── Games ───────────────────────────────────────────────────
export const getActiveGames = (params = {}) => {
  const q = new URLSearchParams(params).toString();
  return api.get(`/api/games/active${q ? '?' + q : ''}`);
};
export const getRecentGames = (params = {}) => {
  const q = new URLSearchParams(params).toString();
  return api.get(`/api/games/recent${q ? '?' + q : ''}`);
};
export const createGame = (data) => api.post('/api/games', data);
export const getGame    = (id)   => api.get(`/api/games/${id}`);

// ── Users ───────────────────────────────────────────────────
export const getUserProfile = (id)         => api.get(`/api/users/${id}`);
export const getUserGames   = (id, p = {}) => {
  const q = new URLSearchParams(p).toString();
  return api.get(`/api/users/${id}/games${q ? '?' + q : ''}`);
};
export const getMyStats = () => api.get('/api/users/me/stats');
export const updateMyProfile = (data) => api.put('/api/users/me', data);
export const uploadMyAvatar = (avatar) => api.post('/api/users/avatar', { avatar });

// ── Friends ─────────────────────────────────────────────────
export const searchUsers          = (q)  => api.get(`/api/users/search?q=${encodeURIComponent(q)}`);
export const getMyFriends         = ()   => api.get('/api/users/me/friends');
export const sendFriendRequest    = (id) => api.post(`/api/users/${id}/friend-request`, {});
export const acceptFriendRequest  = (id) => api.post(`/api/users/${id}/friend-accept`, {});
export const declineFriendRequest = (id) => api.post(`/api/users/${id}/friend-decline`, {});
export const sendChallengeRequest = (id, data = {}) => api.post(`/api/users/${id}/challenge`, data);
export const acceptChallengeRequest = (gameId) => api.post(`/api/users/challenges/${gameId}/accept`, {});
export const declineChallengeRequest = (gameId) => api.post(`/api/users/challenges/${gameId}/decline`, {});

// ── Leaderboard ─────────────────────────────────────────────
export const getLeaderboard      = (p = {}) => {
  const q = new URLSearchParams(p).toString();
  return api.get(`/api/leaderboard${q ? '?' + q : ''}`);
};
export const getLeaderboardStats = () => api.get('/api/leaderboard/stats');

// ── Puzzles ─────────────────────────────────────────────────
export const getDailyPuzzle = ()       => api.get('/api/puzzles/daily');
export const getPuzzles     = (p = {}) => {
  const q = new URLSearchParams(p).toString();
  return api.get(`/api/puzzles${q ? '?' + q : ''}`);
};
export const solvePuzzle = (id, data) => api.post(`/api/puzzles/${id}/solve`, data);
