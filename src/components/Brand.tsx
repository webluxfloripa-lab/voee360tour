export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <span className="brand">
      <span className="brand-mark">
        v<span>°</span>
      </span>
      {!compact && (
        <span>
          voee<span className="brand-thin">360tour</span>
          <small>VIRTUAL EXPERIENCE PLATFORM</small>
        </span>
      )}
    </span>
  );
}
