export function StatusBadge({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium border ${className}`}>
      {children}
    </span>
  );
}
