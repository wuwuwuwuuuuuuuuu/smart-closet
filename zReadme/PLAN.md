# 图片知识库增强版实施方案（保存至 `zReadme/效率优化/图片知识库增强版实施方案.md`）

## 1. 问题复述与当前项目判断

当前第一版智能推荐已经把 `pages/daily` 改造成“智能推荐”入口，并具备天气提醒、对话输入、推荐结果卡片、跳转试穿页等前端流程。但下一阶段目标不是继续强化“文字知识文档”，而是把用户衣橱从“衣物文字档案检索”升级为“图片可理解、图片可检索、图片参与推荐”的知识库。

结合当前代码，关键问题是：

- `pages/daily/daily.js` 已调用 `smartRecommendPhoto`，但 `cloudfunctions/smartRecommendPhoto` 当前只有 `config.local.js`，缺少 `index.js`，实际云函数不可完整运行。
- `cloudfunctions/rebuildUserKnowledgeBase` 也只有 `config.local.js`，缺少 `index.js`。
- 现有百炼知识库 provider 主要在 `cloudfunctions/deleteClothing/utils/bailian-provider.js`，其核心逻辑是把衣物生成 Markdown 文档后上传知识库，本质仍是“文字知识库”。
- 衣物图片字段已有基础：`clothes.image` 保存抠图或原图 `cloud://`，`clothingInfo` 保存时也传了 `originalImage`，但 `addClothing/index.js` 当前没有落库 `originalImage`，导致后续图片知识库缺少稳定原图来源。
- `pages/tryon/tryon.js` 已有智能推荐入口字段，但 helpers 被注释，`applySmartRecommendEntryIfNeeded` 目前没有真正匹配推荐衣物，推荐到试穿链路不完整。
- 阿里云百炼官方文档显示，图片问答/图搜图类知识库需要图片 URL 字段，且图片问答类知识库使用多模态向量模型；因此本项目第二版更适合先做“项目内图片向量知识库 + 多模态模型复核”，减少对 Markdown 文档的依赖，再保留百炼文档知识库作为 fallback。

参考官方资料：
- 百炼知识库类型与图片问答说明：https://www.alibabacloud.com/help/zh/doc-detail/2786870.html
- 百炼知识库配额、图片格式、多模态向量模型说明：https://www.alibabacloud.com/help/zh/doc-detail/2880605.html

---

## 2. 总体代码修改方案

采用“图片向量知识库优先，文字知识库降级 fallback”的方案：

1. 上传/保存衣物时补齐图片字段：
   - 保存 `originalImage`
   - 保存 `image_knowledge_status`
   - 保存 `image_embedding_status`
   - 保存 `image_embedding_updated_at`

2. 新增图片知识库重建云函数能力：
   - 读取用户衣橱图片
   - 将 `cloud://` 转为临时 URL
   - 调用 DashScope `multimodal-embedding-v1`
   - 将图片向量写入新集合 `clothes_image_vectors`
   - 不再依赖 Markdown 文档作为主检索入口

3. 新增智能推荐图片检索能力：
   - 用户输入文本 → 生成文本向量
   - 与衣物图片向量做 cosine similarity
   - TopK 衣物图片进入推荐候选
   - 再调用多模态模型，根据图片 + 天气 + 用户需求生成推荐结果

4. 前端保持现有架构：
   - `pages/daily` 继续调用 `smartRecommendPhoto`
   - 推荐结果返回 `selectedClothesIds`
   - `pages/tryon` 根据 `selectedClothesIds` 自动摆放衣物

5. 日志要求：
   - 计算错误用 `logError`
   - 数据缺失、图片不可用、向量异常用 `logWarning`
   - 正常流程不输出大量调试日志

---

# 子任务 1：补齐衣物图片字段与图片知识库状态字段

## 1. 任务目标

让每件衣物都具备进入图片知识库的最小数据基础，避免后续图片检索只能依赖 `image` 字段猜测。

## 2. 实现方案

修改 `cloudfunctions/addClothing/index.js`，把前端已传入的 `originalImage` 落库，并新增图片知识库状态字段。

计划代码块：

