const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

// 从用户行为记录中兼容提取帖子ID，支持新旧字段
function getActionPostId(record = {}) {
  return record.postId || record.post_id || record.postID || record.post || record.id || ''
}

// 获取行为记录时间，用于合并新旧记录后的倒序展示
function getActionTime(record = {}) {
  const time = record.createTime || record.created_at
  if (!time) {
    return 0
  }

  const date = time instanceof Date ? time : new Date(time)
  return Number.isFinite(date.getTime()) ? date.getTime() : 0
}

// 生成行为记录摘要，方便前端定位脏数据
function summarizeActionRecord(record = {}) {
  return {
    _id: record._id,
    postId: record.postId,
    post_id: record.post_id,
    postID: record.postID,
    post: record.post,
    id: record.id,
    openid: record.openid,
    userOpenid: record.userOpenid,
    _openid: record._openid,
    user_id: record.user_id,
    type: record.type,
    comment_id: record.comment_id
  }
}

// 将帖子数据库记录整理成页面卡片可用的数据结构
function formatPostItem(item = {}, state = {}) {
  let dateStr = '刚刚'
  if (item.createTime) {
    const rawDate = item.createTime instanceof Date
      ? item.createTime
      : new Date(item.createTime)
    const m = String(rawDate.getMonth() + 1).padStart(2, '0')
    const d = String(rawDate.getDate()).padStart(2, '0')
    dateStr = `${rawDate.getFullYear()}-${m}-${d}`
  }

  return {
    id: item._id,
    image: item.image || item.coverImage || (item.images && item.images.length > 0 ? item.images[0] : ''),
    images: item.images || (item.image ? [item.image] : []),
    title: item.title || '分享穿搭',
    time: dateStr,
    likes: item.likes || item.likeCount || 0,
    collects: item.collects || item.collectCount || 0,
    liked: !!state.liked,
    collected: !!state.collected
  }
}

// 根据帖子ID批量读取帖子，云函数端读取可避免小程序端数据库权限限制
async function loadPostsByIds(postIds = []) {
  if (postIds.length === 0) {
    return []
  }

  const postList = []
  for (let index = 0; index < postIds.length; index += 20) {
    const batchIds = postIds.slice(index, index + 20)
    const postRes = await db.collection('posts')
      .where({
        _id: _.in(batchIds)
      })
      .get()
    postList.push(...(postRes.data || []))
  }

  return postList
}

// 按用户行为记录查询关联帖子，并返回缺失帖子 warning
async function loadPostsByActionRecords(collectionName, identity, state = {}) {
  const queryGroups = [
    { openid: identity.openid },
    { userOpenid: identity.openid },
    { _openid: identity.openid }
  ]

  if (identity.userId) {
    queryGroups.push({ user_id: identity.userId })
  }

  const recordMap = {}
  for (const query of queryGroups) {
    const actionRes = await db.collection(collectionName)
      .where(query)
      .limit(100)
      .get()

    ;(actionRes.data || []).forEach(record => {
      const postId = getActionPostId(record)

      // likes 集合里也有评论点赞记录，这里只保留帖子点赞
      if (collectionName === 'likes' && (!postId || record.type === 'comment' || record.comment_id)) {
        return
      }

      if (!postId) {
        return
      }

      const previous = recordMap[postId]
      if (!previous || getActionTime(record) > getActionTime(previous)) {
        recordMap[postId] = record
      }
    })
  }

  const records = Object.values(recordMap)
    .sort((a, b) => getActionTime(b) - getActionTime(a))
  const postIds = records.map(item => getActionPostId(item)).filter(Boolean)
  const posts = await loadPostsByIds(postIds)
  const postMap = {}
  posts.forEach(post => {
    postMap[post._id] = post
  })

  const missingPostIds = postIds.filter(postId => !postMap[postId])
  const warnings = []
  if (missingPostIds.length > 0) {
    const missingRecords = records
      .filter(record => missingPostIds.includes(getActionPostId(record)))
      .map(record => summarizeActionRecord(record))

    warnings.push({
      type: 'missingActionPosts',
      collectionName,
      missingPostIds,
      missingRecords
    })
  }

  return {
    posts: postIds
      .map(postId => postMap[postId])
      .filter(Boolean)
      .map(post => formatPostItem(post, state)),
    warnings
  }
}

exports.main = async (event, context) => {
  try {
    const wxContext = cloud.getWXContext()
    const openid = wxContext.OPENID

    const userRes = await db.collection('users')
      .where({ _openid: openid })
      .limit(1)
      .get()

    const userId = userRes.data[0] && userRes.data[0]._id
    if (!userId) {
      return {
        code: 404,
        message: '当前用户不存在'
      }
    }

    const myPostsRes = await db.collection('posts')
      .where(
        _.or([
          { userId },
          { author_id: userId },
          { authorOpenid: openid },
          { _openid: openid }
        ])
      )
      .orderBy('createTime', 'desc')
      .get()

    const identity = { userId, openid }
    const collectedResult = await loadPostsByActionRecords('user_collections', identity, {
      liked: false,
      collected: true
    })
    const likedResult = await loadPostsByActionRecords('likes', identity, {
      liked: true,
      collected: false
    })

    return {
      code: 200,
      data: {
        myPosts: (myPostsRes.data || []).map(post => formatPostItem(post)),
        collectedPosts: collectedResult.posts,
        likedPosts: likedResult.posts,
        warnings: [
          ...collectedResult.warnings,
          ...likedResult.warnings
        ]
      }
    }
  } catch (error) {
    console.error('getMyPostTabs失败:', error)
    return {
      code: 500,
      message: '获取我的帖子分栏失败',
      error: error.message
    }
  }
}
