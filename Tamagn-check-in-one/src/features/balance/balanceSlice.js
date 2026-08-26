import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import axios from '../../api/axiosInstance'
import { unwrap } from '../../api/unwrap'
import { compressImageForUpload } from '../../lib/compressImage'

export const fetchBalance = createAsyncThunk('balance/fetch', async (_, { rejectWithValue }) => {
  try {
    const res = await axios.get('/balance')
    const data = unwrap(res)
    return data.balance
  } catch (err) {
    return rejectWithValue(err.response?.data || err.message)
  }
})

export const submitTopUp = createAsyncThunk(
  'balance/topup',
  async ({ screenshot, method = 'telebirr' }, { rejectWithValue }) => {
    try {
      const uploadFile = await compressImageForUpload(screenshot)
      const formData = new FormData()
      formData.append('screenshot', uploadFile)
      formData.append('method', method)

      const res = await axios.post('/balance/topup', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 180000,
      })
      const data = unwrap(res)
      return {
        balance: data.newBalance,
        transaction: data.transaction,
        resolvedDetails: data.resolvedDetails || null,
      }
    } catch (err) {
      return rejectWithValue(err.response?.data || err.message)
    }
  }
)

export const submitTopUpReference = createAsyncThunk(
  'balance/topupReference',
  async ({ method, transactionCode, accountSuffix = '' }, { rejectWithValue }) => {
    try {
      const res = await axios.post('/balance/topup/reference', {
        method,
        transactionCode,
        accountSuffix,
      }, { timeout: 120000 })
      const data = unwrap(res)
      return {
        balance: data.newBalance,
        transaction: data.transaction,
        resolvedDetails: data.resolvedDetails || null,
      }
    } catch (err) {
      return rejectWithValue(err.response?.data || err.message)
    }
  }
)

export const submitTopUpSms = createAsyncThunk(
  'balance/topupSms',
  async ({ method, smsText }, { rejectWithValue }) => {
    try {
      const res = await axios.post('/balance/topup/sms', { method, smsText }, { timeout: 120000 })
      const data = unwrap(res)
      return {
        balance: data.newBalance,
        transaction: data.transaction,
        resolvedDetails: data.resolvedDetails || null,
      }
    } catch (err) {
      return rejectWithValue(err.response?.data || err.message)
    }
  }
)

function errMessage(payload) {
  if (!payload) return null
  return typeof payload === 'object' ? (payload.message || null) : String(payload)
}

const slice = createSlice({
  name: 'balance',
  // `error` drives the top-up modal (submit failures); `loadError` is the
  // separate read-path failure surfaced on the dashboard.
  initialState: { current: 0, loading: false, error: null, loadError: null, submitting: false },
  reducers: {
    clearError(state) {
      state.error = null
    },
    clearLoadError(state) {
      state.loadError = null
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchBalance.pending, (s) => { s.loading = true; s.loadError = null })
      .addCase(fetchBalance.fulfilled, (s, a) => {
        s.loading = false
        s.current = parseFloat(a.payload) || 0
      })
      .addCase(fetchBalance.rejected, (s, a) => { s.loading = false; s.loadError = errMessage(a.payload) })

      .addCase(submitTopUp.pending, (s) => { s.submitting = true; s.error = null })
      .addCase(submitTopUp.fulfilled, (s, a) => {
        s.submitting = false
        s.current = parseFloat(a.payload.balance) || 0
      })
      .addCase(submitTopUp.rejected, (s, a) => { s.submitting = false; s.error = a.payload })

      .addCase(submitTopUpReference.pending, (s) => { s.submitting = true; s.error = null })
      .addCase(submitTopUpReference.fulfilled, (s, a) => {
        s.submitting = false
        s.current = parseFloat(a.payload.balance) || 0
      })
      .addCase(submitTopUpReference.rejected, (s, a) => { s.submitting = false; s.error = a.payload })

      .addCase(submitTopUpSms.pending, (s) => { s.submitting = true; s.error = null })
      .addCase(submitTopUpSms.fulfilled, (s, a) => {
        s.submitting = false
        s.current = parseFloat(a.payload.balance) || 0
      })
      .addCase(submitTopUpSms.rejected, (s, a) => { s.submitting = false; s.error = a.payload })
  },
})

export const { clearError, clearLoadError } = slice.actions
export default slice.reducer