```js
const {
  name,
  image,
  originalImage,
  season,
  category,
  tags,
  material,
  brand
} = event

const primaryImage = image || originalImage || ''

const result = await db.collection('clothes').add({
  data: {
    _openid: openid,
    user_id: userId,
    name: name || '未命名衣物',
    image: primaryImage,
    originalImage: originalImage || primaryImage,
    season: season || '未知',
    category: category || '其他',
    tags: Array.isArray(tags) ? tags : [],
    material: material || '',
    brand: brand || '',
    image_knowledge_status: primaryImage ? 'pending' : 'skipped_no_image',
    image_embedding_status: primaryImage ? 'pending' : 'skipped_no_image',
    image_embedding_error: '',
    image_embedding_updated_at: null,
    created_at: db.serverDate(),
    updated_at: db.serverDate()
  }
})
```

如修改衣物信息，也应在 `cloudfunctions/updateClothing/index.js` 中同步更新状态：

```js
const imageChanged = image && image !== clothingInfo.data[0].image

const updateData = {
  name: name || clothingInfo.data[0].name,
  image: image || clothingInfo.data[0].image,
  originalImage: originalImage || clothingInfo.data[0].originalImage || image || clothingInfo.data[0].image,
  season: season || clothingInfo.data[0].season,
  category: category || clothingInfo.data[0].category,
  tags: Array.isArray(tags) ? tags : clothingInfo.data[0].tags,
  material: material || clothingInfo.data[0].material,
  brand: brand || clothingInfo.data[0].brand,
  updated_at: db.serverDate()
}

if (imageChanged) {
  updateData.image_embedding_status = 'pending'
  updateData.image_knowledge_status = 'pending'
  updateData.image_embedding_error = ''
  updateData.image_embedding_updated_at = null
}
```

## 3. 计算、异常、日志、单测

需要判断：

- `image || originalImage` 是否为空。
- `tags` 是否为数组。
- 图片为空时不能进入 pending，应为 `skipped_no_image`。

新增纯函数文件：

`cloudfunctions/common/clothing-image-fields.js`

```js
function buildImageKnowledgeFields({ image, originalImage, previousImage } = {}) {
  const primaryImage = typeof image === 'string' && image.trim()
    ? image.trim()
    : typeof originalImage === 'string' && originalImage.trim()
      ? originalImage.trim()
      : ''

  const imageChanged = Boolean(previousImage && primaryImage && previousImage !== primaryImage)

  return {
    primaryImage,
    originalImage: originalImage || primaryImage,
    imageChanged,
    status: primaryImage ? 'pending' : 'skipped_no_image'
  }
}

module.exports = { buildImageKnowledgeFields }
```

新增测试：

`tests/knowledge/clothing-image-fields.test.js`

```js
const assert = require('assert')
const { buildImageKnowledgeFields } = require('../../cloudfunctions/common/clothing-image-fields')

let result = buildImageKnowledgeFields({ image: ' cloud://a ', originalImage: 'cloud://raw' })
assert.strictEqual(result.primaryImage, 'cloud://a')
assert.strictEqual(result.status, 'pending')

result = buildImageKnowledgeFields({})
assert.strictEqual(result.primaryImage, '')
assert.strictEqual(result.status, 'skipped_no_image')

result = buildImageKnowledgeFields({ image: 'cloud://b', previousImage: 'cloud://a' })
assert.strictEqual(result.imageChanged, true)

console.log('clothing-image-fields.test.js passed')
```

## 4. 验证方法

- 新上传衣物后，数据库 `clothes` 中应出现：
  - `originalImage`
  - `image_knowledge_status`
  - `image_embedding_status`
- 无图片衣物状态为 `skipped_no_image`。
- 执行：
  - `node tests/knowledge/clothing-image-fields.test.js`

## 5. 迭代原则

只增强现有衣物数据结构，不改上传页面主流程，不新建衣物上传架构。

---

# 子任务 2：新增图片向量知识库工具层

## 1. 任务目标

建立项目内图片知识库的核心计算能力：图片/文本向量生成、向量合法性校验、相似度计算、TopK 检索。

## 2. 实现方案

新增：

