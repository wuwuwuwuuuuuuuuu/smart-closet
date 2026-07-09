const cloud = require('wx-server-sdk')
const { expireOutfitDetails } = require('./service')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command
const PAGE_SIZE = 100

async function listOlderThan(earliestRecentDate) {
  const result = []
  let offset = 0
  while (true) {
    const res = await db.collection('outfitRecords')
      .where({ dateKey: _.lt(earliestRecentDate) })
      .skip(offset)
      .limit(PAGE_SIZE)
      .get()
    const rows = res.data || []
    result.push(...rows)
    if (rows.length < PAGE_SIZE) break
    offset += rows.length
  }
  return result
}

function createGateway() {
  return {
    listOlderThan,
    expireRecord(id) {
      return db.collection('outfitRecords').doc(id).update({
        data: {
          clothingIds: [],
          detailsExpired: true
        }
      })
    }
  }
}

exports.main = async () => {
  try {
    return await expireOutfitDetails({
      gateway: createGateway(),
      now: new Date()
    })
  } catch (error) {
    console.error('expireOutfitDetails failed', error)
    return { code: 500, message: '穿搭详情清理失败', data: {} }
  }
}

exports.createGateway = createGateway
