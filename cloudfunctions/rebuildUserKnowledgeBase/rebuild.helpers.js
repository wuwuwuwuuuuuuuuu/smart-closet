function normalizeCount(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0
}

function normalizeLimit(value, fallback = 30) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(100, Math.max(1, Math.floor(parsed)))
}

function buildRebuildStatsSummary(stats = {}) {
  const total = normalizeCount(stats.total)
  const readyCount = normalizeCount(stats.readyCount)
  const failedCount = normalizeCount(stats.failedCount)
  const skippedCount = normalizeCount(stats.skippedCount)

  let status = 'idle'
  if (readyCount > 0 && failedCount === 0) {
    status = 'success'
  } else if (readyCount > 0 && failedCount > 0) {
    status = 'partial_success'
  } else if (failedCount > 0) {
    status = 'failed'
  } else if (skippedCount > 0) {
    status = 'skipped'
  }

  return {
    status,
    text: `共处理 ${total} 件，成功 ${readyCount} 件，失败 ${failedCount} 件，跳过 ${skippedCount} 件。`
  }
}

module.exports = {
  normalizeLimit,
  buildRebuildStatsSummary
}
