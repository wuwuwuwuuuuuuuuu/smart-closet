const https = require('https')
const { isValidVector } = require('./image-vector-utils')

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function parseJsonMaybe(value) {
  if (!value) return null
  if (typeof value === 'object') return value
  try {
    return JSON.parse(value)
  } catch (error) {
    return null
  }
}

function requestJson({ url, method = 'POST', headers = {}, body, timeoutMs = 60000 }) {
  return new Promise((resolve, reject) => {
    const payload = body === undefined ? '' : JSON.stringify(body)
    const req = https.request(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        ...headers
      },
      timeout: timeoutMs
    }, res => {
      const chunks = []
      res.on('data', chunk => chunks.push(chunk))
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8')
        const parsed = parseJsonMaybe(raw)
        if (res.statusCode < 200 || res.statusCode >= 300) {
          const message = parsed && (parsed.message || parsed.error && parsed.error.message)
            ? (parsed.message || parsed.error.message)
            : raw || `HTTP ${res.statusCode}`
          reject(new Error(message))
          return
        }
        resolve(parsed || {})
      })
    })

    req.on('timeout', () => {
      req.destroy(new Error('request timeout'))
    })
    req.on('error', reject)
    if (payload) req.write(payload)
    req.end()
  })
}

function extractEmbeddingVector(response = {}) {
  const candidates = [
    response && response.output && response.output.embeddings && response.output.embeddings[0] && response.output.embeddings[0].embedding,
    response && response.output && response.output.embedding,
    response && response.data && response.data[0] && response.data[0].embedding,
    response && response.embeddings && response.embeddings[0] && response.embeddings[0].embedding
  ]

  const vector = candidates.find(isValidVector)
  if (!vector) {
    throw new Error('DashScope returned invalid embedding vector')
  }
  return vector
}

async function requestMultimodalEmbedding({ apiKey, input, model = 'qwen3-vl-embedding', baseUrl = 'https://dashscope.aliyuncs.com/api/v1/services/embeddings/multimodal-embedding/multimodal-embedding', timeoutMs = 60000 }) {
  const normalizedApiKey = normalizeText(apiKey || process.env.DASHSCOPE_API_KEY)
  if (!normalizedApiKey || normalizedApiKey.includes('REPLACE_WITH')) {
    throw new Error('DASHSCOPE_API_KEY is required')
  }

  const response = await requestJson({
    url: baseUrl,
    timeoutMs,
    headers: {
      Authorization: `Bearer ${normalizedApiKey}`
    },
    body: {
      model,
      input
    }
  })

  return extractEmbeddingVector(response)
}

async function createImageEmbedding({ imageUrl, apiKey, model, timeoutMs } = {}) {
  const normalizedImageUrl = normalizeText(imageUrl)
  if (!normalizedImageUrl) {
    throw new Error('imageUrl is required')
  }

  return requestMultimodalEmbedding({
    apiKey,
    model,
    timeoutMs,
    input: {
      contents: [
        { image: normalizedImageUrl }
      ]
    }
  })
}

async function createTextEmbedding({ text, apiKey, model, timeoutMs } = {}) {
  const normalizedText = normalizeText(text)
  if (!normalizedText) {
    throw new Error('text is required')
  }

  return requestMultimodalEmbedding({
    apiKey,
    model,
    timeoutMs,
    input: {
      contents: [
        { text: normalizedText }
      ]
    }
  })
}

function extractJsonObject(text) {
  const normalizedText = normalizeText(text)
  if (!normalizedText) return null
  const direct = parseJsonMaybe(normalizedText)
  if (direct) return direct
  const matched = normalizedText.match(/\{[\s\S]*\}/)
  return matched ? parseJsonMaybe(matched[0]) : null
}

async function requestCompatibleChat({ apiKey, baseUrl = 'https://dashscope.aliyuncs.com/compatible-mode/v1', model = 'qwen-vl-plus', messages, timeoutMs = 60000 }) {
  const normalizedApiKey = normalizeText(apiKey || process.env.DASHSCOPE_API_KEY)
  if (!normalizedApiKey || normalizedApiKey.includes('REPLACE_WITH')) {
    throw new Error('DASHSCOPE_API_KEY is required')
  }

  const response = await requestJson({
    url: `${baseUrl.replace(/\/$/, '')}/chat/completions`,
    timeoutMs,
    headers: {
      Authorization: `Bearer ${normalizedApiKey}`
    },
    body: {
      model,
      messages,
      temperature: 0.3,
      response_format: { type: 'json_object' }
    }
  })

  const content = response && response.choices && response.choices[0] && response.choices[0].message && response.choices[0].message.content
  const parsed = typeof content === 'string' ? extractJsonObject(content) : content
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('model returned invalid json')
  }
  return parsed
}

module.exports = {
  createImageEmbedding,
  createTextEmbedding,
  requestMultimodalEmbedding,
  requestCompatibleChat,
  extractJsonObject
}
