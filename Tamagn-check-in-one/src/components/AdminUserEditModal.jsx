import { useEffect, useState } from 'react'
import axios from '../api/axiosInstance'
import { unwrap } from '../api/unwrap'
import Modal from './Modal'

export default function AdminUserEditModal({ user, onClose, onSaved }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('client')
  const [balance, setBalance] = useState('0')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!user) return
    setName(user.name || '')
    setEmail(user.email || '')
    setRole(user.role || 'client')
    const bal = user.balance
    setBalance(
      typeof bal === 'string' ? parseFloat(bal).toFixed(2) : Number(bal || 0).toFixed(2),
    )
    setError(null)
  }, [user])

  if (!user) return null

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const res = await axios.put(`/admin/users/${user.id}`, {
        name: name.trim(),
        email: email.trim(),
        role,
        balance: parseFloat(balance),
      })
      const data = unwrap(res)
      onSaved?.(data)
      onClose()
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to update user')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      isOpen={Boolean(user)}
      onClose={onClose}
      title="Edit user"
      subtitle={user.email}
      contentClassName="max-w-lg"
    >
      <form onSubmit={handleSubmit} className="modal-body space-y-4">
        {error && (
          <div className="alert alert-error">
            <p>{error}</p>
          </div>
        )}

        <div>
          <label className="block text-sm font-semibold mb-1">Full name</label>
          <input
            type="text"
            className="input w-full"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>

        <div>
          <label className="block text-sm font-semibold mb-1">Email</label>
          <input
            type="email"
            className="input w-full"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div>
          <label className="block text-sm font-semibold mb-1">Role</label>
          <select
            className="input w-full"
            value={role}
            onChange={(e) => setRole(e.target.value)}
          >
            <option value="client">Client</option>
            <option value="admin">Admin</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold mb-1">Balance (Birr)</label>
          <input
            type="number"
            min="0"
            step="0.01"
            className="input w-full"
            value={balance}
            onChange={(e) => setBalance(e.target.value)}
            required
          />
        </div>

        <div className="modal-footer !px-0 !pb-0 !pt-2">
          <button type="button" onClick={onClose} className="btn-secondary flex-1" disabled={submitting}>
            Cancel
          </button>
          <button type="submit" className="btn-primary flex-1" disabled={submitting}>
            {submitting ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
