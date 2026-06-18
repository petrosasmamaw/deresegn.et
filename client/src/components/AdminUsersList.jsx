import { format } from 'date-fns'
import { Eye, Users } from 'lucide-react'

export default function AdminUsersList({ users, onSelectUser }) {
  return (
    <div className="card">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="section-title flex items-center gap-2">
            <Users size={20} style={{ color: 'var(--color-primary)' }} strokeWidth={2} />
            All Users
          </h2>
          <p className="text-[var(--text-sm)] text-[var(--color-text-secondary)] mt-2">
            {users.length} user{users.length !== 1 ? 's' : ''} in system
          </p>
        </div>
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full">
          <thead style={{ background: 'var(--color-bg-subtle)' }}>
            <tr>
              <th className="px-6 py-3 text-left text-sm font-semibold">Name</th>
              <th className="px-6 py-3 text-left text-sm font-semibold">Email</th>
              <th className="px-6 py-3 text-right text-sm font-semibold">Balance</th>
              <th className="px-6 py-3 text-right text-sm font-semibold">Checks</th>
              <th className="px-6 py-3 text-right text-sm font-semibold">Top-Ups</th>
              <th className="px-6 py-3 text-left text-sm font-semibold">Joined</th>
              <th className="px-6 py-3 text-center text-sm font-semibold">Action</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr
                key={u.id}
                className="border-t border-[var(--color-border)] hover:bg-[var(--color-bg-elevated)] transition-colors"
              >
                <td className="px-6 py-4 font-semibold text-[var(--color-text-primary)]">{u.name}</td>
                <td className="px-6 py-4 text-[var(--color-text-secondary)] font-mono text-sm">{u.email}</td>
                <td className="px-6 py-4 text-right">
                  <span className="font-mono font-bold" style={{ color: 'var(--color-primary)' }}>
                    {typeof u.balance === 'string' ? parseFloat(u.balance).toFixed(2) : u.balance.toFixed(2)}
                  </span>
                  <span className="text-xs text-[var(--color-text-secondary)] ml-1">Birr</span>
                </td>
                <td className="px-6 py-4 text-right font-semibold">{u.checksCount}</td>
                <td className="px-6 py-4 text-right font-semibold">{u.topupsCount}</td>
                <td className="px-6 py-4 text-sm text-[var(--color-text-secondary)]">
                  {format(new Date(u.createdAt), 'MMM dd, yyyy')}
                </td>
                <td className="px-6 py-4 text-center">
                  <button
                    onClick={() => onSelectUser(u.id)}
                    className="btn-ghost px-3 py-2 flex items-center gap-2 justify-center"
                    title="View details"
                  >
                    <Eye size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile View */}
      <div className="md:hidden space-y-3">
        {users.map((u) => (
          <div
            key={u.id}
            className="card p-4 border border-[var(--color-border)]"
            style={{ background: 'var(--color-bg-elevated)' }}
          >
            <div className="flex items-start justify-between gap-4 mb-3">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-[var(--color-text-primary)] truncate">{u.name}</p>
                <p className="text-xs text-[var(--color-text-secondary)] font-mono truncate">{u.email}</p>
              </div>
              <button
                onClick={() => onSelectUser(u.id)}
                className="btn-ghost px-2 py-2 flex-shrink-0"
              >
                <Eye size={16} />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2 text-sm">
              <div>
                <p className="text-xs text-[var(--color-text-secondary)]">Balance</p>
                <p className="font-bold" style={{ color: 'var(--color-primary)' }}>
                  {typeof u.balance === 'string' ? parseFloat(u.balance).toFixed(2) : u.balance.toFixed(2)} Birr
                </p>
              </div>
              <div>
                <p className="text-xs text-[var(--color-text-secondary)]">Checks</p>
                <p className="font-bold">{u.checksCount}</p>
              </div>
              <div>
                <p className="text-xs text-[var(--color-text-secondary)]">Top-Ups</p>
                <p className="font-bold">{u.topupsCount}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
