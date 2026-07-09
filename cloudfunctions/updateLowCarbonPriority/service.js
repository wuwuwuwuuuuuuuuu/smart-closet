function parseEnabled(event = {}) {
  if (event && typeof event.enabled === 'boolean') return { enabled: event.enabled }
  return {
    error: {
      code: 400,
      message: 'enabled必须是布尔值',
      data: { reason: 'INVALID_ENABLED' }
    }
  }
}

async function updateLowCarbonPriority({ gateway, openid, event = {} }) {
  if (!openid) return { code: 401, message: '未获取到可信用户身份', data: {} }
  const input = parseEnabled(event)
  if (input.error) return input.error

  const user = await gateway.findUser(openid)
  if (!user) return { code: 404, message: '用户不存在', data: {} }

  await gateway.updateUser(user._id, { lowCarbonPriority: input.enabled })
  return {
    code: 200,
    message: '设置已更新',
    data: {
      lowCarbonPriority: input.enabled
    }
  }
}

module.exports = {
  parseEnabled,
  updateLowCarbonPriority
}
