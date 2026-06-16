import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import axios from '../../api/axiosInstance'
import { unwrap } from '../../api/unwrap'

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
  async ({ screenshot, form, method = 'telebirr' }, { rejectWithValue }) => {
    try {
      const formData = new FormData()
      formData.append('screenshot', screenshot)
      formData.append('method', method)
      formData.append('senderName', form.senderName)
      formData.append('senderAccount', form.senderAccount)
      formData.append('receiverName', form.receiverName)
      formData.append('receiverAccount', form.receiverAccount)
      formData.append('amount', form.amount)
      formData.append('transactionCode', form.transactionCode)

      const res = await axios.post('/balance/topup', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      const data = unwrap(res)
      return { balance: data.newBalance, transaction: data.transaction }
    } catch (err) {
      return rejectWithValue(err.response?.data || err.message)
    }
  }
)

const slice = createSlice({
  name: 'balance',
  initialState: { current: 0, loading: false, error: null, submitting: false },
  reducers: {
    clearError(state) {
      state.error = null
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchBalance.pending, (s) => { s.loading = true; s.error = null })
      .addCase(fetchBalance.fulfilled, (s, a) => { s.loading = false; s.current = a.payload })
      .addCase(fetchBalance.rejected, (s, a) => { s.loading = false; s.error = a.payload })

      .addCase(submitTopUp.pending, (s) => { s.submitting = true; s.error = null })
      .addCase(submitTopUp.fulfilled, (s, a) => { s.submitting = false; s.current = a.payload.balance })
      .addCase(submitTopUp.rejected, (s, a) => { s.submitting = false; s.error = a.payload })
  },
})

export const { clearError } = slice.actions
export default slice.reducer
