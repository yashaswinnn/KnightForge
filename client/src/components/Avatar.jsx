import React from 'react';
import { cn } from '../lib/utils.js';

const SIZE_STYLES = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-12 h-12 text-lg',
  lg: 'w-24 h-24 text-3xl',
};

export function Avatar({ src, username, size = 'sm', className }) {
  const sizeClass = SIZE_STYLES[size] || SIZE_STYLES.sm;
  const fallbackLetter = username?.[0]?.toUpperCase() || '?';

  if (src) {
    return (
      <img
        src={src}
        alt={username ? `${username} avatar` : 'User avatar'}
        className={cn(
          'rounded-full border border-primary/40 bg-primary/10 object-cover object-center',
          sizeClass,
          className
        )}
      />
    );
  }

  return (
    <span
      className={cn(
        'rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center font-bold text-primary shrink-0',
        sizeClass,
        className
      )}
    >
      {fallbackLetter}
    </span>
  );
}

export default Avatar;
