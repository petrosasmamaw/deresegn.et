export default function errorHandler(err, req, res, next) {
  console.error(err)
  if (res.headersSent) {
    return
  }
  const status = err.status || 500
  const message = err.message || 'Internal Server Error'
  res.status(status).json({ success: false, message })
}
