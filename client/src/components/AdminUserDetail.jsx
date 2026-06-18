import { useState } from 'react'
import { X, CheckCircle2, TrendingUp, Clock } from 'lucide-react'
import { format } from 'date-fns'

export default function AdminUserDetail({ user, onClose }) {
  const [activeTab, setActiveTab] = useState('overview')

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content max-w-4xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header sticky top-0 bg-[var(--color-bg-elevated)] z-10">
          <div>
            <h2 className="section-title">{user.user.name}</h2>
            <p className="text-sm text-[var(--color-text-secondary)] mt-1">{user.user.email}</p>
          </div>
          <button onClick={onClose} className="btn-icon">
            <X size={20} strokeWidth={2.5} />
          </button>
        </div>

        <div className="modal-body space-y-6">
          {/* Tabs */}
          <div className="flex gap-2 border-b border-[var(--color-border)]">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-4 py-3 font-semibold border-b-2 transition-colors ${
                activeTab === 'overview'
                  ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                  : 'border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab('checks')}
              className={`px-4 py-3 font-semibold border-b-2 transition-colors ${
                activeTab === 'checks'
                  ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                  : 'border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
              }`}
            >
              Verifications ({user.checks.length})
            </button>
            <button
              onClick={() => setActiveTab('topups')}
              className={`px-4 py-3 font-semibold border-b-2 transition-colors ${
                activeTab === 'topups'
                  ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                  : 'border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
              }`}
            >
              Top-Ups ({user.topups.length})
            </button>
          </div>

          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="card p-4" style={{ background: 'var(--color-primary-muted)' }}>
                  <p className="text-sm text-[var(--color-text-secondary)] mb-2">Current Balance</p>
                  <p className="text-3xl font-bold" style={{ color: 'var(--color-primary)' }}>
                    {typeof user.balance === 'string' ? parseFloat(user.balance).toFixed(2) : user.balance.toFixed(2)}
                  </p>
                  <p className="text-xs text-[var(--color-text-secondary)] mt-1">Birr</p>
                </div>

                <div className="card p-4" style={{ background: 'var(--color-accent-muted)' }}>
                  <p className="text-sm text-[var(--color-text-secondary)] mb-2">Account Status</p>
                  <p className="text-lg font-bold capitalize" style={{ color: 'var(--color-accent)' }}>
                    {user.user.role}
                  </p>
                  <p className="text-xs text-[var(--color-text-secondary)] mt-1">
                    Joined {format(new Date(user.user.createdAt), 'MMM dd, yyyy')}
                  </p>
                </div>
              </div>

              <div className="grid md:grid-cols-3 gap-4">
                <div className="card p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle2 size={16} style={{ color: 'var(--color-success)' }} />
                    <p className="text-sm text-[var(--color-text-secondary)]">Verifications</p>
                  </div>
                  <p className="text-2xl font-bold">{user.stats.checksCount}</p>
                  <p className="text-xs text-[var(--color-success)] mt-1">
                    {user.stats.totalVerified} valid
                  </p>
                </div>

                <div className="card p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp size={16} style={{ color: 'var(--color-info)' }} />
                    <p className="text-sm text-[var(--color-text-secondary)]">Top-Ups</p>
                  </div>
                  <p className="text-2xl font-bold">{user.stats.topupsCount}</p>
                  <p className="text-xs text-[var(--color-info)] mt-1">Completed</p>
                </div>

                <div className="card p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock size={16} style={{ color: 'var(--color-accent)' }} />
                    <p className="text-sm text-[var(--color-text-secondary)]">Member Since</p>
                  </div>
                  <p className="text-sm font-bold">{format(new Date(user.user.createdAt), 'MMM yyyy')}</p>
                  <p className="text-xs text-[var(--color-accent)] mt-1">Active user</p>
                </div>
              </div>
            </div>
          )}

          {/* Verifications Tab */}
          {activeTab === 'checks' && (
            <div className="space-y-3">
              {user.checks.length === 0 ? (
                <p className="text-center text-[var(--color-text-secondary)] py-8">No verifications yet</p>
              ) : (
                user.checks.map((check) => (
                  <div key={check.id} className="card p-4 border border-[var(--color-border)]">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-semibold">{check.senderName}</p>
                          <span className="text-xs px-2 py-1 rounded" style={{ background: check.isValid ? 'var(--color-success-muted)' : 'var(--color-error-muted)' }}>
                            {check.isValid ? 'Valid' : 'Invalid'}
                          </span>
                        </div>
                        <p className="text-sm text-[var(--color-text-secondary)]">
                          Amount: <span className="font-mono font-bold">{check.amount} Birr</span>
                        </p>
                        <p className="text-xs text-[var(--color-text-secondary)] mt-1">
                          {format(new Date(check.createdAt), 'MMM dd, yyyy HH:mm')}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold" style={{ color: 'var(--color-accent)' }}>
                          -{check.balanceDeducted} Birr
                        </p>
                        <p className="text-xs text-[var(--color-text-secondary)]">Deducted</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Top-Ups Tab */}
          {activeTab === 'topups' && (
            <div className="space-y-3">
              {user.topups.length === 0 ? (
                <p className="text-center text-[var(--color-text-secondary)] py-8">No top-ups yet</p>
              ) : (
                user.topups.map((topup) => (
                  <div key={topup.id} className="card p-4 border border-[var(--color-border)]">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-semibold">{topup.senderName}</p>
                          <span className="text-xs px-2 py-1 rounded capitalize" style={{ background: 'var(--color-success-muted)' }}>
                            {topup.status}
                          </span>
                        </div>
                        <p className="text-sm text-[var(--color-text-secondary)]">
                          Amount: <span className="font-mono font-bold">{topup.amount} Birr</span>
                        </p>
                        <p className="text-xs text-[var(--color-text-secondary)] mt-1">
                          Method: <span className="capitalize">{topup.paymentMethod || 'N/A'}</span>
                        </p>
                        <p className="text-xs text-[var(--color-text-secondary)]">
                          {format(new Date(topup.createdAt), 'MMM dd, yyyy HH:mm')}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold" style={{ color: 'var(--color-success)' }}>
                          +{topup.unitsAdded || topup.amount} Birr
                        </p>
                        <p className="text-xs text-[var(--color-text-secondary)]">Added</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button onClick={onClose} className="btn-primary flex-1">
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
