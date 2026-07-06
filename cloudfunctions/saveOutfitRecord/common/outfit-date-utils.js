const SHANGHAI_TIME_ZONE = 'Asia/Shanghai'
const formatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: SHANGHAI_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
})

function toShanghaiDateKey(input = new Date()) {
  const date = input instanceof Date ? input : new Date(input)
  if (Number.isNaN(date.getTime())) throw new TypeError('Invalid date input')
  const values = {}
  formatter.formatToParts(date).forEach(part => {
    if (part.type !== 'literal') values[part.type] = part.value
  })
  return `${values.year}-${values.month}-${values.day}`
}

module.exports = { SHANGHAI_TIME_ZONE, toShanghaiDateKey }
