const assert = require('assert')
const {
  normalizeKnowledgeStatus,
  buildKnowledgeBaseName,
  extractKnowledgeBinding,
  ensureUserKnowledgeBinding
} = require('../../cloudfunctions/smartRecommendPhoto/utils/knowledge-binding')

function createMockDb(initialUsers = []) {
  const users = initialUsers.map(item => ({ ...item }))

  return {
    serverDate() {
      return { $date: 'serverDate' }
    },
    collection(name) {
      if (name !== 'users') {
        throw new Error(`unsupported collection: ${name}`)
      }

      return {
        where(query) {
          return {
            orderBy() {
              return {
                async get() {
                  return {
                    data: users.filter(user => user._openid === query._openid)
                  }
                }
              }
            }
          }
        },
        doc(id) {
          return {
            async update({ data }) {
              const target = users.find(user => user._id === id)
              if (!target) {
                throw new Error('user not found')
              }
              Object.assign(target, data)
              return { stats: { updated: 1 } }
            }
          }
        }
      }
    },
    getUsers() {
      return users
    }
  }
}

assert.strictEqual(normalizeKnowledgeStatus('ready'), 'ready')
assert.strictEqual(normalizeKnowledgeStatus(' failed '), 'failed')
assert.strictEqual(normalizeKnowledgeStatus('abc'), 'unbound')

assert.strictEqual(
  buildKnowledgeBaseName({ _id: 'u_1', nickName: 'Alice' }),
  'sc_Alice'
)
assert.strictEqual(
  buildKnowledgeBaseName({ _id: 'u_2-abc' }),
  'sc_u_2abc'
)

assert.deepStrictEqual(
  extractKnowledgeBinding({
    bailian_knowledge_id: ' kb_1 ',
    bailian_knowledge_status: ' ready ',
    knowledge_provider: ' bailian '
  }),
  {
    knowledgeId: 'kb_1',
    knowledgeStatus: 'ready',
    knowledgeProvider: 'bailian',
    hasReadyKnowledge: true
  }
)

;(async () => {
  const readyDb = createMockDb([
    {
      _id: 'user_ready',
      _openid: 'openid_ready',
      bailian_knowledge_id: 'kb_ready',
      bailian_knowledge_status: 'ready',
      knowledge_provider: 'bailian'
    }
  ])

  const readyBinding = await ensureUserKnowledgeBinding({
    db: readyDb,
    openid: 'openid_ready',
    provider: {
      name: 'bailian',
      async knowledgeBaseExists() {
        return true
      },
      async createKnowledgeBase() {
        throw new Error('should not create when knowledge already ready')
      }
    }
  })

  assert.strictEqual(readyBinding.knowledgeId, 'kb_ready')
  assert.strictEqual(readyBinding.created, false)

  const staleDb = createMockDb([
    {
      _id: 'user_stale',
      _openid: 'openid_stale',
      bailian_knowledge_id: 'kb_stale',
      bailian_knowledge_status: 'ready',
      knowledge_provider: 'bailian'
    }
  ])

  const staleBinding = await ensureUserKnowledgeBinding({
    db: staleDb,
    openid: 'openid_stale',
    provider: {
      name: 'bailian',
      getProviderConfig() {
        return { workspaceId: 'ws_demo' }
      },
      async knowledgeBaseExists() {
        return false
      },
      async createKnowledgeBase() {
        return { id: 'kb_recreated_001' }
      }
    }
  })

  assert.strictEqual(staleBinding.knowledgeId, 'kb_recreated_001')
  assert.strictEqual(staleBinding.created, true)
  assert.strictEqual(staleDb.getUsers()[0].bailian_knowledge_id, 'kb_recreated_001')

  const restoredDb = createMockDb([
    {
      _id: 'user_restored',
      _openid: 'openid_restored',
      nickName: 'Alice',
      bailian_knowledge_id: 'kb_missing',
      bailian_knowledge_status: 'ready',
      knowledge_provider: 'bailian'
    }
  ])

  const restoredBinding = await ensureUserKnowledgeBinding({
    db: restoredDb,
    openid: 'openid_restored',
    provider: {
      name: 'bailian',
      getProviderConfig() {
        return { workspaceId: 'ws_demo' }
      },
      async knowledgeBaseExists() {
        return false
      },
      async findKnowledgeBaseByName(name) {
        assert.strictEqual(name, 'sc_Alice')
        return { id: 'kb_found_by_name' }
      },
      async createKnowledgeBase() {
        throw new Error('should not create when reusable knowledge exists')
      }
    }
  })

  assert.strictEqual(restoredBinding.knowledgeId, 'kb_found_by_name')
  assert.strictEqual(restoredBinding.created, false)
  assert.strictEqual(restoredDb.getUsers()[0].bailian_knowledge_id, 'kb_found_by_name')
  assert.strictEqual(restoredDb.getUsers()[0].bailian_knowledge_status, 'ready')

  const creatingDb = createMockDb([
    {
      _id: 'user_new',
      _openid: 'openid_new'
    }
  ])

  const createdBinding = await ensureUserKnowledgeBinding({
    db: creatingDb,
    openid: 'openid_new',
    provider: {
      name: 'bailian',
      getProviderConfig() {
        return { workspaceId: 'ws_demo' }
      },
      async createKnowledgeBase(payload) {
        assert.strictEqual(payload.name, 'sc_user_new')
        return { id: 'kb_new_001' }
      }
    }
  })

  assert.strictEqual(createdBinding.knowledgeId, 'kb_new_001')
  assert.strictEqual(createdBinding.knowledgeStatus, 'ready')
  assert.strictEqual(createdBinding.created, true)
  assert.strictEqual(creatingDb.getUsers()[0].bailian_knowledge_id, 'kb_new_001')
  assert.strictEqual(creatingDb.getUsers()[0].bailian_workspace_id, 'ws_demo')

  const failedDb = createMockDb([
    {
      _id: 'user_failed',
      _openid: 'openid_failed'
    }
  ])

  const originalError = console.error
  console.error = () => {}

  let failed = false
  try {
    await ensureUserKnowledgeBinding({
      db: failedDb,
      openid: 'openid_failed',
      provider: {
        name: 'bailian',
        async createKnowledgeBase() {
          throw new Error('create failed')
        }
      }
    })
  } catch (error) {
    failed = true
    assert.strictEqual(error.message, 'create failed')
  }

  console.error = originalError

  assert.strictEqual(failed, true)
  assert.strictEqual(failedDb.getUsers()[0].bailian_knowledge_status, 'failed')

  console.log('knowledge-binding.test.js passed')
})().catch(error => {
  console.error(error)
  process.exit(1)
})
