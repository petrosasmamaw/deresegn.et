import { useState, useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import axios from '../api/axiosInstance'
import { unwrap } from '../api/unwrap'
import AdminNavbar from '../components/AdminNavbar'
import AdminUsersList from '../components/AdminUsersList'
import AdminUserDetail from '../components/AdminUserDetail'
import AdminAccountsPanel from '../components/AdminAccountsPanel'
import { Users, TrendingUp, Activity, Zap, Wallet } from 'lucide-react'

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
      <div className="min-h-screen bg-gradient-to-b from-[var(--color-bg-base)] to-[var(--color-bg-subtle)]">
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
    <div className="min-h-screen bg-gradient-to-b from-[var(--color-bg-base)] to-[var(--color-bg-subtle)]">
      <AdminNavbar user={user} />

      <main className="flex-1 p-4 md:p-6">
        <div className="container mx-auto space-y-8">
          {/* Header */}
          <div>
            <h1 className="text-3xl font-bold text-[var(--color-text-primary)] mb-2">Admin Dashboard</h1>
            <p className="text-[var(--color-text-secondary)]">Manage and monitor user activities</p>
          </div>

          {error && (
            <div className="alert alert-error">
              <p>{error}</p>
            </div>
          )}

          {/* Tab Navigation */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('users')}
              className={`btn-secondary flex items-center gap-2 ${activeTab === 'users' ? 'ring-2 ring-[var(--color-primary)]' : ''}`}
            >
              <Users size={16} />
              Users
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('accounts')}
              className={`btn-secondary flex items-center gap-2 ${activeTab === 'accounts' ? 'ring-2 ring-[var(--color-primary)]' : ''}`}
            >
              <Wallet size={16} />
              Accounts
            </button>
          </div>

          {/* Stats Cards */}
          {activeTab === 'users' && dashboardData?.stats && (
            <div className="grid md:grid-cols-4 gap-4">
              <div className="card p-6" style={{ borderLeft: '4px solid var(--color-primary)' }}>
                <div className="flex items-center justify-between mb-4">
                  <p className="text-[var(--text-sm)] text-[var(--color-text-secondary)] font-semibold uppercase">
                    Total Users
                  </p>
                  <Users size={20} style={{ color: 'var(--color-primary)' }} strokeWidth={2} />
                </div>
                <p className="text-4xl font-bold" style={{ color: 'var(--color-primary)' }}>
                  {dashboardData.stats.totalUsers}
                </p>
                <p className="text-xs text-[var(--color-text-secondary)] mt-2">Active users</p>
              </div>

              <div className="card p-6" style={{ borderLeft: '4px solid var(--color-accent)' }}>
                <div className="flex items-center justify-between mb-4">
                  <p className="text-[var(--text-sm)] text-[var(--color-text-secondary)] font-semibold uppercase">
                    Total Balance
                  </p>
                  <Zap size={20} style={{ color: 'var(--color-accent)' }} strokeWidth={2} />
                </div>
                <p className="text-4xl font-bold" style={{ color: 'var(--color-accent)' }}>
                  {typeof dashboardData.stats.totalBalance === 'number'
                    ? dashboardData.stats.totalBalance.toFixed(2)
                    : 0}
                </p>
                <p className="text-xs text-[var(--color-text-secondary)] mt-2">Birr in system</p>
              </div>

              <div className="card p-6" style={{ borderLeft: '4px solid var(--color-success)' }}>
                <div className="flex items-center justify-between mb-4">
                  <p className="text-[var(--text-sm)] text-[var(--color-text-secondary)] font-semibold uppercase">
                    Verifications
                  </p>
                  <Activity size={20} style={{ color: 'var(--color-success)' }} strokeWidth={2} />
                </div>
                <p className="text-4xl font-bold" style={{ color: 'var(--color-success)' }}>
                  {dashboardData.stats.totalChecks}
                </p>
                <p className="text-xs text-[var(--color-text-secondary)] mt-2">Total checks</p>
              </div>

              <div className="card p-6" style={{ borderLeft: '4px solid var(--color-info)' }}>
                <div className="flex items-center justify-between mb-4">
                  <p className="text-[var(--text-sm)] text-[var(--color-text-secondary)] font-semibold uppercase">
                    Top-Ups
                  </p>
                  <TrendingUp size={20} style={{ color: 'var(--color-info)' }} strokeWidth={2} />
                </div>
                <p className="text-4xl font-bold" style={{ color: 'var(--color-info)' }}>
                  {dashboardData.stats.totalTopups}
                </p>
                <p className="text-xs text-[var(--color-text-secondary)] mt-2">Completed</p>
              </div>
            </div>
          )}

          {/* Users Table */}
          {activeTab === 'users' && dashboardData?.users && (
            <AdminUsersList users={dashboardData.users} onSelectUser={handleSelectUser} />
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
