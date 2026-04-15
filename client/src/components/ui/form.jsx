import React, { createContext, useContext } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import { Label } from './label.jsx';
import { cn } from '../../lib/utils.js';

const FormFieldCtx = createContext({});

export function Form({ children, ...props }) { return <form {...props}>{children}</form>; }
export function FormField({ name, control, render }) {
  return (
    <FormFieldCtx.Provider value={{ name }}>
      <Controller name={name} control={control} render={render} />
    </FormFieldCtx.Provider>
  );
}
export function FormItem({ className, ...props }) { return <div className={cn('space-y-2', className)} {...props} />; }
export function FormLabel({ className, ...props }) { return <Label className={cn('', className)} {...props} />; }
export function FormControl({ children }) { return children; }
export function FormMessage({ className, children }) {
  const { name } = useContext(FormFieldCtx);
  try {
    const { formState: { errors } } = useFormContext();
    const error = errors[name];
    if (!error && !children) return null;
    return <p className={cn('text-sm font-medium text-destructive', className)}>{children || error?.message}</p>;
  } catch { return children ? <p className={cn('text-sm font-medium text-destructive', className)}>{children}</p> : null; }
}
