import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import { authClient } from '../../lib/authClient'
import axios from '../../api/axiosInstance'
import { unwrap } from '../../api/unwrap'

export const signup = createAsyncThunk('auth/signup', async (payload, { rejectWithValue }) => {
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

    const { data: session } = await authClient.getSession()
    if (!session?.user) {
      return rejectWithValue('Account created but session was not saved. Try logging in.')
    }

    try {
      const res = await axios.get('/users/me')
      const profile = unwrap(res)
      if (profile?.user) return profile.user
    } catch {
      // Fall back to session user when profile fetch fails
    }

    return session.user
  } catch (err) {
    return rejectWithValue(err.response?.data?.message || err.message)
  }
})

export const login = createAsyncThunk('auth/login', async (payload, { rejectWithValue }) => {
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

    const { data: session } = await authClient.getSession()
    if (!session?.user) {
      return rejectWithValue('Login succeeded but session was not saved. Try again or clear site cookies.')
    }

    try {
      const res = await axios.get('/users/me')
      const profile = unwrap(res)
      if (profile?.user) return profile.user
    } catch {
      // Fall back to session user when profile fetch fails
    }

    return session.user
  } catch (err) {
    return rejectWithValue(err.response?.data?.message || err.message)
  }
})

export const fetchSession = createAsyncThunk('auth/session', async (_, { rejectWithValue }) => {
  try {
    const { data: session } = await authClient.getSession()
    if (!session?.user) return null
    const res = await axios.get('/users/me')
    const data = unwrap(res)
    if (!data?.user) return null
    return data.user
  } catch {
    return null
  }
})

export const logout = createAsyncThunk('auth/logout', async () => {
  await authClient.signOut()
})

const slice = createSlice({
  name: 'auth',
  initialState: { user: null, initializing: false, submitting: false, error: null },
  reducers: {
    clearError(state) {
      state.error = null
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

      .addCase(fetchSession.pending, (s) => { s.initializing = true })
      .addCase(fetchSession.fulfilled, (s, a) => { s.initializing = false; s.user = a.payload })
      .addCase(fetchSession.rejected, (s) => { s.initializing = false; s.user = null })

      .addCase(logout.fulfilled, (s) => { s.user = null; s.error = null })
  },
})

export const { clearError } = slice.actions
export default slice.reducer
