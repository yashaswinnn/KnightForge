import React from 'react';
import { useToast } from '../../hooks/use-toast.js';
import { cn } from '../../lib/utils.js';

export function Toaster() {
  const { toasts, dismiss } = useToast();
  if (!toasts.length) return null;
  return (
    <div className="cf-toast-wrap">
      {toasts.map(t => (
        <div key={t.id} onClick={() => dismiss(t.id)} className={cn('cf-toast', t.variant === 'destructive' && 'err')}>
          {t.title && <p style={{ fontWeight: 600, fontSize: '0.8rem', margin: 0, color: t.variant === 'destructive' ? 'hsl(var(--destructive))' : 'hsl(var(--foreground))' }}>{t.title}</p>}
          {t.description && <p style={{ fontSize: '0.72rem', color: 'hsl(var(--muted-foreground))', margin: '2px 0 0' }}>{t.description}</p>}
        </div>
      ))}
    </div>
  );
}
