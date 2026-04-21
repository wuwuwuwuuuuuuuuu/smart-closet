function logError(scope, error, extra = {}) {
  console.error(`[SmartReminder][${scope}]`, {
    message: error && error.message ? error.message : String(error),
    ...extra
  })
}

function logWarning(scope, message, extra = {}) {
  console.warn(`[SmartReminder][${scope}] ${message}`, extra)
}

module.exports = {
  logError,
  logWarning
}
