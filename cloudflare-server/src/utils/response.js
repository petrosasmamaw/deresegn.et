export function success(res, data = {}, message = 'OK', status = 200) {
  return res.status(status).json({ success: true, message, data })
}

export function error(res, message = 'Error', status = 500, details = null) {
  return res.status(status).json({ success: false, message, details })
}