```text
cloudfunctions/common/image-vector-utils.js
cloudfunctions/common/dashscope-multimodal-provider.js
```

`image-vector-utils.js` 计划代码：

```js
function isValidVector(vector) {
  return Array.isArray(vector)
    && vector.length > 0
    && vector.every(item => typeof item === 'number' && Number.isFinite(item))
}

function cosineSimilarity(a, b) {
  if (!isValidVector(a) || !isValidVector(b) || a.length !== b.length) {
    throw new Error('invalid vector for cosine similarity')
  }

  let dot = 0
  let normA = 0
  let normB = 0

  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }

  if (normA === 0 || normB === 0) {
    throw new Error('zero norm vector')
  }

  return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}

function pickTopKBySimilarity({ queryVector, items = [], topK = 8 }) {
  if (!isValidVector(queryVector)) {
    throw new Error('invalid query vector')
  }

  return items
    .filter(item => isValidVector(item.vector) && item.vector.length === queryVector.length)
    .map(item => ({
      ...item,
      score: cosineSimilarity(queryVector, item.vector)
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
}

module.exports = {
  isValidVector,
  cosineSimilarity,
  pickTopKBySimilarity
}
```

`dashscope-multimodal-provider.js` 计划接口：

```js
async function createImageEmbedding({ imageUrl, apiKey }) {
  if (!imageUrl) {
    throw new Error('imageUrl is required')
  }

  return requestMultimodalEmbedding({
    apiKey,
    input: {
      contents: [
        {
          image: imageUrl
        }
      ]
    }
  })
}

async function createTextEmbedding({ text, apiKey }) {
  if (!text || !text.trim()) {
    throw new Error('text is required')
  }

  return requestMultimodalEmbedding({
    apiKey,
    input: {
      contents: [
        {
          text: text.trim()
        }
      ]
    }
  })
}
```

`requestMultimodalEmbedding` 使用 `multimodal-embedding-v1`，从 `config.local.js` 或环境变量读取 `DASHSCOPE_API_KEY`。

## 3. 计算、异常、日志、单测

必须验证：

- 向量维度一致。
- 向量不能为空。
- norm 不能为 0。
- TopK 排序必须按分数降序。

新增测试：

`tests/knowledge/image-vector-utils.test.js`

```js
const assert = require('assert')
const {
  cosineSimilarity,
  pickTopKBySimilarity
} = require('../../cloudfunctions/common/image-vector-utils')

assert.strictEqual(cosineSimilarity([1, 0], [1, 0]), 1)
assert.strictEqual(cosineSimilarity([1, 0], [0, 1]), 0)

const top = pickTopKBySimilarity({
  queryVector: [1, 0],
  items: [
    { id: 'a', vector: [0, 1] },
    { id: 'b', vector: [1, 0] }
  ],
  topK: 1
})

assert.strictEqual(top[0].id, 'b')

assert.throws(() => cosineSimilarity([], [1]))
assert.throws(() => cosineSimilarity([0, 0], [1, 0]))

console.log('image-vector-utils.test.js passed')
```

异常日志要求：

- DashScope 调用失败：`logError('imageEmbedding.request', error)`
- 图片 URL 缺失：`logWarning('imageEmbedding.input', 'missing imageUrl')`
- 向量维度不一致：`logWarning('imageVector.similarity', 'vector dimension mismatch')`

## 4. 验证方法

- `node tests/knowledge/image-vector-utils.test.js` 通过。
- 手动传入两个简单向量，余弦相似度结果符合预期。
- DashScope 调用失败时只输出错误日志，不刷屏。

## 5. 迭代原则

不替换现有百炼 Markdown provider，只新增图片向量工具层，后续云函数逐步接入。

---

# 子任务 3：实现 `rebuildUserKnowledgeBase` 图片知识库重建

## 1. 任务目标

让“补同步/强制全量重同步”从重建文字文档，升级为优先重建图片向量知识库。

## 2. 实现方案

补齐：

```text
cloudfunctions/rebuildUserKnowledgeBase/index.js
```

核心流程：

