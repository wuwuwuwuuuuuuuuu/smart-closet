const axios = require('axios')
const { extractJsonObjectString, parseStructuredRecommendation } = require('./recommendation-parser')
const { buildCloudFallbackRecommendation, normalizeInput } = require('./fallback-recommendation')
const { logWarning, logError } = require('./logger')

let localConfig = {}
try {
  localConfig = require('../config.local')
} catch (error) {
  localConfig = {}
}

function getProviderConfig() {
  return {
    apiKey: process.env.QIANFAN_API_KEY || localConfig.QIANFAN_API_KEY || '',
    baseUrl: (process.env.QIANFAN_BASE_URL || localConfig.QIANFAN_BASE_URL || 'https://qianfan.baidubce.com/v2').replace(/\/$/, ''),
    model: process.env.QIANFAN_MODEL || localConfig.QIANFAN_MODEL || 'ernie-4.5-8k-preview'
  }
}

function normalizeStringArray(list = []) {
  if (!Array.isArray(list)) {
    return []
  }

  return list
    .filter(item => item !== undefined && item !== null)
    .map(item => String(item).trim())
    .filter(Boolean)
}

function normalizeWardrobePhotos(photos = []) {
  if (!Array.isArray(photos)) {
    logWarning('modelProvider.normalizeWardrobePhotos', 'invalid wardrobe photos', {
      photosType: typeof photos
    })
    return []
  }

  return photos.filter(item => item && normalizeInput(item.photoUrl))
}

function buildAnalyzePrompt(photoCount) {
  return [
    'You are a wardrobe analysis assistant.',
    `I will provide ${photoCount} clothing images in order.`,
    'Please analyze them one by one and respond in Chinese.',
    'Return strict JSON only. Do not use markdown. Do not add explanations.',
    'Output JSON schema:',
    '{',
    '  "items": [',
    '    {',
    '      "index": 1,',
    '      "category": "",',
    '      "colors": [],',
    '      "styleTags": [],',
    '      "season": [],',
    '      "description": ""',
    '    }',
    '  ],',
    '  "summary": ""',
    '}',
    'The index starts from 1 and must match the image order.'
  ].join('\n')
}

function buildRecommendPrompt(options = {}) {
  const payload = {
    userQuery: normalizeInput(options.userQuery),
    weatherInfo: options.weatherInfo && typeof options.weatherInfo === 'object' ? options.weatherInfo : {},
    weatherSuggestion: normalizeInput(options.weatherSuggestion),
    city: normalizeInput(options.city),
    occasion: normalizeInput(options.occasion),
    userPreferences: options.userPreferences && typeof options.userPreferences === 'object' ? options.userPreferences : {},
    analyzedItems: Array.isArray(options.analyzedItems) ? options.analyzedItems : []
  }

  return [
    'You are a smart outfit recommendation assistant.',
    'Generate the final recommendation in Chinese based on user need, weather, occasion and analyzed wardrobe items.',
    'Return strict JSON only. Do not use markdown. Do not add explanations.',
    'selectedPhotoUrls must only contain photoUrl values from analyzedItems.',
    'If image analysis is unavailable, you may infer from item name/category/season/tags metadata.',
    'Output JSON schema:',
    '{',
    '  "summary": "",',
    '  "replyText": "",',
    '  "outfitLines": [],',
    '  "tips": [],',
    '  "selectedPhotoUrls": []',
    '}',
    'Input data:',
    JSON.stringify(payload)
  ].join('\n')
}

function buildAnalyzeMessages(wardrobePhotos = []) {
  return [
    {
      role: 'user',
      content: [
        { type: 'text', text: buildAnalyzePrompt(wardrobePhotos.length) },
        ...wardrobePhotos.map(item => ({
          type: 'image_url',
          image_url: {
            url: item.photoUrl
          }
        }))
      ]
    }
  ]
}

function buildRecommendMessages(options = {}) {
  return [
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text: buildRecommendPrompt(options)
        }
      ]
    }
  ]
}

function extractResponseText(responseData = {}) {
  const content = responseData
    && responseData.choices
    && responseData.choices[0]
    && responseData.choices[0].message
    ? responseData.choices[0].message.content
    : ''

  if (typeof content === 'string') {
    return content
  }

  if (Array.isArray(content)) {
    return content
      .map(item => {
        if (typeof item === 'string') {
          return item
        }
        if (item && typeof item.text === 'string') {
          return item.text
        }
        return ''
      })
      .join('')
      .trim()
  }

  return ''
}

