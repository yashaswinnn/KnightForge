import React, { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { useAuthStore } from '../store/authStore.js';
import { login } from '../lib/api.js';
import { Button } from '../components/ui/button.jsx';
import { Input } from '../components/ui/input.jsx';
import { Label } from '../components/ui/label.jsx';
import { toast } from '../hooks/use-toast.js';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { setToken, setUser } = useAuthStore();
  const [, navigate] = useLocation();

  async function handleSubmit(e) {
    e.preventDefault(); setLoading(true);
    try {
      const data = await login({ username, password });
      setToken(data.token); setUser(data.user);
      toast({ title: 'Welcome back!', description: `Signed in as ${data.user.username}` });
      navigate('/');
    } catch (err) {
      toast({ title: 'Login failed', description: err.message, variant: 'destructive' });
    } finally { setLoading(false); }
  }

  return (
    <div style={{ maxWidth: 380, margin: '60px auto 0', padding: '0 20px' }}>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div style={{ fontSize: '2rem', marginBottom: 8 }}>♔</div>
        <h1 className="font-serif" style={{ fontSize: '1.8rem', fontWeight: 700 }}>Sign In</h1>
        <p style={{ color: 'hsl(var(--muted-foreground))', marginTop: 6, fontSize: '0.82rem' }}>Welcome back to KnightForge</p>
      </div>
      <form onSubmit={handleSubmit} style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 14, padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Label htmlFor="username" style={{ fontSize: '0.78rem' }}>Username or Email</Label>
          <Input id="username" value={username} onChange={e => setUsername(e.target.value)} required autoFocus />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Label htmlFor="password" style={{ fontSize: '0.78rem' }}>Password</Label>
          <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
        </div>
        <Button type="submit" style={{ width: '100%', marginTop: 4 }} disabled={loading}>
          {loading ? 'Signing in…' : 'Sign In'}
        </Button>
      </form>
      <p style={{ textAlign: 'center', marginTop: 14, fontSize: '0.8rem', color: 'hsl(var(--muted-foreground))' }}>
        No account?{' '}<Link href="/register" style={{ color: 'hsl(var(--primary))', fontWeight: 600 }}>Register</Link>
      </p>
    </div>
  );
}
