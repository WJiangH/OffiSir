import React, { useCallback, useEffect, useState } from 'react'
import { X } from 'lucide-react'
import {
  deleteUser,
  fetchAdminStats,
  fetchAllUsers,
  fetchPerUserCounts,
} from '../lib/data'

export default function AdminPanel({ onClose }) {
  const [users, setUsers] = useState([])
  const [counts, setCounts] = useState({})
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null) // { user }
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [u, c, s] = await Promise.all([
        fetchAllUsers(),
        fetchPerUserCounts(),
        fetchAdminStats(),
      ])
      setUsers(u)
      setCounts(c)
      setStats(s)
    } catch (err) {
      setError(String(err.message || err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleDelete = async () => {
    if (!confirmDelete) return
    const userId = confirmDelete.user.id
    setDeleting(true)
    try {
      await deleteUser(userId)
      // Optimistic local update so the UI reflects the delete immediately
      setUsers((current) => current.filter((u) => u.id !== userId))
      setCounts((current) => {
        const removed = current[userId]
        if (!removed) return current
        const next = { ...current }
        delete next[userId]
        return next
      })
      setStats((current) => {
        if (!current) return current
        const removed = counts[userId] || { tasks: 0, stars: 0, customPrompts: 0 }
        return {
          users: Math.max(0, (current.users || 0) - 1),
          tasks: Math.max(0, (current.tasks || 0) - (removed.tasks || 0)),
          stars: Math.max(0, (current.stars || 0) - (removed.stars || 0)),
          customPrompts: Math.max(0, (current.customPrompts || 0) - (removed.customPrompts || 0)),
        }
      })
      setConfirmDelete(null)
      // Re-fetch to reconcile with ground truth (cascade counts, etc.)
      await load()
    } catch (err) {
      setError(String(err.message || err))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="admin-backdrop" onClick={onClose}>
      <div className="admin-panel" onClick={(e) => e.stopPropagation()}>
        <div className="admin-header">
          <h2>Admin panel</h2>
          <button className="admin-close" onClick={onClose} type="button" title="Close">
            <X size={16} />
          </button>
        </div>

        {error && <div className="admin-error">{error}</div>}

        {stats && (
          <div className="admin-stats">
            <div className="admin-stat">
              <span className="admin-stat-value">{stats.users}</span>
              <span className="admin-stat-label">Users</span>
            </div>
            <div className="admin-stat">
              <span className="admin-stat-value">{stats.tasks}</span>
              <span className="admin-stat-label">Tasks</span>
            </div>
            <div className="admin-stat">
              <span className="admin-stat-value">{stats.customPrompts}</span>
              <span className="admin-stat-label">Custom prompts</span>
            </div>
            <div className="admin-stat">
              <span className="admin-stat-value">{stats.stars}</span>
              <span className="admin-stat-label">Stars</span>
            </div>
          </div>
        )}

        {loading ? (
          <div className="admin-loading">Loading…</div>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-users-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Created</th>
                  <th>Tasks</th>
                  <th>Stars</th>
                  <th>Custom prompts</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const c = counts[u.id] || {}
                  return (
                    <tr key={u.id}>
                      <td>
                        {u.name}
                        {u.is_admin && <span className="admin-badge">admin</span>}
                      </td>
                      <td>{u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}</td>
                      <td>{c.tasks || 0}</td>
                      <td>{c.stars || 0}</td>
                      <td>{c.customPrompts || 0}</td>
                      <td>
                        <button
                          className="admin-delete-button"
                          onClick={() => setConfirmDelete({ user: u })}
                          type="button"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {confirmDelete && (
          <div className="admin-confirm-backdrop" onClick={() => setConfirmDelete(null)}>
            <div className="admin-confirm" onClick={(e) => e.stopPropagation()}>
              <p>
                Delete user <strong>{confirmDelete.user.name}</strong> and all their data?
              </p>
              <p className="admin-confirm-note">
                All of their tasks, stars, and custom prompts will be permanently removed.
              </p>
              <div className="admin-confirm-actions">
                <button
                  className="admin-confirm-cancel"
                  onClick={() => setConfirmDelete(null)}
                  type="button"
                >
                  Cancel
                </button>
                <button
                  className="admin-delete-button"
                  disabled={deleting}
                  onClick={handleDelete}
                  type="button"
                >
                  {deleting ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
