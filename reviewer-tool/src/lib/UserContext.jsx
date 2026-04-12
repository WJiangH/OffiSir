import React, { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from './supabase'

const UserContext = createContext(null)
const STORAGE_KEY = 'reviewer_user_v1'

// Remove any localStorage copy from earlier builds so closing the tab
// always requires re-login on next visit.
if (typeof window !== 'undefined') {
  try { window.localStorage.removeItem(STORAGE_KEY) } catch {}
}

export function UserProvider({ children }) {
  // User persists in sessionStorage — survives a refresh in the same tab,
  // cleared when the tab/browser closes.
  const [user, setUser] = useState(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY)
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  })
  const [loginError, setLoginError] = useState(null)
  const [loggingIn, setLoggingIn] = useState(false)

  useEffect(() => {
    try {
      if (user) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(user))
      else sessionStorage.removeItem(STORAGE_KEY)
    } catch {}
  }, [user])

  const loginAs = (existingUser) => {
    setLoginError(null)
    setUser(existingUser)
  }

  const createUser = async (rawName) => {
    const name = rawName.trim()
    if (!name) return
    setLoggingIn(true)
    setLoginError(null)
    try {
      // Check uniqueness
      const { data: existing, error: selectError } = await supabase
        .from('users')
        .select('id')
        .eq('name', name)
        .maybeSingle()
      if (selectError) throw selectError
      if (existing) {
        setLoginError('This name is taken, pick a different one.')
        return
      }
      const { data: inserted, error: insertError } = await supabase
        .from('users')
        .insert({ name })
        .select('id, name, is_admin, workflow_priority')
        .single()
      if (insertError) throw insertError
      setUser(inserted)
    } catch (err) {
      setLoginError(err.message || String(err))
    } finally {
      setLoggingIn(false)
    }
  }

  const searchUsers = async (query) => {
    const q = query.trim()
    if (!q) return []
    const { data, error } = await supabase
      .from('users')
      .select('id, name, is_admin, workflow_priority')
      .ilike('name', `%${q}%`)
      .order('name')
      .limit(20)
    if (error) throw error
    return data || []
  }

  const logout = () => setUser(null)

  return (
    <UserContext.Provider value={{ user, loginAs, createUser, searchUsers, logout, loggingIn, loginError, setLoginError }}>
      {children}
    </UserContext.Provider>
  )
}

export function useUser() {
  const ctx = useContext(UserContext)
  if (!ctx) throw new Error('useUser must be used inside UserProvider')
  return ctx
}
