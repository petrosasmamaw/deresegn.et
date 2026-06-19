import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import axios from '../../api/axiosInstance'
import { unwrap } from '../../api/unwrap'

export const performCheck = createAsyncThunk(
  'checks/perform',
  async ({ screenshot, method, form, withDetails = true }, { rejectWithValue }) => {
    try {
      const formData = new FormData()
      formData.append('screenshot', screenshot)
      formData.append('method', method)
      formData.append('withDetails', withDetails ? 'true' : 'false')
      if (withDetails) {
        formData.append('senderName', form.senderName)
        formData.append('senderAccount', form.senderAccount)
        formData.append('receiverName', form.receiverName)
        formData.append('receiverAccount', form.receiverAccount)
        formData.append('amount', form.amount)
        formData.append('transactionCode', form.transactionCode)
      }

      const res = await axios.post('/check', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 180000,
      })
      const data = unwrap(res)
      return {
        check: data.check,
        newBalance: data.newBalance,
        issues: data.issues || [],
        resolvedDetails: data.resolvedDetails || null,
      }
    } catch (err) {
      return rejectWithValue(err.response?.data || { message: err.message })
    }
  }
)

export const fetchCheckHistory = createAsyncThunk(
  'checks/history',
  async (limit = 50, { rejectWithValue }) => {
    try {
      const res = await axios.get(`/check/history?limit=${limit}`)
      const data = unwrap(res)
      return data.checks || []
    } catch (err) {
      return rejectWithValue(err.response?.data || err.message)
    }
  }
)

const slice = createSlice({
  name: 'checks',
  initialState: { list: [], loading: false, error: null, submitting: false, lastCheck: null, lastResolvedDetails: null },
  reducers: {
    clearError(state) {
      state.error = null
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(performCheck.pending, (s) => { s.submitting = true; s.error = null })
      .addCase(performCheck.fulfilled, (s, a) => {
        s.submitting = false
        s.lastCheck = a.payload.check
        s.lastResolvedDetails = a.payload.resolvedDetails
        s.list.unshift(a.payload.check)
      })
      .addCase(performCheck.rejected, (s, a) => { s.submitting = false; s.error = a.payload })

      .addCase(fetchCheckHistory.pending, (s) => { s.loading = true; s.error = null })
      .addCase(fetchCheckHistory.fulfilled, (s, a) => { s.loading = false; s.list = a.payload })
      .addCase(fetchCheckHistory.rejected, (s, a) => { s.loading = false; s.error = a.payload })
  },
})

export const { clearError } = slice.actions
export default slice.reducer
