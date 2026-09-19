import { createAuthClient } from 'better-auth/react'
import { getAuthBaseUrl } from './apiBase'

export const authClient = createAuthClient({
  baseURL: getAuthBaseUrl(),
  fetchOptions: {
    credentials: 'include',
    auth: {
      type: 'Bearer',
      token: () => (typeof window !== 'undefined' ? localStorage.getItem('tamagn_auth_token') : null),
    },
    headers: {
      'X-Requested-With': 'XMLHttpRequest',
      'X-Tamagn-Client': '1',
    },
  },
})

export const {
  signIn,
  signUp,
  signOut,
  useSession,
  getSession,
  requestPasswordReset,
  resetPassword,
} = authClient
