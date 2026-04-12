import React, { useEffect, useRef, useState } from 'react'
import { useUser } from '../lib/UserContext'

export default function Login() {
  const { loginAs, createUser, searchUsers, loggingIn, loginError, setLoginError } = useUser()
  const [name, setName] = useState('')
  const [matches, setMatches] = useState([])
  const [selected, setSelected] = useState(null) // selected existing user from dropdown
  const [showDropdown, setShowDropdown] = useState(false)
  const searchSeq = useRef(0)

  useEffect(() => {
    const q = name.trim()
    if (!q) {
      setMatches([])
      return
    }
    const seq = ++searchSeq.current
    const timer = setTimeout(async () => {
      try {
        const results = await searchUsers(q)
        if (seq === searchSeq.current) {
          setMatches(results)
          setShowDropdown(true)
        }
      } catch {
        // ignore
      }
    }, 120)
    return () => clearTimeout(timer)
  }, [name, searchUsers])

  // Clear selection if the typed name no longer matches it exactly
  useEffect(() => {
    if (selected && selected.name !== name.trim()) {
      setSelected(null)
    }
  }, [name, selected])

  const handleLogIn = () => {
    if (!selected || loggingIn) return
    loginAs(selected)
  }

  const handleCreate = () => {
    if (!name.trim() || loggingIn) return
    createUser(name)
  }

  const handleSelect = (u) => {
    setSelected(u)
    setName(u.name)
    setShowDropdown(false)
    setLoginError(null)
  }

  const canLogIn = Boolean(selected) && !loggingIn
  const canCreate = Boolean(name.trim()) && !loggingIn

  return (
    <div className="login-backdrop">
      <div className="login-card">
        <h1>OffiSir</h1>
        <p>Enter your name</p>
        <div className="login-input-wrap">
          <input
            autoFocus
            className="login-input"
            onChange={(e) => {
              setName(e.target.value)
              setLoginError(null)
            }}
            onFocus={() => setShowDropdown(true)}
            onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
            placeholder="Your name"
            type="text"
            value={name}
          />
          {showDropdown && matches.length > 0 && (
            <ul className="login-dropdown">
              {matches.map((u) => (
                <li
                  key={u.id}
                  className={`login-dropdown-item ${selected?.id === u.id ? 'is-selected' : ''}`}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    handleSelect(u)
                  }}
                >
                  {u.name}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="login-buttons">
          <button
            className="login-button login-button--primary"
            disabled={!canLogIn}
            onClick={handleLogIn}
            type="button"
          >
            {loggingIn && selected ? 'Logging in…' : 'Log in'}
          </button>
          <button
            className="login-button login-button--secondary"
            disabled={!canCreate}
            onClick={handleCreate}
            type="button"
          >
            {loggingIn && !selected ? 'Creating…' : 'New user'}
          </button>
        </div>
        {loginError && <div className="login-error">{loginError}</div>}
      </div>
    </div>
  )
}
