const assert = require('assert')
const {
  buildWardrobePhotoPayload,
  mapPhotoUrlsToClothesIds
} = require('../../cloudfunctions/smartRecommendPhoto/utils/wardrobe-photo-mapper')

const originalWarn = console.warn
console.warn = () => {}

const payload = buildWardrobePhotoPayload([
  {
    _id: '1',
    image: 'cloud://img-1',
    name: '白衬衫',
    category: '上衣',
    season: '春/秋',
    tags: ['通勤', ' 简约 ']
  },
  {
    _id: '2',
    image: 'cloud://img-2',
    tags: 'not-array'
  },
  {
    _id: '',
    image: 'cloud://invalid'
  },
  {
    _id: '3'
  }
])

assert.strictEqual(payload.length, 2)
assert.deepStrictEqual(payload[0], {
  clothesId: '1',
  photoFileId: 'cloud://img-1',
  name: '白衬衫',
  category: '上衣',
  season: '春/秋',
  tags: ['通勤', '简约']
})
assert.deepStrictEqual(payload[1], {
  clothesId: '2',
  photoFileId: 'cloud://img-2',
  name: '',
  category: '',
  season: '',
  tags: []
})
assert.deepStrictEqual(buildWardrobePhotoPayload('invalid'), [])

const mappedIds = mapPhotoUrlsToClothesIds(
  ['https://img/1', 'https://img/2', 'https://img/1', 'https://img/404'],
  [
    { clothesId: '1', photoUrl: 'https://img/1' },
    { clothesId: '2', photoUrl: 'https://img/2' }
  ]
)
assert.deepStrictEqual(mappedIds, ['1', '2'])

console.warn = originalWarn

console.log('wardrobe-photo-mapper.test.js passed')
