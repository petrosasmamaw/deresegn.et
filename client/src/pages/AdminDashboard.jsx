import { useState, useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import axios from '../api/axiosInstance'
import { unwrap } from '../api/unwrap'
import AdminNavbar from '../components/AdminNavbar'
import AdminUsersList from '../components/AdminUsersList'
import AdminUserDetail from '../components/AdminUserDetail'
import AdminAccountsPanel from '../components/AdminAccountsPanel'
import { Users, TrendingUp, Activity, Zap, Wallet, Gift, FileCheck, Settings } from 'lucide-react'
import {
  AdminVerificationsPanel,
  AdminTopupsPanel,
  AdminBonusesPanel,
  AdminBonusSettingsPanel,
} from '../components/AdminOperationsPanels'

export default function AdminDashboard() {
  const { user } = useSelector((s) => s.auth)
  const [activeTab, setActiveTab] = useState('users')
  const [dashboardData, setDashboardData] = useState(null)
  const [selectedUserId, setSelectedUserId] = useState(null)
  const [userDetail, setUserDetail] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    try {
      setLoading(true)
      const res = await axios.get('/admin/dashboard')
      const data = unwrap(res)
      setDashboardData(data)
      setError(null)
    } catch (err) {
      setError('Failed to load dashboard data')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleSelectUser = async (userId) => {
    try {
      setSelectedUserId(userId)
      const res = await axios.get(`/admin/users/${userId}`)
      const data = unwrap(res)
      setUserDetail(data)
    } catch (err) {
      setError('Failed to load user details')
      console.error(err)
    }
  }

  const handleCloseDetail = () => {
    setSelectedUserId(null)
    setUserDetail(null)
  }

  if (loading) {
    return (
      <div className="min-h-screen page-parchment">
        <AdminNavbar user={user} />
        <main className="flex-1 p-4 md:p-6">
          <div className="container mx-auto">
            <div className="grid md:grid-cols-4 gap-4 mb-8">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="skeleton-card h-32"></div>
              ))}
            </div>
            <div className="card space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="skeleton h-12 rounded"></div>
              ))}
            </div>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen page-parchment">
      <AdminNavbar user={user} />

      <main className="flex-1 p-4 md:p-6">
        <div className="container mx-auto space-y-8">
          {/* Header */}
          <div>
            <h1 className="page-title mb-2">Admin Dashboard</h1>
            <p className="text-[var(--color-text-secondary)]">Manage and monitor user activities</p>
          </div>

          {error && (
            <div className="alert alert-error">
              <p>{error}</p>
            </div>
          )}

          {/* Tab Navigation */}
          <div className="flex gap-2 flex-wrap overflow-x-auto pb-1 -mx-1 px-1">
            <button
              type="button"
              onClick={() => setActiveTab('users')}
              className={`btn-secondary flex items-center gap-2 shrink-0 ${activeTab === 'users' ? 'ring-2 ring-[var(--color-primary)]' : ''}`}
            >
              <Users size={16} />
              Users
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('verifications')}
              className={`btn-secondary flex items-center gap-2 shrink-0 ${activeTab === 'verifications' ? 'ring-2 ring-[var(--color-primary)]' : ''}`}
            >
              <FileCheck size={16} />
              Verifications
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('topups')}
              className={`btn-secondary flex items-center gap-2 shrink-0 ${activeTab === 'topups' ? 'ring-2 ring-[var(--color-primary)]' : ''}`}
            >
              <TrendingUp size={16} />
              Top-Ups
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('bonuses')}
              className={`btn-secondary flex items-center gap-2 shrink-0 ${activeTab === 'bonuses' ? 'ring-2 ring-[var(--color-primary)]' : ''}`}
            >
              <Gift size={16} />
              Bonuses
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('accounts')}
              className={`btn-secondary flex items-center gap-2 shrink-0 ${activeTab === 'accounts' ? 'ring-2 ring-[var(--color-primary)]' : ''}`}
            >
              <Wallet size={16} />
              Accounts
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('settings')}
              className={`btn-secondary flex items-center gap-2 shrink-0 ${activeTab === 'settings' ? 'ring-2 ring-[var(--color-primary)]' : ''}`}
            >
              <Settings size={16} />
              Settings
            </button>
          </div>

          {/* Stats Cards */}
          {activeTab === 'users' && dashboardData?.stats && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="stat-card">
                <div className="flex items-center justify-between mb-4">
                  <p className="eyebrow" style={{ color: 'var(--color-text-tertiary)' }}>
                    Total Users
                  </p>
                  <Users size={20} style={{ color: 'var(--color-foil-gold)' }} strokeWidth={2} />
                </div>
                <p className="amount-mono-lg">
                  {dashboardData.stats.totalUsers}
                </p>
                <p className="text-xs text-[var(--color-text-secondary)] mt-2">Active users</p>
              </div>

              <div className="stat-card">
                <div className="flex items-center justify-between mb-4">
                  <p className="eyebrow" style={{ color: 'var(--color-text-tertiary)' }}>
                    Total Balance
                  </p>
                  <Zap size={20} style={{ color: 'var(--color-foil-gold)' }} strokeWidth={2} />
                </div>
                <p className="amount-mono-lg">
                  {typeof dashboardData.stats.totalBalance === 'number'
                    ? dashboardData.stats.totalBalance.toFixed(2)
                    : 0}
                </p>
                <p className="text-xs text-[var(--color-text-secondary)] mt-2">Birr in system</p>
              </div>

              <div className="stat-card">
                <div className="flex items-center justify-between mb-4">
                  <p className="eyebrow" style={{ color: 'var(--color-text-tertiary)' }}>
                    Verifications
                  </p>
                  <Activity size={20} style={{ color: 'var(--color-verified)' }} strokeWidth={2} />
                </div>
                <p className="amount-mono-lg">
                  {dashboardData.stats.totalChecks}
                </p>
                <p className="text-xs text-[var(--color-text-secondary)] mt-2">Total checks</p>
              </div>

              <div className="stat-card">
                <div className="flex items-center justify-between mb-4">
                  <p className="eyebrow" style={{ color: 'var(--color-text-tertiary)' }}>
                    Top-Ups
                  </p>
                  <TrendingUp size={20} style={{ color: 'var(--color-foil-gold)' }} strokeWidth={2} />
                </div>
                <p className="amount-mono-lg">
                  {dashboardData.stats.totalTopups}
                </p>
                <p className="text-xs text-[var(--color-text-secondary)] mt-2">Completed</p>
              </div>

              <div className="stat-card sm:col-span-2 lg:col-span-1">
                <div className="flex items-center justify-between mb-4">
                  <p className="eyebrow" style={{ color: 'var(--color-text-tertiary)' }}>
                    Reg. Bonuses
                  </p>
                  <Gift size={20} style={{ color: 'var(--color-verified)' }} strokeWidth={2} />
                </div>
                <p className="amount-mono-lg">
                  {Number(dashboardData.stats.bonusTotalGiven || 0).toFixed(2)}
                </p>
                <p className="text-xs text-[var(--color-text-secondary)] mt-2">
                  {dashboardData.stats.bonusCount ?? 0} bonuses given
                </p>
              </div>
            </div>
          )}

          {/* Users Table */}
          {activeTab === 'users' && dashboardData?.users && (
            <AdminUsersList users={dashboardData.users} onSelectUser={handleSelectUser} />
          )}

          {activeTab === 'verifications' && (
            <AdminVerificationsPanel checks={dashboardData?.recentChecks || []} />
          )}

          {activeTab === 'topups' && (
            <AdminTopupsPanel topups={dashboardData?.recentTopups || []} />
          )}

          {activeTab === 'bonuses' && (
            <AdminBonusesPanel bonuses={dashboardData?.recentBonuses || []} />
          )}

          {activeTab === 'settings' && (
            <AdminBonusSettingsPanel
              settings={dashboardData?.registrationBonus}
              onUpdated={fetchDashboardData}
            />
          )}

          {activeTab === 'accounts' && <AdminAccountsPanel />}
        </div>
      </main>

      {/* User Detail Modal */}
      {userDetail && (
        <AdminUserDetail user={userDetail} onClose={handleCloseDetail} />
      )}
    </div>
  )
}
