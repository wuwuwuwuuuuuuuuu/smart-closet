async function getLowCarbonPriority({ gateway, openid }) {
  if (!openid) return { code: 401, message: '未获取到可信用户身份', data: {} }
  const user = await gateway.findUser(openid)
  if (!user) return { code: 404, message: '用户不存在', data: {} }
  return {
    code: 200,
    message: '获取设置成功',
    data: {
      lowCarbonPriority: user.lowCarbonPriority === true
    }
  }
}

module.exports = { getLowCarbonPriority }
