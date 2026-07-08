const db = wx.cloud.database()
const app = getApp()

Page({
  data: {
    historyList: [],
    refreshing: false,
    loadingMore: false,
    noMoreData: false,
    page: 1,
    pageSize: 10,
    isSelectionMode: false // 是否在选择模式下
  },

  onLoad(options) {
    console.log('生成历史页加载', options)
    
    // 检查是否从穿搭日记页面进入（选择模式）
    if (options.from === 'daily') {
      this.setData({
        isSelectionMode: true
      })
      console.log('进入选择模式')
    }
    
    this.loadHistory(true) // 页面加载时默认按第一页刷新
  },

  onShow() {
    console.log('生成历史页显示')
    // 如果需要每次显示都刷新，可以取消下方注释
    this.loadHistory(true)
  },

  // === 🌟 核心升级：接入真实云数据库加载历史数据 ===
  async loadHistory(refresh = false) {
    if (refresh) {
      this.setData({ refreshing: true, page: 1 })
    } else {
      this.setData({ loadingMore: true })
    }

    try {
      const userId = app.globalData.currentUserId || 'unknown_user'
      const { page, pageSize } = this.data

      // 1. 发起数据库查询
      const res = await db.collection('tryonRecords')
        .where({ user_id: userId, source: 'aiTryon', status: 'success' })           // 只查当前用户的
        .orderBy('createdAt', 'desc')       // 按时间倒序（最新的在最上面）
        .skip((page - 1) * pageSize)         // 分页跳过前几页的数据
        .limit(pageSize)                     // 限制每页数量
        .get()

      // 2. 数据清洗与格式化，适配前端 UI
      const formattedData = res.data.map(item => {
        // 格式化服务器时间为 YYYY-MM-DD
        let dateStr = '未知日期'
        const recordTime = item.createdAt || item.createTime || item.created_at
        if (recordTime) {
          const dateObj = new Date(recordTime)
          const y = dateObj.getFullYear()
          const m = String(dateObj.getMonth() + 1).padStart(2, '0')
          const d = String(dateObj.getDate()).padStart(2, '0')
          dateStr = `${y}-${m}-${d}`
        }

        return {
          id: item._id,            // 数据库自动生成的唯一 ID
          image: item.resultImage || item.imageUrl || item.finalImage,  // 合成图的 FileID
          date: dateStr,
          selected: false,         // 初始状态为未选择
          rawData: item            // 备份完整数据，以后查详情用得着
        }
      })

      // 3. 更新到页面
      if (refresh) {
        this.setData({
          historyList: formattedData,
          refreshing: false,
          noMoreData: formattedData.length < pageSize
        })
      } else {
        this.setData({
          historyList: [...this.data.historyList, ...formattedData],
          loadingMore: false,
          noMoreData: formattedData.length < pageSize
        })
      }

    } catch (error) {
      console.error('❌ 加载历史记录失败:', error)
      wx.showToast({ title: '加载失败', icon: 'none' })
      this.setData({ refreshing: false, loadingMore: false })
    }
  },

  // 返回上一页
  goBack() {
    wx.navigateBack()
  },

  // 下拉刷新
  onRefresh() {
    this.loadHistory(true)
  },

  // 上拉加载更多
  onLoadMore() {
    if (this.data.loadingMore || this.data.noMoreData) {
      return
    }
    
    this.setData({
      page: this.data.page + 1
    })
    this.loadHistory()
  },

  // 处理海报选择
  goToPoster(e) {
    const item = e.currentTarget.dataset.item
    
    if (this.data.isSelectionMode) {
      // 选择模式：选择海报并返回
      this.selectPoster(item)
    } else {
      // 普通模式：查看海报详情
      this.viewPoster(item)
    }
  },

  // 选择海报（选择模式）
  selectPoster(item) {
    // 更新选择状态
    const historyList = this.data.historyList.map(poster => ({
      ...poster,
      selected: poster.id === item.id
    }))
    
    this.setData({
      historyList: historyList
    })
    
    // 将选中的海报数据存储到本地
    wx.setStorageSync('selectedPoster', item)
    
    // 延迟返回，让用户看到选择效果
    setTimeout(() => {
      // 返回到每日穿搭页面
      wx.navigateBack({
        delta: 1
      })
      
      // 显示选择成功提示
      wx.showToast({
        title: '穿搭已选择',
        icon: 'success'
      })
    }, 300)
  },

  // === 🌟 核心修复：查看海报详情（普通模式） ===
  viewPoster(item) {
    // 放弃错误的页面跳转，直接调用微信原生全屏预览大图！
    wx.previewImage({
      current: item.image, // 当前显示图片的链接
      urls: [item.image]   // 需要预览的图片链接列表（这里只有一张）
    })
  }
})