const assert = require('assert')
const {
  analyzeWardrobePhotos,
  recommendFromPhotos,
  photoBasedRecommendation,
  buildAnalyzeMessages,
  getProviderConfig,
  extractResponseText,
  buildTextOnlyRecommendation,
  buildMetadataAnalyzedItems
} = require('../../cloudfunctions/smartRecommendPhoto/utils/model-provider')

process.env.QIANFAN_API_KEY = 'test-api-key'
process.env.QIANFAN_BASE_URL = 'https://qianfan.baidubce.com/v2'
process.env.QIANFAN_MODEL = 'ernie-4.5-8k-preview'

const requesterCalls = []
const requester = async (url, payload, config) => {
  requesterCalls.push({ url, payload, config })

  if (requesterCalls.length === 1) {
    return {
      data: {
        choices: [
          {
            message: {
              content: '{"items":[{"index":1,"category":"top","colors":["white"],"styleTags":["commute"],"season":["spring","autumn"],"description":"white shirt"},{"index":2,"category":"bottom","colors":["black"],"styleTags":["minimal"],"season":["spring","autumn"],"description":"black pants"}],"summary":"Analyzed 2 wardrobe photos."}'
            }
          }
        ]
      }
    }
  }

  return {
    data: {
      choices: [
        {
          message: {
            content: '{"summary":"done","replyText":"generated recommendation","outfitLines":["top: white shirt","bottom: black pants"],"tips":["bring a light jacket"],"selectedPhotoUrls":["u1","u2"]}'
          }
        }
      ]
    }
  }
}

const fallbackRequester = async () => {
  if (!fallbackRequester.called) {
    fallbackRequester.called = true
    const error = new Error('Request failed with status code 400')
    error.response = {
      status: 400,
      data: {
        error: {
          code: 'invalid_argument',
          message: 'fetch object failed'
        }
      }
    }
    throw error
  }

  return {
    data: {
      choices: [
        {
          message: {
            content: '{"summary":"fallback done","replyText":"text fallback recommendation","outfitLines":["top: shirt"],"tips":["light and easy"],"selectedPhotoUrls":["u1"]}'
          }
        }
      ]
    }
  }
}

;(async () => {
  const config = getProviderConfig()
  assert.strictEqual(config.apiKey, 'test-api-key')
  assert.strictEqual(config.model, 'ernie-4.5-8k-preview')

  const analyzeMessages = buildAnalyzeMessages([
    { photoUrl: 'u1' },
    { photoUrl: 'u2' }
  ])
  assert.strictEqual(analyzeMessages[0].content[0].type, 'text')
  assert.strictEqual(analyzeMessages[0].content[1].type, 'image_url')

  assert.strictEqual(extractResponseText({
    choices: [{ message: { content: [{ text: 'abc' }, { text: 'def' }] } }]
  }), 'abcdef')

  const metadataItems = buildMetadataAnalyzedItems([
    { clothesId: 'c1', photoUrl: 'u1', category: 'top', season: 'spring/autumn', tags: ['commute'], name: 'white shirt' }
  ])
  assert.strictEqual(metadataItems[0].description, 'white shirt')

  const analysis = await analyzeWardrobePhotos({
    photos: [
      { clothesId: 'c1', photoUrl: 'u1', category: 'top', season: 'spring/autumn', tags: ['commute'], name: 'white shirt' },
      { clothesId: 'c2', photoUrl: 'u2', category: 'bottom', season: 'spring/autumn', tags: ['minimal'], name: 'black pants' }
    ],
    requester
  })

  assert.strictEqual(analysis.summary, 'Analyzed 2 wardrobe photos.')
  assert.deepStrictEqual(analysis.items[0].colors, ['white'])
  assert.strictEqual(analysis.items[0].photoUrl, 'u1')

  const recommendation = await recommendFromPhotos({
    userQuery: 'what to wear for work tomorrow',
    wardrobePhotos: [
      { clothesId: 'c1', photoUrl: 'u1' },
      { clothesId: 'c2', photoUrl: 'u2' }
    ],
    analyzedItems: analysis.items,
    weatherSuggestion: 'bring a light jacket',
    requester
  })

  assert.strictEqual(recommendation.summary, 'done')
  assert.deepStrictEqual(recommendation.selectedPhotoUrls, ['u1', 'u2'])

  const textOnlyResult = await buildTextOnlyRecommendation({
    requestId: 'local_20',
    userQuery: 'travel outfit',
    weatherSuggestion: 'hot weather',
    wardrobePhotos: [
      { clothesId: 'c1', photoUrl: 'u1', category: 'top', name: 'white shirt', season: 'summer', tags: ['travel'] }
    ],
    requester: async () => ({
      data: {
        choices: [
          {
            message: {
              content: '{"summary":"text only","replyText":"fallback ok","outfitLines":["top: white shirt"],"tips":["cool"],"selectedPhotoUrls":["u1"]}'
            }
          }
        ]
      }
    })
  })
  assert.strictEqual(textOnlyResult.success, true)
  assert.strictEqual(textOnlyResult.recommendation.source, 'qianfan_text_fallback')
  assert.deepStrictEqual(textOnlyResult.recommendation.selectedPhotoUrls, ['u1'])

  requesterCalls.length = 0
  const fullResult = await photoBasedRecommendation({
    requestId: 'local_10',
    userQuery: 'what to wear for work tomorrow',
    occasion: 'commute',
    weatherSuggestion: 'bring a light jacket',
    userPreferences: {
      preferredStyle: 'minimal'
    },
    wardrobePhotos: [
      { clothesId: 'c1', photoUrl: 'u1', category: 'top', name: 'white shirt', season: 'spring/autumn', tags: ['commute'] },
      { clothesId: 'c2', photoUrl: 'u2', category: 'bottom', name: 'black pants', season: 'spring/autumn', tags: ['minimal'] }
    ],
    requester
  })

  assert.strictEqual(fullResult.success, true)
  assert.strictEqual(fullResult.wardrobeAnalysis, 'Analyzed 2 wardrobe photos.')
  assert.deepStrictEqual(fullResult.recommendation.selectedPhotoUrls, ['u1', 'u2'])
  assert.strictEqual(requesterCalls.length, 2)
  assert.ok(requesterCalls[0].url.endsWith('/chat/completions'))
  assert.strictEqual(requesterCalls[0].payload.model, 'ernie-4.5-8k-preview')
  assert.strictEqual(requesterCalls[0].config.headers.Authorization, 'Bearer test-api-key')

  fallbackRequester.called = false
  const originalError = console.error
  const originalWarn = console.warn
  console.error = () => {}
  console.warn = () => {}
  const fallbackResult = await photoBasedRecommendation({
    requestId: 'local_30',
    userQuery: 'travel outfit',
    occasion: 'travel',
    weatherSuggestion: 'hot weather',
    wardrobePhotos: [
      { clothesId: 'c1', photoUrl: 'u1', category: 'top', name: 'white shirt', season: 'summer', tags: ['travel'] }
    ],
    requester: fallbackRequester
  })
  console.error = originalError
  console.warn = originalWarn

  assert.strictEqual(fallbackResult.success, true)
  assert.strictEqual(fallbackResult.recommendation.source, 'qianfan_text_fallback')
  assert.strictEqual(fallbackResult.wardrobeAnalysis, 'Image analysis unavailable, fallback to wardrobe metadata for 1 items.')
  assert.deepStrictEqual(fallbackResult.recommendation.selectedPhotoUrls, ['u1'])

  console.log('model-provider.test.js passed')
})().catch(error => {
  console.error(error)
  process.exit(1)
})
