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
 * Fast session gate: one cookie round-trip via better-auth getSession.
 * Full /users/me profile hydrates in the background so splash never waits on it.
 */
export const fetchSession = createAsyncThunk('auth/session', async (_, { dispatch }) => {
  try {
    const { data: session } = await authClient.getSession()
    if (!session?.user) return null

    const user = mapSessionUser(session.user)
    dispatch(hydrateProfile())
    return user
  } catch {
    return null
  }
})

export const logout = createAsyncThunk('auth/logout', async () => {
  await authClient.signOut()
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
