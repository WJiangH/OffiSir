import React, { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from './supabase'

const UserContext = createContext(null)

const STORAGE_KEY = 'reviewer_user_v1'

export function UserProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  })
  const [loginError, setLoginError] = useState(null)
  const [loggingIn, setLoggingIn] = useState(false)

  useEffect(() => {
    if (user) localStorage.setItem(STORAGE_KEY, JSON.stringify(user))
    else localStorage.removeItem(STORAGE_KEY)
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
        .select('id, name')
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
      .select('id, name')
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