1. 获取当前用户 openid。
2. 找到用户记录。
3. 查询 `clothes`：
   - `user_id = userId`
   - 有 `image` 或 `originalImage`
   - `image_embedding_status in ['pending', 'failed']`
   - 如果 `forceResync=true`，则全量重建。
4. 批量调用 `wx.cloud.getTempFileURL` 把 `cloud://` 转为临时 HTTPS。
5. 调用 `createImageEmbedding`。
6. 写入集合 `clothes_image_vectors`。
7. 回写 `clothes.image_embedding_status = ready`。

计划代码骨架：

```js
exports.main = async (event) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  const { limit = 30, forceResync = false } = event || {}

  try {
    const user = await getCurrentUser(openid)
    if (!user) {
      return { code: 404, message: '用户不存在' }
    }

    const clothes = await loadSyncableClothes({
      userId: user._id,
      limit,
      forceResync
    })

    const stats = {
      total: clothes.length,
      readyCount: 0,
      failedCount: 0,
      skippedCount: 0,
      sampleFailures: []
    }

    for (const clothing of clothes) {
      try {
        const imageFileId = clothing.image || clothing.originalImage
        if (!imageFileId) {
          stats.skippedCount += 1
          await markClothingSkipped(clothing._id, 'missing_image')
          continue
        }

        const imageUrl = await getTempUrl(imageFileId)
        const vector = await createImageEmbedding({ imageUrl, apiKey: getDashScopeApiKey() })

        await db.collection('clothes_image_vectors').where({
          clothing_id: clothing._id,
          user_id: user._id
        }).remove().catch(() => null)

        await db.collection('clothes_image_vectors').add({
          data: {
            _openid: openid,
            user_id: user._id,
            clothing_id: clothing._id,
            image_file_id: imageFileId,
            image_temp_url_sample: imageUrl,
            vector,
            vector_dim: vector.length,
            category: clothing.category || '',
            season: clothing.season || '',
            tags: Array.isArray(clothing.tags) ? clothing.tags : [],
            updated_at: db.serverDate()
          }
        })

        await markClothingReady(clothing._id, vector.length)
        stats.readyCount += 1
      } catch (error) {
        stats.failedCount += 1
        stats.sampleFailures.push({
          clothingId: clothing._id,
          error: error.message
        })
        await markClothingFailed(clothing._id, error)
      }
    }

    return {
      code: 200,
      message: '图片知识库重建完成',
      data: stats
    }
  } catch (error) {
    return {
      code: 500,
      message: '图片知识库重建失败',
      error: error.message
    }
  }
}
```

## 3. 计算、异常、日志、单测

需要判断：

- `limit` 必须为 1-100。
- 图片 URL 获取失败要标记 failed。
- embedding 返回向量必须合法。
- vector 维度必须稳定，建议记录 `vector_dim`。

新增测试：

`tests/knowledge/rebuild-summary.test.js`

测试统计结果聚合函数：

```js
const assert = require('assert')
const { buildRebuildStatsSummary } = require('../../cloudfunctions/rebuildUserKnowledgeBase/rebuild.helpers')

const summary = buildRebuildStatsSummary({
  total: 3,
  readyCount: 2,
  failedCount: 1,
  skippedCount: 0
})

assert.strictEqual(summary.status, 'partial_success')
assert.ok(summary.text.includes('成功 2 件'))
assert.ok(summary.text.includes('失败 1 件'))

console.log('rebuild-summary.test.js passed')
```

日志要求：

- 单件衣物 embedding 失败：`logWarning('rebuild.imageEmbedding.itemFailed', ...)`
- 整体云函数异常：`logError('rebuild.imageEmbedding.main', error)`
- 不输出每件成功日志。

## 4. 验证方法

前端点击 `补同步/查状态` 后：

- 返回 `图片知识库重建完成`。
- `clothes_image_vectors` 集合新增向量记录。
- `clothes.image_embedding_status` 变为 `ready`。
- 失败样本数量合理，且错误信息可读。

## 5. 迭代原则

复用现有 `pages/daily` 的补同步入口，不新增页面，不改变用户操作路径。

---

# 子任务 4：实现 `smartRecommendPhoto` 图片检索优先推荐

## 1. 任务目标

