import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import { authClient } from '../../lib/authClient'
import axios from '../../api/axiosInstance'
import { unwrap } from '../../api/unwrap'

function mapSessionUser(sessionUser) {
  if (!sessionUser) return null
  return {
    id: sessionUser.id,
    email: sessionUser.email,
    name: sessionUser.name,
    image: sessionUser.image ?? null,
    role: sessionUser.role || 'client',
    emailVerified: sessionUser.emailVerified,
  }
}

function saveSessionToken(data) {
  try {
    const token = data?.token || data?.session?.token || data?.sessionToken
    if (token && typeof window !== 'undefined') {
      localStorage.setItem('tamagn_auth_token', token)
    }
  } catch {
    // ignore
  }
}

function clearSessionToken() {
  try {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('tamagn_auth_token')
    }
  } catch {
    // ignore
  }
}

export const signup = createAsyncThunk('auth/signup', async (payload, { rejectWithValue, dispatch }) => {
  try {
    const { data, error } = await authClient.signUp.email({
      email: payload.email,
      password: payload.password,
      name: payload.name,
    })
    if (error) {
      return rejectWithValue(error.message || 'Signup failed')
    }
    if (!data?.user) {
      return rejectWithValue('Signup failed — no user returned')
    }

    saveSessionToken(data)

    // Prefer sign-up payload; only probe session if needed.
    const sessionUser = data.user
    const user = mapSessionUser(sessionUser)
    dispatch(hydrateProfile())
    return user
  } catch (err) {
    return rejectWithValue(err.response?.data?.message || err.message)
  }
})

export const login = createAsyncThunk('auth/login', async (payload, { rejectWithValue, dispatch }) => {
  try {
    const { data, error } = await authClient.signIn.email({
      email: payload.email,
      password: payload.password,
    })
    if (error) {
      return rejectWithValue(error.message || 'Login failed')
    }
    if (!data?.user) {
      return rejectWithValue('Login failed — no user returned')
    }

    saveSessionToken(data)

    // Fast path: trust sign-in user immediately; hydrate profile in background.
    const user = mapSessionUser(data.user)
    dispatch(hydrateProfile())
    return user
  } catch (err) {
    return rejectWithValue(err.response?.data?.message || err.message)
  }
})

/** Background profile refresh — does not gate the app shell. */
export const hydrateProfile = createAsyncThunk('auth/hydrateProfile', async () => {
  try {
    // Background refresh — a 401 here must not force logout (cookie race / stale tab).
    const res = await axios.get('/users/me', { timeout: 6000, skipAuthExpire: true })
    const data = unwrap(res)
    return data?.user || null
  } catch {
    return null
  }
})

/**
 * Fast session gate: check getSession with Bearer token & cookie,
 * with graceful /users/me fallback so cross-origin auth never loses session.
 */
export const fetchSession = createAsyncThunk('auth/session', async (_, { dispatch }) => {
  const started = Date.now()
  const ensureMinHold = async () => {
    const elapsed = Date.now() - started
    if (elapsed < 350) {
      await new Promise((r) => setTimeout(r, 350 - elapsed))
    }
  }

  try {
    const token = typeof window !== 'undefined' ? localStorage.getItem('tamagn_auth_token') : null
    const headers = token ? { Authorization: `Bearer ${token}` } : {}

    const { data: session } = await authClient.getSession({
      fetchOptions: {
        headers,
      },
    })

    if (session?.user) {
      saveSessionToken(session)
      const user = mapSessionUser(session.user)
      dispatch(hydrateProfile())
      await ensureMinHold()
      return user
    }

    // Fallback: If getSession didn't return user, but we have a stored token, try /users/me
    if (token) {
      try {
        const res = await axios.get('/users/me', {
          headers: { Authorization: `Bearer ${token}` },
          skipAuthExpire: true,
          timeout: 6000,
        })
        const data = unwrap(res)
        if (data?.user) {
          await ensureMinHold()
          return mapSessionUser(data.user)
        }
      } catch {
        clearSessionToken()
      }
    }

    await ensureMinHold()
    return null
  } catch {
    await ensureMinHold()
    return null
  }
})

export const logout = createAsyncThunk('auth/logout', async () => {
  clearSessionToken()
  try {
    await authClient.signOut()
  } catch {
    // ignore
  }
})

const slice = createSlice({
  name: 'auth',
  // Start true so first paint is the session-open page (no route flash).
  initialState: { user: null, initializing: true, submitting: false, error: null },
  reducers: {
    clearError(state) {
      state.error = null
    },
    // Triggered by a 401 on any API call — drops the stale user so guarded
    // routes redirect to /login. Does NOT touch the verify/auth request flow.
    sessionExpired(state) {
      clearSessionToken()
      state.user = null
      state.initializing = false
      state.submitting = false
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(signup.pending, (s) => { s.submitting = true; s.error = null })
      .addCase(signup.fulfilled, (s, a) => { s.submitting = false; s.user = a.payload })
      .addCase(signup.rejected, (s, a) => { s.submitting = false; s.error = a.payload })

      .addCase(login.pending, (s) => { s.submitting = true; s.error = null })
      .addCase(login.fulfilled, (s, a) => { s.submitting = false; s.user = a.payload })
      .addCase(login.rejected, (s, a) => { s.submitting = false; s.error = a.payload })

      // Do not clear an existing user on re-check; only gate cold start.
      .addCase(fetchSession.pending, (s) => {
        if (!s.user) s.initializing = true
      })
      .addCase(fetchSession.fulfilled, (s, a) => {
        s.initializing = false
        s.user = a.payload
      })
      .addCase(fetchSession.rejected, (s) => {
        s.initializing = false
        s.user = null
      })

      .addCase(hydrateProfile.fulfilled, (s, a) => {
        if (a.payload) s.user = a.payload
      })

      .addCase(logout.fulfilled, (s) => { s.user = null; s.error = null })
  },
})

export const { clearError, sessionExpired } = slice.actions
export default slice.reducer
