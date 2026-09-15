// src/components/shared/LoadingSpinner.tsx
//
// Simple reusable loading indicator. Pass a `label` for context
// (e.g. "Loading incidents...") or omit it for a bare spinner.

interface LoadingSpinnerProps {
  label?: string
  size?: 'sm' | 'md' | 'lg'
}

const SIZE_CLASSES: Record<NonNullable<LoadingSpinnerProps['size']>, string> = {
  sm: 'h-4 w-4 border-2',
  md: 'h-8 w-8 border-2',
  lg: 'h-12 w-12 border-4',
}

export default function LoadingSpinner({ label, size = 'md' }: LoadingSpinnerProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-8 text-slate-500">
      <div
        className={`animate-spin rounded-full border-slate-300 border-t-slate-600 ${SIZE_CLASSES[size]}`}
        role="status"
        aria-label={label ?? 'Loading'}
      />
      {label && <span className="text-sm">{label}</span>}
    </div>
  )
}