让智能推荐不再主要依赖 Markdown 知识文档，而是优先用用户输入文本检索图片向量知识库，再结合候选衣物图片生成推荐。

## 2. 实现方案

补齐：

```text
cloudfunctions/smartRecommendPhoto/index.js
```

核心流程：

1. 接收 `userQuery / weatherInfo / city / occasion`。
2. 生成文本向量。
3. 查询当前用户 `clothes_image_vectors`。
4. 余弦相似度 TopK。
5. 读取对应 `clothes` 详情。
6. 将 TopK 图片 URL + 衣物元数据交给多模态模型生成推荐。
7. 返回前端兼容结构：
   - `summary`
   - `replyText`
   - `selectedClothesIds`
   - `selectedPhotoUrls`
   - `outfitLines`
   - `tips`
   - `retrievalSource: 'image_vector'`
   - `retrievalHitCount`

计划代码骨架：

```js
exports.main = async (event) => {
  try {
    const wxContext = cloud.getWXContext()
    const openid = wxContext.OPENID

    const userQuery = normalizeInput(event.userQuery)
    if (!userQuery) {
      return { code: 400, message: 'userQuery is required' }
    }

    const user = await getCurrentUser(openid)
    if (!user) {
      return { code: 404, message: '用户不存在' }
    }

    const queryVector = await createTextEmbedding({
      text: buildRetrievalQuery(event),
      apiKey: getDashScopeApiKey()
    })

    const vectorDocs = await loadUserImageVectors(user._id)
    const topHits = pickTopKBySimilarity({
      queryVector,
      items: vectorDocs.map(doc => ({
        id: doc.clothing_id,
        vector: doc.vector,
        imageFileId: doc.image_file_id,
        category: doc.category,
        season: doc.season,
        tags: doc.tags
      })),
      topK: 8
    })

    if (!topHits.length) {
      return buildFallbackRecommendation(event, 'no_image_vector_hits')
    }

    const clothes = await loadClothesByIds(topHits.map(item => item.id))
    const recommendation = await buildMultimodalRecommendation({
      userQuery,
      weatherInfo: event.weatherInfo,
      city: event.city,
      hits: mergeHitsWithClothes(topHits, clothes)
    })

    return {
      code: 200,
      data: {
        ...recommendation,
        selectedClothesIds: recommendation.selectedClothesIds,
        selectedPhotoUrls: recommendation.selectedPhotoUrls,
        retrievalSource: 'image_vector',
        retrievalHitCount: topHits.length
      }
    }
  } catch (error) {
    return {
      code: 500,
      message: '图片推荐失败',
      error: error.message
    }
  }
}
```

多模态推荐 prompt 应明确：

```js
function buildRecommendationPrompt({ userQuery, weatherInfo, city, hits }) {
  return [
    `你是智能衣橱穿搭助手。`,
    `用户需求：${userQuery}`,
    `城市：${city || '未知'}`,
    `天气：${weatherInfo && weatherInfo.text || '未知'}，温度：${weatherInfo && weatherInfo.temp || '未知'}`,
    `请只从候选衣物中选择 2-4 件组成搭配。`,
    `必须返回 JSON，不要返回 Markdown。`,
    `JSON 字段：summary, replyText, selectedClothesIds, outfitLines, tips。`,
    `候选衣物：${JSON.stringify(hits.map(item => ({
      id: item.id,
      name: item.name,
      category: item.category,
      season: item.season,
      tags: item.tags,
      score: item.score
    })))}`
  ].join('\n')
}
```

## 3. 计算、异常、日志、单测

需要判断：

- `userQuery` 为空直接 400。
- 文本向量非法要报错。
- 用户没有图片向量时 fallback。
- TopK 命中为空时 fallback。
- 模型返回 JSON 解析失败时 fallback，并记录 `logWarning`。

新增测试：

`tests/knowledge/retrieval-ranking.test.js`

