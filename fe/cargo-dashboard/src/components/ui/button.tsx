import type { ButtonHTMLAttributes } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'primary'
}

export function Button({ className = '', variant = 'default', ...props }: ButtonProps) {
  const styles = variant === 'primary'
    ? 'border-[#0b5147] bg-[#0b5147] text-white hover:bg-[#174d3e]'
    : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-50'
  return <button className={`inline-flex items-center justify-center gap-2 rounded border px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-800 ${styles} ${className}`} {...props} />
}
