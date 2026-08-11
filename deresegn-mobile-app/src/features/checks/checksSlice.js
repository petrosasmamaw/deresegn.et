import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import { api } from '../../api/http'
import { unwrap } from '../../api/unwrap'
import { compressImageForUpload } from '../../lib/compressImage'

function failPayload(errOrBody, fallback = 'Request failed') {
  if (!errOrBody) return { message: fallback }
  if (typeof errOrBody === 'string') return { message: errOrBody }
  return errOrBody
}

function normalizePerformData(data) {
  return {
    check: {
      ...data.check,
      isRecheck: data.isRecheck,
      previousVerification:
        data.check?.previousVerification || data.previousVerification || null,
    },
    newBalance: data.newBalance,
    issues: data.issues || [],
    resolvedDetails: data.resolvedDetails || null,
  }
}

function upsertCheck(list, check) {
  if (!check?.id) return list
  const idx = list.findIndex((c) => c.id === check.id)
  if (idx >= 0) {
    const next = list.slice()
    next[idx] = check
    return next
  }
  return [check, ...list]
}

export const performCheck = createAsyncThunk(
  'checks/perform',
  async ({ screenshot, method, form, withDetails = true }, { rejectWithValue }) => {
    try {
      const uploadFile = await compressImageForUpload(screenshot)
      const formData = new FormData()
      formData.append('screenshot', {
        uri: uploadFile.uri,
        name: uploadFile.name,
        type: uploadFile.type,
      })
      formData.append('method', method)
      formData.append('withDetails', withDetails ? 'true' : 'false')
      if (withDetails && form) {
        formData.append('senderName', form.senderName || '')
        formData.append('senderAccount', form.senderAccount || '')
        formData.append('receiverName', form.receiverName || '')
        formData.append('receiverAccount', form.receiverAccount || '')
        formData.append('amount', form.amount || '')
        formData.append('transactionCode', form.transactionCode || '')
      }

      const res = await api.post('/check', formData, {
        timeout: 180000,
      })
      if (res.status >= 400) {
        return rejectWithValue(failPayload(res.data, 'Receipt could not be verified'))
      }
      const data = unwrap(res)
      return normalizePerformData(data)
    } catch (err) {
      return rejectWithValue(failPayload(err.response?.data || err, err.message))
    }
  },
)

export const performReferenceCheck = createAsyncThunk(
  'checks/performReference',
  async ({ method, transactionCode, accountSuffix = '' }, { rejectWithValue }) => {
    try {
      const res = await api.post(
        '/check/reference',
        { method, transactionCode, accountSuffix },
        { timeout: 120000 },
      )
      if (res.status >= 400) {
        return rejectWithValue(failPayload(res.data, 'Payment ID could not be verified'))
      }
      const data = unwrap(res)
      return normalizePerformData(data)
    } catch (err) {
      return rejectWithValue(failPayload(err.response?.data || err, err.message))
    }
  },
)

export const performSmsCheck = createAsyncThunk(
  'checks/performSms',
  async ({ method, smsText }, { rejectWithValue }) => {
    try {
      const res = await api.post(
        '/check/sms',
        { method, smsText },
        { timeout: 120000 },
      )
      if (res.status >= 400) {
        return rejectWithValue(failPayload(res.data, 'SMS could not be verified'))
      }
      const data = unwrap(res)
      return normalizePerformData(data)
    } catch (err) {
      return rejectWithValue(failPayload(err.response?.data || err, err.message))
    }
  },
)

export const fetchCheckHistory = createAsyncThunk(
  'checks/history',
  async (limit = 50, { rejectWithValue }) => {
    try {
      const res = await api.get(`/check/history?limit=${limit}`)
      if (res.status >= 400) {
        return rejectWithValue(failPayload(res.data, 'Could not load history'))
      }
      const data = unwrap(res)
      return data.checks || []
    } catch (err) {
      return rejectWithValue(failPayload(err, err.message))
    }
  },
)

const slice = createSlice({
  name: 'checks',
  initialState: {
    list: [],
    loading: false,
    error: null,
    submitting: false,
    lastCheck: null,
    lastResolvedDetails: null,
  },
  reducers: {
    clearError(state) {
      state.error = null
    },
    clearChecksError(state) {
      state.error = null
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(performCheck.pending, (s) => {
        s.submitting = true
        s.error = null
      })
      .addCase(performCheck.fulfilled, (s, a) => {
        s.submitting = false
        s.lastCheck = a.payload.check
        s.lastResolvedDetails = a.payload.resolvedDetails
        s.list = upsertCheck(s.list, a.payload.check)
      })
      .addCase(performCheck.rejected, (s, a) => {
        s.submitting = false
        s.error = a.payload
      })

      .addCase(performReferenceCheck.pending, (s) => {
        s.submitting = true
        s.error = null
      })
      .addCase(performReferenceCheck.fulfilled, (s, a) => {
        s.submitting = false
        s.lastCheck = a.payload.check
        s.lastResolvedDetails = a.payload.resolvedDetails
        s.list = upsertCheck(s.list, a.payload.check)
      })
      .addCase(performReferenceCheck.rejected, (s, a) => {
        s.submitting = false
        s.error = a.payload
      })

      .addCase(performSmsCheck.pending, (s) => {
        s.submitting = true
        s.error = null
      })
      .addCase(performSmsCheck.fulfilled, (s, a) => {
        s.submitting = false
        s.lastCheck = a.payload.check
        s.lastResolvedDetails = a.payload.resolvedDetails
        s.list = upsertCheck(s.list, a.payload.check)
      })
      .addCase(performSmsCheck.rejected, (s, a) => {
        s.submitting = false
        s.error = a.payload
      })

      .addCase(fetchCheckHistory.pending, (s) => {
        s.loading = true
        s.error = null
      })
      .addCase(fetchCheckHistory.fulfilled, (s, a) => {
        s.loading = false
        s.list = a.payload || []
        if (a.payload?.length && !s.lastCheck) {
          s.lastCheck = a.payload[0]
        }
      })
      .addCase(fetchCheckHistory.rejected, (s, a) => {
        s.loading = false
        s.error = a.payload
      })
  },
})

export const { clearError, clearChecksError } = slice.actions
export default slice.reducer