```js
const assert = require('assert')
const { pickTopKBySimilarity } = require('../../cloudfunctions/common/image-vector-utils')

const hits = pickTopKBySimilarity({
  queryVector: [1, 0],
  items: [
    { id: 'coat', vector: [0.8, 0.2] },
    { id: 'shoe', vector: [0.1, 0.9] },
    { id: 'shirt', vector: [0.9, 0.1] }
  ],
  topK: 2
})

assert.deepStrictEqual(hits.map(item => item.id), ['shirt', 'coat'])

console.log('retrieval-ranking.test.js passed')
```

日志要求：

- 无图片向量：`logWarning('recommend.imageRetrieval', 'no image vectors found')`
- JSON 解析失败：`logWarning('recommend.modelJson', 'invalid model json')`
- 主流程失败：`logError('recommend.main', error)`

## 4. 验证方法

在智能推荐页输入：

> 明天通勤，想穿得清爽一点

正常结果应满足：

- 返回 `retrievalSource = image_vector`
- `retrievalHitCount > 0`
- `selectedClothesIds.length > 0`
- 点击结果卡片可跳转试穿页

## 5. 迭代原则

保持前端调用 `smartRecommendPhoto` 不变，只升级云函数内部推荐策略。

---

# 子任务 5：修复推荐结果到试穿页的衣物自动摆放

## 1. 任务目标

让图片知识库推荐出来的 `selectedClothesIds` 能在试穿页真正匹配衣物并自动放入画板。

## 2. 实现方案

恢复 `pages/tryon/tryon.js` 对 helpers 的引用：

```js
const { logError, logWarning } = require('../../utils/logger')
const {
  matchSelectedClothes,
  buildSuggestedPlacements,
  isValidSmartRecommendEntry
} = require('./tryon.helpers')
```

修改 `consumePendingSmartRecommendEntry`：

```js
consumePendingSmartRecommendEntry() {
  try {
    const entry = wx.getStorageSync('smartRecommendTryonEntry')
    if (!isValidSmartRecommendEntry(entry) || entry.active !== true) {
      this.setData({ smartRecommendEntry: null })
      return null
    }

    wx.setStorageSync('smartRecommendTryonEntry', {
      ...entry,
      active: false
    })

    this.setData({ smartRecommendEntry: entry })
    return entry
  } catch (error) {
    logError('tryon.consumePendingSmartRecommendEntry', error)
    return null
  }
}
```

修复 `applySmartRecommendEntryIfNeeded`：

```js
applySmartRecommendEntryIfNeeded(clothesList) {
  const entry = this.pendingSmartRecommendEntry
  if (!entry) {
    return
  }

  const matchedClothes = matchSelectedClothes(entry.selectedClothesIds, clothesList)

  if (!matchedClothes.length) {
    logWarning('tryon.applySmartRecommendEntryIfNeeded', 'no recommended clothes matched current wardrobe', {
      selectedClothesIds: entry.selectedClothesIds
    })
    this.pendingSmartRecommendEntry = null
    return
  }

  const placedClothes = buildSuggestedPlacements(matchedClothes).map(item => ({
    ...item,
    boardId: `recommend_${item._id}_${Date.now()}`
  }))

  this.setData({
    smartRecommendEntry: entry,
    selectedClothes: placedClothes
  })

  this.pendingSmartRecommendEntry = null
}
```

## 3. 计算、异常、日志、单测

已有 `pages/tryon/tryon.helpers.js` 可复用，但需要补充测试：

`tests/tryon/recommendation-placement.test.js`

```js
const assert = require('assert')
const {
  matchSelectedClothes,
  buildSuggestedPlacements
} = require('../../pages/tryon/tryon.helpers')

const clothes = [
  { _id: 'a', name: '白衬衫' },
  { _id: 'b', name: '牛仔裤' }
]

const matched = matchSelectedClothes(['b', 'a', 'b'], clothes)
assert.deepStrictEqual(matched.map(item => item._id), ['b', 'a'])

const placed = buildSuggestedPlacements(matched)
assert.strictEqual(typeof placed[0].x, 'number')
assert.strictEqual(typeof placed[0].y, 'number')

console.log('recommendation-placement.test.js passed')
```

## 4. 验证方法

- 智能推荐结果点击箭头后进入试穿页。
- 推荐衣物自动出现在画板中。
- 如果推荐 ID 不存在，只输出 warning，不崩溃。

