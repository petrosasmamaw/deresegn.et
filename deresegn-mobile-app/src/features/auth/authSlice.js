import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import { authApi, api } from '../../api/http'
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

export const signup = createAsyncThunk(
  'auth/signup',
  async (payload, { rejectWithValue, dispatch }) => {
    try {
      const user = await authApi.signUpEmail(payload)
      dispatch(hydrateProfile())
      return mapSessionUser(user)
    } catch (err) {
      return rejectWithValue(err.message || 'Signup failed')
    }
  },
)

export const login = createAsyncThunk(
  'auth/login',
  async (payload, { rejectWithValue, dispatch }) => {
    try {
      const user = await authApi.signInEmail(payload)
      dispatch(hydrateProfile())
      return mapSessionUser(user)
    } catch (err) {
      return rejectWithValue(err.message || 'Login failed')
    }
  },
)

export const hydrateProfile = createAsyncThunk('auth/hydrateProfile', async () => {
  try {
    const res = await api.get('/users/me')
    if (res.status >= 400) return null
    const data = unwrap(res)
    return data?.user || null
  } catch {
    return null
  }
})

export const fetchSession = createAsyncThunk('auth/session', async (_, { dispatch, rejectWithValue }) => {
  try {
    const session = await authApi.getSession()
    const user = session?.user || null
    if (!user) return null
    dispatch(hydrateProfile())
    return mapSessionUser(user)
  } catch (err) {
    if (err?.message === 'NETWORK_UNREACHABLE') {
      return rejectWithValue({ code: 'NETWORK' })
    }
    return null
  }
})

export const logout = createAsyncThunk('auth/logout', async () => {
  await authApi.signOut()
})

const slice = createSlice({
  name: 'auth',
  initialState: {
    user: null,
    initializing: true,
    submitting: false,
    error: null,
    sessionNetworkError: false,
  },
  reducers: {
    clearError(state) {
      state.error = null
    },
    sessionExpired(state) {
      state.user = null
      state.error = null
      state.submitting = false
      state.initializing = false
      state.sessionNetworkError = false
    },
    clearSessionNetworkError(state) {
      state.sessionNetworkError = false
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(signup.pending, (s) => {
        s.submitting = true
        s.error = null
      })
      .addCase(signup.fulfilled, (s, a) => {
        s.submitting = false
        s.user = a.payload
      })
      .addCase(signup.rejected, (s, a) => {
        s.submitting = false
        s.error = a.payload
      })

      .addCase(login.pending, (s) => {
        s.submitting = true
        s.error = null
      })
      .addCase(login.fulfilled, (s, a) => {
        s.submitting = false
        s.user = a.payload
      })
      .addCase(login.rejected, (s, a) => {
        s.submitting = false
        s.error = a.payload
      })

      .addCase(fetchSession.pending, (s) => {
        if (!s.user) s.initializing = true
      })
      .addCase(fetchSession.fulfilled, (s, a) => {
        s.initializing = false
        s.sessionNetworkError = false
        s.user = a.payload
      })
      .addCase(fetchSession.rejected, (s, a) => {
        s.initializing = false
        if (a.payload?.code === 'NETWORK') {
          s.sessionNetworkError = true
          return
        }
        s.sessionNetworkError = false
        s.user = null
      })

      .addCase(hydrateProfile.fulfilled, (s, a) => {
        if (a.payload) s.user = a.payload
      })

      .addCase(logout.fulfilled, (s) => {
        s.user = null
        s.error = null
        s.submitting = false
      })
      .addCase(logout.rejected, (s) => {
        s.user = null
        s.error = null
        s.submitting = false
      })
  },
})

export const { clearError, sessionExpired, clearSessionNetworkError } = slice.actions
export default slice.reducer
