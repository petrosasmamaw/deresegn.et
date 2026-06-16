import { createAuthClient } from 'better-auth/react'
import { getAuthBaseUrl } from './apiBase'

export const authClient = createAuthClient({
  baseURL: getAuthBaseUrl(),
  fetchOptions: {
    credentials: 'include',
  },
})

export const { signIn, signUp, signOut, useSession, getSession } = authClient
