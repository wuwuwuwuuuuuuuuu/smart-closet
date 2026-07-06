const assert = require('assert')

const calls = []
global.wx = {
  cloud: {
    callFunction(options) {
      calls.push(options)
      if (options.name === 'saveOutfitRecord') {
        options.success({
          result: {
            code: 409,
            message: '已保存3套穿搭，是否前往删除一套后再保存？',
            data: { reason: 'DAILY_OUTFIT_LIMIT_REACHED', canManage: true }
          }
        })
        return
      }
      options.success({
        result: { code: 200, message: 'ok', data: { records: [] } }
      })
    }
  }
}

const service = require('../../services/outfitService.cloud')

async function run() {
  const beforeInvalid = calls.length
  const invalid = await service.saveOutfitRecord({
    outfitImageFileID: 'https://example.com/a.png',
    requestId: 'invalid'
  })
  assert.strictEqual(invalid.code, 400)
  assert.strictEqual(calls.length, beforeInvalid)

  const limit = await service.saveOutfitRecord({
    outfitImageFileID: 'cloud://env/a.png',
    clothingIds: ['A'],
    requestId: 'r1'
  })
  assert.strictEqual(limit.code, 409)
  assert.strictEqual(limit.data.reason, 'DAILY_OUTFIT_LIMIT_REACHED')

  await service.deleteTodayOutfit('outfit-1')
  assert.deepStrictEqual(calls.pop().data, { outfitId: 'outfit-1' })
  await service.getOutfitHistory({ dateKey: '2026-07-05' })
  assert.deepStrictEqual(calls.pop().data, { dateKey: '2026-07-05' })

  console.log('outfit-cloud-service.test.js passed')
}

run().catch(error => {
  console.error(error)
  process.exitCode = 1
})