## 5. 迭代原则

不重做试穿页，只修复现有推荐入口适配层。

---

# 子任务 6：前端展示图片知识库状态与降级提示

## 1. 任务目标

让用户和开发者能判断当前推荐是否来自图片知识库，尤其要验证“获取数据”和“输出数据”是否正常。

## 2. 实现方案

修改 `pages/daily/daily.helpers.js` 的 `normalizeRecommendationResult`，保留图片知识库字段：

```js
return {
  requestId: normalizeInput(raw.requestId) || `rec_${Date.now()}`,
  summary: normalizeInput(raw.summary) || '已根据你的需求生成智能推荐。',
  replyText: normalizeInput(raw.replyText),
  selectedClothesIds: uniqueStringList(raw.selectedClothesIds),
  selectedPhotoUrls: uniqueStringList(raw.selectedPhotoUrls),
  outfitLines: Array.isArray(raw.outfitLines) ? raw.outfitLines.map(normalizeInput).filter(Boolean) : [],
  tips: Array.isArray(raw.tips) ? raw.tips.map(normalizeInput).filter(Boolean) : [],
  ctaLabel: normalizeInput(raw.ctaLabel) || '去试穿页继续搭配',
  retrievalSource: normalizeInput(raw.retrievalSource) || 'unknown',
  retrievalHitCount: Number(raw.retrievalHitCount) || 0,
  fallbackReason: normalizeInput(raw.fallbackReason)
}
```

在 `pages/daily/daily.wxml` 结果卡片中增加轻量状态：

```xml
<text class="retrieval-source" wx:if="{{item.data.retrievalSource}}">
  来源：{{item.data.retrievalSource}} · 命中 {{item.data.retrievalHitCount}} 件
</text>
```

样式：

```css
.retrieval-source {
  margin-top: 12rpx;
  font-size: 22rpx;
  color: #8a8a8a;
}
```

## 3. 计算、异常、日志、单测

新增测试：

`tests/daily/image-recommend-result.test.js`

```js
const assert = require('assert')
const { normalizeRecommendationResult } = require('../../pages/daily/daily.helpers')

const result = normalizeRecommendationResult({
  selectedClothesIds: ['a', 'a', 'b'],
  retrievalSource: 'image_vector',
  retrievalHitCount: 5
})

assert.deepStrictEqual(result.selectedClothesIds, ['a', 'b'])
assert.strictEqual(result.retrievalSource, 'image_vector')
assert.strictEqual(result.retrievalHitCount, 5)

console.log('image-recommend-result.test.js passed')
```

## 4. 验证方法

推荐结果卡片显示：

```text
来源：image_vector · 命中 5 件
```

异常时可能显示：

```text
来源：fallback · 命中 0 件
```

## 5. 迭代原则

只增强现有结果卡片，不改变推荐页整体 UI。

---

## 3. 总体验收测试

完成全部子任务后，至少执行：

```bash
node tests/knowledge/clothing-image-fields.test.js
node tests/knowledge/image-vector-utils.test.js
node tests/knowledge/retrieval-ranking.test.js
node tests/tryon/recommendation-placement.test.js
node tests/daily/image-recommend-result.test.js
```

真机/开发者工具验证：

1. 上传一件新衣物。
2. 数据库 `clothes` 出现图片知识库状态字段。
3. 在智能推荐页点击“补同步/查状态”。
4. `clothes_image_vectors` 出现向量记录。
5. 输入穿搭需求。
6. 推荐结果显示 `来源：image_vector`。
7. 点击推荐卡片箭头进入试穿页。
8. 推荐衣物自动出现在试穿画板。

---

## 4. 默认假设

- 第二版优先采用“项目内图片向量知识库”，不直接强依赖百炼图片问答知识库的数据表能力。
- 现有 Markdown 文档知识库保留为 fallback，不在本轮删除。
- DashScope API Key 继续从云函数 `config.local.js` 或环境变量读取。
- 当前用户衣橱规模较小，云函数内 JS 余弦 TopK 检索足够；未来衣物规模明显增长后再迁移到专用向量数据库或百炼图片问答知识库。
