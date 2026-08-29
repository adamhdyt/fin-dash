'use client'

const TOKEN_KEY = 'finmate_token'
const USER_KEY = 'finmate_user'

export function getToken() {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(TOKEN_KEY)
}

export function setAuth(token, user) {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export function getUser() {
  if (typeof window === 'undefined') return null
  const raw = localStorage.getItem(USER_KEY)
  return raw ? JSON.parse(raw) : null
}

export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

export async function apiFetch(path, options = {}) {
  const token = getToken()
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) }
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch(`/api${path}`, { ...options, headers })
  const contentType = res.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Request failed')
    return data
  }
  if (!res.ok) throw new Error('Request failed')
  return res
}

export function formatIDR(n) {
  const num = Number(n) || 0
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(num)
}

export function formatDate(d) {
  if (!d) return ''
  const date = new Date(d)
  return date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}

export const ACCOUNT_TYPES = [
  { value: 'cash', label: 'Kas', icon: '💵' },
  { value: 'bank', label: 'Rekening Bank', icon: '🏦' },
  { value: 'ewallet', label: 'E-Wallet', icon: '📱' },
  { value: 'credit_card', label: 'Kartu Kredit', icon: '💳' },
  { value: 'investment', label: 'Investasi', icon: '📈' },
]
