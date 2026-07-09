const formatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Shanghai',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
})
const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/

function toShanghaiDateKey(input = new Date()) {
  const date = input instanceof Date ? input : new Date(input)
  if (Number.isNaN(date.getTime())) throw new TypeError('Invalid date input')
  const values = {}
  formatter.formatToParts(date).forEach(part => {
    if (part.type !== 'literal') values[part.type] = part.value
  })
  return `${values.year}-${values.month}-${values.day}`
}

function parseDateKey(dateKey) {
  if (!DATE_KEY_PATTERN.test(dateKey || '')) return null
  const [year, month, day] = dateKey.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day
    ? date
    : null
}

function naturalDayDifference(newerDateKey, olderDateKey) {
  const newer = parseDateKey(newerDateKey)
  const older = parseDateKey(olderDateKey)
  if (!newer || !older) return NaN
  return Math.round((newer - older) / 86400000)
}

module.exports = { toShanghaiDateKey, parseDateKey, naturalDayDifference }
