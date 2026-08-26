import { configureStore } from '@reduxjs/toolkit'
import authReducer from '../features/auth/authSlice'
import balanceReducer from '../features/balance/balanceSlice'
import checksReducer from '../features/checks/checksSlice'

export const store = configureStore({
  reducer: {
    auth: authReducer,
    balance: balanceReducer,
    checks: checksReducer,
  },
})

export default store
