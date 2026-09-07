export function LoadingScreen({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="centered-screen" role="status" aria-live="polite">
      {label}
    </div>
  );
}
