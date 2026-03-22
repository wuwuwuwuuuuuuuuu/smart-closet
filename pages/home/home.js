// 首页逻辑
Page({
  data: {},

  onLoad() {
    console.log('首页加载')
  },

  onShow() {
    console.log('首页显示')
  },

  // 跳转到每日穿搭页
  goToDaily() {
    wx.navigateTo({
      url: '/pages/daily/daily'
    })
  },

  // 服饰上传
  uploadClothes() {
    wx.navigateTo({
      url: '/pages/uploadClothes/uploadClothes'
    })
  },

  // AI试穿
  goToTryOn() {
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album'],
      success: (res) => {
        console.log('选择AI试穿图片成功:', res.tempFilePaths[0])
        // 跳转到试穿预览页面，并传递AI试穿图片路径
        wx.navigateTo({
          url: '/pages/preview/preview?aiImage=' + encodeURIComponent(res.tempFilePaths[0])
        })
      },
      fail: (err) => {
        console.error('选择图片失败:', err)
        wx.showToast({
          title: '选择图片失败',
          icon: 'none'
        })
      }
    })
  },

  // 选择商品图片
  chooseProductImage() {
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album'],
      success: (res) => {
        console.log('选择商品图片成功:', res.tempFilePaths[0])
        // 跳转到试穿预览页面，并传递商品图片路径
        wx.navigateTo({
          url: '/pages/preview/preview?productImage=' + encodeURIComponent(res.tempFilePaths[0])
        })
      },
      fail: (err) => {
        console.error('选择图片失败:', err)
        wx.showToast({
          title: '选择图片失败',
          icon: 'none'
        })
      }
    })
  }
})