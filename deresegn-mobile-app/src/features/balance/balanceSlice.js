import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import { api } from '../../api/http'
import { unwrap } from '../../api/unwrap'
import { compressImageForUpload } from '../../lib/compressImage'

function failMessage(errOrBody, fallback = 'Request failed') {
  if (!errOrBody) return fallback
  if (typeof errOrBody === 'string') return errOrBody
  return errOrBody.message || errOrBody.error || fallback
}

function failBody(errOrBody, fallback = 'Request failed') {
  if (!errOrBody) return { message: fallback }
  if (typeof errOrBody === 'string') return { message: errOrBody }
  return errOrBody
}

function normalizeTopUp(data) {
  return {
    balance: data.newBalance,
    transaction: data.transaction,
    resolvedDetails: data.resolvedDetails || null,
  }
}

export const fetchBalance = createAsyncThunk('balance/fetch', async (_, { rejectWithValue }) => {
  try {
    const res = await api.get('/balance')
    if (res.status >= 400) {
      return rejectWithValue(failMessage(res.data, 'Could not load balance'))
    }
    const data = unwrap(res)
    return data.balance
  } catch (err) {
    return rejectWithValue(failMessage(err, err.message))
  }
})

export const submitTopUp = createAsyncThunk(
  'balance/topup',
  async ({ screenshot, method = 'telebirr' }, { rejectWithValue }) => {
    try {
      const uploadFile = await compressImageForUpload(screenshot)
      const formData = new FormData()
      formData.append('screenshot', {
        uri: uploadFile.uri,
        name: uploadFile.name,
        type: uploadFile.type,
      })
      formData.append('method', method)

      const res = await api.post('/balance/topup', formData, { timeout: 180000 })
      if (res.status >= 400) {
        return rejectWithValue(failBody(res.data, 'Top-up could not be verified'))
      }
      const data = unwrap(res)
      return normalizeTopUp(data)
    } catch (err) {
      return rejectWithValue(failBody(err.response?.data || err, err.message))
    }
  },
)

export const submitTopUpReference = createAsyncThunk(
  'balance/topupReference',
  async ({ method, transactionCode, accountSuffix = '' }, { rejectWithValue }) => {
    try {
      const res = await api.post(
        '/balance/topup/reference',
        { method, transactionCode, accountSuffix },
        { timeout: 120000 },
      )
      if (res.status >= 400) {
        return rejectWithValue(failBody(res.data, 'Top-up could not be verified'))
      }
      const data = unwrap(res)
      return normalizeTopUp(data)
    } catch (err) {
      return rejectWithValue(failBody(err.response?.data || err, err.message))
    }
  },
)

export const submitTopUpSms = createAsyncThunk(
  'balance/topupSms',
  async ({ method, smsText }, { rejectWithValue }) => {
    try {
      const res = await api.post(
        '/balance/topup/sms',
        { method, smsText },
        { timeout: 120000 },
      )
      if (res.status >= 400) {
        return rejectWithValue(failBody(res.data, 'Top-up could not be verified'))
      }
      const data = unwrap(res)
      return normalizeTopUp(data)
    } catch (err) {
      return rejectWithValue(failBody(err.response?.data || err, err.message))
    }
  },
)

const slice = createSlice({
  name: 'balance',
  initialState: {
    current: 0,
    loading: false,
    submitting: false,
    error: null,
  },
  reducers: {
    clearBalanceError(state) {
      state.error = null
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchBalance.pending, (s) => {
        s.loading = true
        s.error = null
      })
      .addCase(fetchBalance.fulfilled, (s, a) => {
        s.loading = false
        s.current = parseFloat(a.payload) || 0
      })
      .addCase(fetchBalance.rejected, (s, a) => {
        s.loading = false
        s.error = a.payload
      })

      .addCase(submitTopUp.pending, (s) => {
        s.submitting = true
        s.error = null
      })
      .addCase(submitTopUp.fulfilled, (s, a) => {
        s.submitting = false
        s.current = parseFloat(a.payload.balance) || 0
      })
      .addCase(submitTopUp.rejected, (s, a) => {
        s.submitting = false
        s.error = a.payload
      })

      .addCase(submitTopUpReference.pending, (s) => {
        s.submitting = true
        s.error = null
      })
      .addCase(submitTopUpReference.fulfilled, (s, a) => {
        s.submitting = false
        s.current = parseFloat(a.payload.balance) || 0
      })
      .addCase(submitTopUpReference.rejected, (s, a) => {
        s.submitting = false
        s.error = a.payload
      })

      .addCase(submitTopUpSms.pending, (s) => {
        s.submitting = true
        s.error = null
      })
      .addCase(submitTopUpSms.fulfilled, (s, a) => {
        s.submitting = false
        s.current = parseFloat(a.payload.balance) || 0
      })
      .addCase(submitTopUpSms.rejected, (s, a) => {
        s.submitting = false
        s.error = a.payload
      })
  },
})

export const { clearBalanceError } = slice.actions
export default slice.reducer
