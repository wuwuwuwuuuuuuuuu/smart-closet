const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/

function pad(value) {
  return String(value).padStart(2, '0')
}

function getLocalDateKey(date = new Date()) {
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate())
  ].join('-')
}

function parseDateKey(dateKey) {
  if (!DATE_KEY_PATTERN.test(dateKey || '')) return null
  const [year, month, day] = dateKey.split('-').map(Number)
  const timestamp = Date.UTC(year, month - 1, day)
  const parsed = new Date(timestamp)
  if (
    parsed.getUTCFullYear() !== year
    || parsed.getUTCMonth() !== month - 1
    || parsed.getUTCDate() !== day
  ) {
    return null
  }
  return parsed
}

function shiftDateKey(dateKey, days) {
  const date = parseDateKey(dateKey)
  if (!date || !Number.isInteger(days)) return ''
  date.setUTCDate(date.getUTCDate() + days)
  return [
    date.getUTCFullYear(),
    pad(date.getUTCMonth() + 1),
    pad(date.getUTCDate())
  ].join('-')
}

function naturalDayDifference(newerDateKey, olderDateKey) {
  const newer = parseDateKey(newerDateKey)
  const older = parseDateKey(olderDateKey)
  if (!newer || !older) return NaN
  return Math.round((newer.getTime() - older.getTime()) / 86400000)
}

function isWithinRecent10Days(dateKey, todayDateKey = getLocalDateKey()) {
  const difference = naturalDayDifference(todayDateKey, dateKey)
  return Number.isInteger(difference) && difference >= 0 && difference <= 9
}

function formatDateKey(dateKey) {
  const date = parseDateKey(dateKey)
  if (!date) return dateKey || ''
  return `${date.getUTCFullYear()}年${date.getUTCMonth() + 1}月${date.getUTCDate()}日`
}

function formatShortDateKey(dateKey) {
  const date = parseDateKey(dateKey)
  if (!date) return dateKey || ''
  return `${date.getUTCMonth() + 1}月${date.getUTCDate()}日`
}

module.exports = {
  getLocalDateKey,
  shiftDateKey,
  naturalDayDifference,
  isWithinRecent10Days,
  formatDateKey,
  formatShortDateKey
}
