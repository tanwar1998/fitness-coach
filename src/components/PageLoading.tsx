export function PageLoading({ label }: { label?: string }) {
  return (
    <div className="mx-auto flex min-h-[50vh] w-full max-w-7xl flex-col items-center justify-center gap-4 px-4">
      <div className="h-10 w-10 animate-spin rounded-sm border-2 border-foreground/20 border-t-foreground" />
      {label && <p className="stamp text-muted-foreground">{label}</p>}
    </div>
  );
}