const cloud = require('wx-server-sdk')
const { getOutfitHistory } = require('./service')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const PAGE_SIZE = 100

function firstData(res) {
  return res && Array.isArray(res.data) ? res.data[0] : null
}

async function listAllDateKeys(openid) {
  const result = []
  let offset = 0
  while (true) {
    const res = await db.collection('outfitRecords')
      .where({ _openid: openid })
      .field({ dateKey: true })
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
    async findUser(openid) {
      return firstData(await db.collection('users').where({ _openid: openid })
        .orderBy('createdAt', 'desc').limit(1).get())
    },
    async listByDate(openid, dateKey) {
      const res = await db.collection('outfitRecords')
        .where({ _openid: openid, dateKey })
        .orderBy('slot', 'asc')
        .get()
      return res.data || []
    },
    listAllDateKeys
  }
}

exports.main = async event => {
  try {
    return await getOutfitHistory({
      gateway: createGateway(),
      openid: cloud.getWXContext().OPENID,
      event,
      now: new Date()
    })
  } catch (error) {
    console.error('getOutfitHistory failed', error)
    return { code: 500, message: '获取历史穿搭失败', data: {} }
  }
}

exports.createGateway = createGateway
