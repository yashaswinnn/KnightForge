import React, { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { useAuthStore } from '../store/authStore.js';
import { register as registerApi } from '../lib/api.js';
import { Button } from '../components/ui/button.jsx';
import { Input } from '../components/ui/input.jsx';
import { Label } from '../components/ui/label.jsx';
import { toast } from '../hooks/use-toast.js';

export default function Register() {
  const [form, setForm] = useState({ username: '', email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [, navigate] = useLocation();
  const set = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    if (form.password.length < 6) return toast({ title: 'Password too short', description: 'Minimum 6 characters.', variant: 'destructive' });
    setLoading(true);
    try {
      await registerApi(form);
      toast({ title: 'Account created!', description: 'Please sign in to continue.' });
      navigate('/login');
    } catch (err) {
      toast({ title: 'Registration failed', description: err.message, variant: 'destructive' });
    } finally { setLoading(false); }
  }

  return (
    <div style={{ maxWidth: 380, margin: '60px auto 0', padding: '0 20px' }}>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div style={{ fontSize: '2rem', marginBottom: 8 }}>♚</div>
        <h1 className="font-serif" style={{ fontSize: '1.8rem', fontWeight: 700 }}>Create Account</h1>
        <p style={{ color: 'hsl(var(--muted-foreground))', marginTop: 6, fontSize: '0.82rem' }}>Join KnightForge today</p>
      </div>
      <form onSubmit={handleSubmit} style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 14, padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Label htmlFor="username" style={{ fontSize: '0.78rem' }}>Username</Label>
          <Input id="username" value={form.username} onChange={set('username')} required autoFocus minLength={3} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Label htmlFor="email" style={{ fontSize: '0.78rem' }}>Email</Label>
          <Input id="email" type="email" value={form.email} onChange={set('email')} required />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Label htmlFor="password" style={{ fontSize: '0.78rem' }}>Password</Label>
          <Input id="password" type="password" value={form.password} onChange={set('password')} required minLength={6} />
        </div>
        <Button type="submit" style={{ width: '100%', marginTop: 4 }} disabled={loading}>
          {loading ? 'Creating account…' : 'Create Account'}
        </Button>
      </form>
      <p style={{ textAlign: 'center', marginTop: 14, fontSize: '0.8rem', color: 'hsl(var(--muted-foreground))' }}>
        Already have an account?{' '}<Link href="/login" style={{ color: 'hsl(var(--primary))', fontWeight: 600 }}>Sign in</Link>
      </p>
    </div>
  );
}
