/**
 * Fallback shown while a lazily-loaded route chunk downloads. Kept lightweight
 * and on-brand (parchment + skeleton) so the transition feels instant.
 */
export default function RouteFallback() {
  return (
    <div className="min-h-screen page-parchment p-4" aria-busy="true" aria-live="polite">
      <div className="container mx-auto">
        <div className="mb-8">
          <div className="skeleton h-4 w-24 rounded mb-2"></div>
          <div className="skeleton h-8 w-48 rounded"></div>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          <div className="md:col-span-2 skeleton-card"></div>
          <div className="skeleton-card"></div>
        </div>
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  )
}
