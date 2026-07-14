export function AuthPageSkeleton() {
  return (
    <div className="auth-hero min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-4 text-center">
        <div className="skeleton w-14 h-14 rounded-xl mx-auto" />
        <div className="skeleton h-8 w-40 rounded mx-auto" />
        <div className="skeleton h-4 w-56 rounded mx-auto" />
        <div className="card space-y-3 p-4 mt-4">
          <div className="skeleton h-10 rounded" />
          <div className="skeleton h-10 rounded" />
          <div className="skeleton h-12 rounded" />
        </div>
      </div>
    </div>
  )
}

export function DashboardSkeleton() {
  return (
    <div className="min-h-screen page-parchment p-4">
      <div className="container mx-auto">
        <div className="mb-8">
          <div className="skeleton h-4 w-24 rounded mb-2" />
          <div className="skeleton h-8 w-48 rounded" />
        </div>
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <div className="md:col-span-2 skeleton-card" />
          <div className="skeleton-card" />
        </div>
        <div className="card">
          <div className="skeleton h-6 w-40 rounded mb-4" />
          <div className="space-y-3">
            <div className="skeleton h-12 rounded" />
            <div className="skeleton h-12 rounded" />
            <div className="skeleton h-12 rounded" />
          </div>
        </div>
      </div>
    </div>
  )
}