async function callQianfanChatCompletions({ messages, requester } = {}) {
  const { apiKey, baseUrl, model } = getProviderConfig()
  if (!apiKey) {
    throw new Error('missing QIANFAN_API_KEY')
  }

  const requestFn = requester || axios.post
  const payload = {
    model,
    messages,
    stream: false,
    temperature: 0.2,
    max_tokens: 1024
  }

  try {
    const response = await requestFn(
      `${baseUrl}/chat/completions`,
      payload,
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`
        },
        timeout: 30000
      }
    )

    return response && response.data ? response.data : response
  } catch (error) {
    logError('modelProvider.callQianfanChatCompletions', error, {
      status: error && error.response && error.response.status,
      data: error && error.response && error.response.data
    })
    throw error
  }
}

function parseJsonText(modelText) {
  const jsonText = extractJsonObjectString(modelText)
  return JSON.parse(jsonText)
}

function buildMetadataAnalyzedItems(wardrobePhotos = []) {
  return wardrobePhotos.map(photo => ({
    clothesId: photo.clothesId,
    photoUrl: photo.photoUrl,
    name: normalizeInput(photo.name),
    category: normalizeInput(photo.category),
    colors: [],
    styleTags: normalizeStringArray(photo.tags),
    season: normalizeStringArray(normalizeInput(photo.season).split('/')),
    tags: normalizeStringArray(photo.tags),
    description: normalizeInput(photo.name) || normalizeInput(photo.category) || '衣橱单品'
  }))
}

function normalizeAnalyzedItems(parsed = {}, wardrobePhotos = []) {
  const items = Array.isArray(parsed.items) ? parsed.items : []

  if (items.length && items.length !== wardrobePhotos.length) {
    logWarning('modelProvider.normalizeAnalyzedItems', 'analysis item count mismatch', {
      modelItems: items.length,
      wardrobePhotos: wardrobePhotos.length
    })
  }

  return wardrobePhotos.map((photo, index) => {
    const matched = items.find(item => Number(item && item.index) === index + 1) || items[index] || {}
    const seasonList = Array.isArray(matched.season)
      ? normalizeStringArray(matched.season)
      : normalizeStringArray(normalizeInput(photo.season).split('/'))

    return {
      clothesId: photo.clothesId,
      photoUrl: photo.photoUrl,
      name: normalizeInput(photo.name),
      category: normalizeInput(matched.category) || normalizeInput(photo.category),
      colors: normalizeStringArray(matched.colors),
      styleTags: normalizeStringArray(matched.styleTags),
      season: seasonList,
      tags: normalizeStringArray(photo.tags),
      description: normalizeInput(matched.description) || normalizeInput(photo.name) || normalizeInput(photo.category)
    }
  })
}

async function analyzeWardrobePhotos({ photos = [], requester } = {}) {
  const wardrobePhotos = normalizeWardrobePhotos(photos)
  if (!wardrobePhotos.length) {
    logWarning('modelProvider.analyzeWardrobePhotos', 'wardrobe photos empty')
    return {
      items: [],
      summary: 'Analyzed 0 wardrobe photos.'
    }
  }

  const responseData = await callQianfanChatCompletions({
    messages: buildAnalyzeMessages(wardrobePhotos),
    requester
  })
  const modelText = extractResponseText(responseData)
  const parsed = parseJsonText(modelText)

  return {
    items: normalizeAnalyzedItems(parsed, wardrobePhotos),
    summary: normalizeInput(parsed.summary) || `Analyzed ${wardrobePhotos.length} wardrobe photos.`
  }
}

async function recommendFromPhotos(options = {}) {
  const wardrobePhotos = normalizeWardrobePhotos(options.wardrobePhotos)
  const responseData = await callQianfanChatCompletions({
    messages: buildRecommendMessages({
      userQuery: options.userQuery,
      analyzedItems: options.analyzedItems,
      userPreferences: options.userPreferences,
      weatherInfo: options.weatherInfo,
      weatherSuggestion: options.weatherSuggestion,
      city: options.city,
      occasion: options.occasion
    }),
    requester: options.requester
  })

  const modelText = extractResponseText(responseData)
  return parseStructuredRecommendation(modelText, wardrobePhotos)
}

async function buildTextOnlyRecommendation(options = {}) {
  const wardrobePhotos = normalizeWardrobePhotos(options.wardrobePhotos)
  const analyzedItems = buildMetadataAnalyzedItems(wardrobePhotos)
  const recommendation = await recommendFromPhotos({
    requestId: options.requestId,
    userQuery: options.userQuery,
    analyzedItems,
    wardrobePhotos,
    userPreferences: options.userPreferences,
    weatherInfo: options.weatherInfo,
    weatherSuggestion: options.weatherSuggestion,
    city: options.city,
    occasion: options.occasion,
    requester: options.requester
  })

  return {
    success: true,
    recommendation: {
      ...recommendation,
      source: 'qianfan_text_fallback'
    },
    wardrobeAnalysis: `Image analysis unavailable, fallback to wardrobe metadata for ${wardrobePhotos.length} items.`
  }
}

async function photoBasedRecommendation(options = {}) {
  const wardrobePhotos = normalizeWardrobePhotos(options.wardrobePhotos)
  if (!wardrobePhotos.length) {
    return {
      success: true,
      recommendation: buildCloudFallbackRecommendation({
        requestId: options.requestId,
        weatherSuggestion: options.weatherSuggestion
      }, []),
      wardrobeAnalysis: 'Analyzed 0 wardrobe photos.'
    }
  }

  try {
    const wardrobeAnalysis = await analyzeWardrobePhotos({
      photos: wardrobePhotos,
      requester: options.requester
    })

    const recommendation = await recommendFromPhotos({
      requestId: options.requestId,
      userQuery: options.userQuery,
      analyzedItems: wardrobeAnalysis.items,
      wardrobePhotos,
      userPreferences: options.userPreferences,
      weatherInfo: options.weatherInfo,
      weatherSuggestion: options.weatherSuggestion,
      city: options.city,
      occasion: options.occasion,
      requester: options.requester
    })

    return {
      success: true,
      recommendation: {
        ...recommendation,
        source: recommendation.source || 'qianfan_multimodal'
      },
      wardrobeAnalysis: wardrobeAnalysis.summary
    }
  } catch (error) {
    logWarning('modelProvider.photoBasedRecommendation', 'image analysis failed, fallback to text-only recommendation', {
      message: error && error.message,
      status: error && error.response && error.response.status
    })

    return buildTextOnlyRecommendation(options)
  }
}

module.exports = {
  getProviderConfig,
  buildAnalyzeMessages,
  buildRecommendMessages,
  extractResponseText,
  buildMetadataAnalyzedItems,
  analyzeWardrobePhotos,
  recommendFromPhotos,
  buildTextOnlyRecommendation,
  photoBasedRecommendation
}
