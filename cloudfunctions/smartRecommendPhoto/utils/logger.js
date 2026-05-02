function formatErrorMessage(error) {
  if (!error) {
    return 'unknown error'
  }

  if (typeof error === 'string') {
    return error
  }

  if (error.message) {
    return error.message
  }

  try {
    return JSON.stringify(error)
  } catch (serializationError) {
    return String(error)
  }
}

function logError(scope, error, extra = {}) {
  console.error(`[SmartRecommend][${scope}]`, {
    message: formatErrorMessage(error),
    ...extra
  })
}

function logWarning(scope, message, extra = {}) {
  console.warn(`[SmartRecommend][${scope}] ${message}`, extra)
}

module.exports = {
  logError,
  logWarning
}
