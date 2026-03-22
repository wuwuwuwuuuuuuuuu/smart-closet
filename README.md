# 场景化智能衣橱 - 微信小程序

## 项目概述

这是一个基于微信小程序的智能衣橱管理系统，提供衣物管理、穿搭记录、社区分享等功能。

## 技术栈

- **前端框架**: 微信小程序原生开发
- **样式语言**: WXSS (CSS扩展)
- **逻辑语言**: JavaScript
- **数据存储**: 微信云存储 + 本地存储

## 项目结构

```
衣橱/
├── app.json              # 全局配置文件
├── app.js               # 全局逻辑文件
├── app.wxss             # 全局样式文件
└── pages/               # 页面目录
    ├── home/            # 首页
    ├── daily/           # 每日穿搭
    ├── tryon/           # 试穿功能
    ├── wardrobe/        # 我的衣橱
    ├── uploadClothes/   # 服饰上传
    ├── clothingInfo/    # 衣物信息录入
    ├── forum/           # 社区
    ├── profile/         # 个人中心
    └── ...
```

## 核心功能模块

### 1. 首页 (home)
- 穿搭日记展示
- 快速试穿入口
- 轮播图展示

### 2. 我的衣橱 (wardrobe)
- 衣物分类管理（季节+类型）
- 搜索筛选功能
- 衣物添加和管理

### 3. 试穿功能 (tryon)
- AI试穿和商品试穿
- 预览效果展示

### 4. 社区功能 (forum)
- 小红书风格帖子展示
- 发帖、点赞、评论

### 5. 个人中心 (profile)
- 个人信息管理
- 我的帖子、收藏、历史

## 数据接口预留

### 用户相关
```javascript
// 用户信息接口预留
const userApi = {
  login: '/api/user/login',
  getUserInfo: '/api/user/info',
  updateProfile: '/api/user/update'
}
```

### 衣物管理
```javascript
// 衣物接口预留
const wardrobeApi = {
  getClothesList: '/api/wardrobe/list',
  addClothing: '/api/wardrobe/add',
  updateClothing: '/api/wardrobe/update',
  deleteClothing: '/api/wardrobe/delete'
}
```

### 社区功能
```javascript
// 社区接口预留
const forumApi = {
  getPosts: '/api/forum/posts',
  createPost: '/api/forum/create',
  likePost: '/api/forum/like',
  commentPost: '/api/forum/comment'
}
```

## 开发说明

### 页面跳转关系
- 首页 → 试穿 → 预览
- 我的 → 我的衣橱 → 服饰上传 → 衣物信息录入
- 我的 → 我的帖子 → 帖子详情
- 社区 → 发帖 → 帖子详情

### 样式规范
- 主色调: 浅灰色 (#EDEDED) + 白色 (#FFFFFF)
- 强调色: 粉蓝渐变 (linear-gradient(135deg, #FFE8E8 0%, #E0F1FF 100%))
- 圆角: 统一使用 12rpx
- 字体: PingFang SC，标题32rpx，正文28rpx

### 数据存储
- 临时数据: 使用页面data对象
- 持久化数据: 使用wx.setStorageSync/wx.getStorageSync
- 图片文件: 使用微信云存储

## 后端接口需求

### 1. 用户认证
- 微信登录接口
- 用户信息获取和更新

### 2. 衣物管理
- 衣物CRUD操作
- 图片上传和存储
- 分类和标签管理

### 3. 社区功能
- 帖子发布和展示
- 点赞评论功能
- 用户关注系统

### 4. 试穿功能
- AI试穿算法接口
- 试穿结果存储

## 部署说明

### 开发环境
1. 微信开发者工具导入项目
2. 配置appid和云开发环境
3. 真机调试测试功能

### 生产环境
1. 小程序后台配置域名
2. 上传代码审核发布
3. 监控和运维

## 注意事项

1. 所有图片资源已上传至微信云存储
2. 页面路由已在app.json中配置
3. 样式采用响应式设计，适配不同屏幕
4. 代码已添加详细注释，便于维护

## 联系方式

如有技术问题，请联系前端开发团队。