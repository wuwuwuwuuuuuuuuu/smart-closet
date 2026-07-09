# 衣智焕新 - 场景化智能衣橱微信小程序

`衣智焕新` 是一款基于微信小程序原生能力和微信云开发构建的智能衣橱应用。项目围绕“衣物管理、每日穿搭、AI 试穿、智能推荐、社区分享、闲置预警”展开，帮助用户把线下衣橱数字化，并在通勤、约会、出游、天气变化等场景中获得更合适的穿搭建议。

## 项目亮点

- 数字衣橱：支持衣物上传、分类、标签、季节筛选、详情查看和删除管理。
- AI 试穿：支持从衣橱选择衣物、上传模特图或商品图，并生成试穿预览。
- 智能推荐：结合天气、城市、用户输入、衣橱知识库和低碳信号生成穿搭建议。
- 今日穿搭：每天最多保存 3 套穿搭记录，并可查看历史搭配。
- 社区分享：支持发布穿搭帖子、浏览社区、查看详情、点赞、收藏、评论和回复。
- 个人中心：支持头像、背景、资料、收藏、历史、我的帖子、反馈等用户功能。
- 闲置预警：统计衣物活跃率、闲置衣物数量，并给出低碳穿搭建议。

## 技术栈

| 层级 | 技术 |
| --- | --- |
| 小程序端 | 微信小程序原生框架、WXML、WXSS、JavaScript |
| 云能力 | 微信云开发、云函数、云数据库、云存储 |
| 图片能力 | 云存储图片、图像分割、AI 试穿相关云函数 |
| 智能推荐 | 天气信息、衣橱知识库、推荐信号、云函数编排 |
| 测试 | Node.js `assert` 风格脚本测试 |

## 目录结构

```text
衣橱/
├── app.js                         # 小程序全局生命周期、云开发初始化、静默登录
├── app.json                       # 页面路由、窗口、tabBar、权限配置
├── app.wxss                       # 全局样式
├── project.config.json            # 微信开发者工具项目配置
├── API_DOCUMENTATION.md           # 早期 HTTP API 设计说明
├── components/
│   └── upload-modal/              # 衣物上传弹窗组件
├── pages/
│   ├── login/                     # 登录页
│   ├── home/                      # 首页
│   ├── todayOutfit/               # 今日穿搭
│   ├── outfitHistory/             # 穿搭历史
│   ├── wardrobe/                  # 我的衣橱
│   ├── uploadClothes/             # 上传衣物
│   ├── clothingInfo/              # 衣物信息录入
│   ├── clothesDetail/             # 衣物详情
│   ├── daily/                     # 智能推荐对话
│   ├── tryon/                     # AI 试穿工作台
│   ├── preview/                   # 试穿结果预览
│   ├── poster/                    # 海报/标签处理
│   ├── forum/                     # 社区列表
│   ├── postEdit/                  # 发布帖子
│   ├── postDetail/                # 帖子详情、评论、点赞、收藏
│   ├── profile/                   # 个人中心
│   ├── profileSettings/           # 个人资料设置
│   ├── avatar/                    # 形象/头像管理
│   ├── collection/                # 我的收藏
│   ├── history/                   # 生成历史
│   ├── myPosts/                   # 我的帖子
│   ├── lowCarbon/                 # 闲置预警与低碳建议
│   ├── idleClothes/               # 闲置衣物列表
│   └── feedback/                  # 意见反馈
├── services/
│   ├── outfitService.*            # 今日穿搭/历史记录服务，支持 mock 与 cloud 实现
│   └── lowCarbonService.*         # 闲置预警/低碳信号服务，支持 mock 与 cloud 实现
├── utils/
│   ├── aliyun-image-segmentation.js
│   ├── currentTryonContext.js
│   ├── outfitDate.js
│   ├── outfitImage.js
│   └── tryonSelectionEntry.js
├── cloudfunctions/                # 微信云函数目录
├── images/                        # 本地图片和图标资源
└── tests/                         # Node.js 脚本测试
```

## 核心页面

| 页面 | 路径 | 说明 |
| --- | --- | --- |
| 登录 | `pages/login/login` | 微信云函数登录，登录后进入首页 tab |
| 首页 | `pages/home/home` | 轮播图、智能推荐、今日穿搭、上传、AI 试穿、商品试穿入口 |
| 今日穿搭 | `pages/todayOutfit/todayOutfit` | 展示当天保存的穿搭记录，限制每日数量 |
| 穿搭历史 | `pages/outfitHistory/outfitHistory` | 查看历史穿搭记录 |
| 智能推荐 | `pages/daily/daily` | 天气卡片、推荐对话、知识库同步与推荐结果 |
| 试穿 | `pages/tryon/tryon` | 衣物选择侧栏、画布拖拽、AI 试穿触发 |
| 预览 | `pages/preview/preview` | 展示生成结果、收藏、生成海报、保存穿搭 |
| 衣橱 | `pages/wardrobe/wardrobe` | 搜索、季节 tab、分类筛选、衣物网格 |
| 社区 | `pages/forum/forum` | 帖子瀑布流和发布入口 |
| 帖子详情 | `pages/postDetail/postDetail` | 图片轮播、正文、评论、回复、点赞、收藏 |
| 我的 | `pages/profile/profile` | 用户资料、入口菜单、设置项 |
| 闲置预警 | `pages/lowCarbon/lowCarbon` | 闲置数量、活跃率、低碳穿搭建议 |

## 云函数概览

项目使用 `cloudfunctions/` 作为云函数根目录。主要函数按功能可分为：

| 类型 | 相关云函数 |
| --- | --- |
| 用户与资料 | `login`、`getUserInfo`、`updateProfile` |
| 衣物管理 | `addClothing`、`getClothesList`、`updateClothing`、`deleteClothing`、`uploadImage` |
| 图片与试穿 | `imageSegmentation`、`aiTryon`、`aiSceneFusion`、`smartRecommendPhoto` |
| 今日穿搭 | `saveOutfitRecord`、`getTodayOutfits`、`getOutfitHistory`、`deleteTodayOutfit`、`expireOutfitDetails` |
| 智能推荐 | `getWeather`、`getRecommendationSignals`、`rebuildUserKnowledgeBase` |
| 低碳/闲置 | `getLowCarbonSummary`、`getIdleClothes`、`getLowCarbonPriority`、`updateLowCarbonPriority` |
| 社区 | `addForumPost`、`getForumList`、`getPostDetail`、`deletePost`、`toggleLike`、`toggleCollect` |
| 评论 | `addComment`、`addReply`、`getComments`、`deleteComment`、`toggleCommentLike` |
| 通知 | `getNotifications`、`getUnreadNotificationCount`、`markNotificationAsRead` |
| 初始化 | `initDB`、`initFeedback` |

> 说明：部分云函数保留给历史功能或后续扩展使用。当前页面是否调用，以页面 JS 和 `services/` 中的 cloud 实现为准。

## 数据与存储

项目主要依赖微信云数据库和云存储。常见数据实体包括：

- 用户档案：昵称、头像、背景图、性别、生日、云数据库用户 ID。
- 衣物数据：名称、图片、分类、季节、材质、标签、使用记录。
- 穿搭记录：每日 slot、试穿结果图、关联衣物、请求 ID、日期键。
- 社区帖子：标题、正文、图片、作者、点赞数、收藏数、评论数。
- 评论回复：一级评论、楼中楼回复、点赞状态。
- 推荐知识：衣物图片字段、用户衣橱知识库、检索结果、推荐信号。
- 闲置信号：衣物活跃率、闲置衣物、低碳建议。

图片资源主要存放在微信云存储，部分图标和基础图片在 `images/` 目录中。

## 环境配置

### 基础要求

- 微信开发者工具
- 微信小程序 AppID
- 微信云开发环境
- Node.js，用于本地脚本测试和云函数依赖管理

当前项目配置：

```text
小程序 AppID: ****************
云开发环境: ********************
云函数根目录: cloudfunctions/
基础库版本: 3.15.0
```

如需更换环境，请修改：

- `project.config.json` 中的 `appid`
- `app.js` 中 `wx.cloud.init({ env })`

## 本地运行

1. 打开微信开发者工具。
2. 选择“导入项目”。
3. 项目目录选择本仓库根目录。
4. 确认 AppID 与云开发环境。
5. 等待开发者工具编译。
6. 如首次使用云函数，先在云开发控制台创建对应环境，并上传部署 `cloudfunctions/` 下的函数。

导入后建议优先检查：

- `app.json` 页面路由是否正常。
- `app.js` 中云环境 ID 是否可用。
- 云函数是否已上传并安装依赖。
- 云数据库集合权限是否允许小程序/云函数按预期访问。

## 云函数部署

在微信开发者工具中：

1. 右键 `cloudfunctions` 下的云函数目录。
2. 选择“上传并部署：云端安装依赖”。
3. 等待部署成功。
4. 对核心函数优先部署：

```text
login
getClothesList
addClothing
updateClothing
deleteClothing
aiTryon
aiSceneFusion
smartRecommendPhoto
saveOutfitRecord
getTodayOutfits
getOutfitHistory
getForumList
getPostDetail
addForumPost
addComment
addReply
toggleLike
toggleCollect
getLowCarbonSummary
getIdleClothes
getWeather
getRecommendationSignals
rebuildUserKnowledgeBase
```

如果云函数中使用第三方服务，需要在对应函数目录中配置密钥或环境变量，并避免提交真实密钥。

## 服务层与 Mock

`services/` 中把页面调用和云函数实现隔开，便于测试和本地调试。

```javascript
// services/outfitService.js
const USE_MOCK_OUTFIT = false

// services/lowCarbonService.js
const USE_MOCK_LOW_CARBON = false
```

需要脱离云端调试时，可临时改为 `true`，使用同目录下的 `.mock.js` 实现。调试完成后请改回 `false`，避免线上误用 mock 数据。

## 测试

项目测试位于 `tests/`。当前没有统一的根目录 `package.json` 测试脚本，测试文件可直接用 Node.js 单独执行。

示例：

```bash
node tests/daily/daily.helpers.test.js
node tests/frontend/outfit-service.test.js
node tests/frontend/low-carbon-service.test.js
node tests/cloud/low-carbon-ranker.test.js
```

测试大致分为：

- `tests/daily/`：智能推荐输入解析、天气提示、推荐渲染等。
- `tests/frontend/`：前端服务层、今日穿搭、试穿上下文、低碳页面行为等。
- `tests/cloud/`：云函数推荐、知识库、低碳排序、检索解析等。
- `tests/knowledge/`：衣物图片字段、向量工具、知识库重建等。
- `tests/outfit/`：穿搭后端与 CloudBase SDK 布局相关测试。

## 主要业务流程

### 登录与用户档案

```text
打开小程序
  -> app.js 初始化云环境
  -> 调用 login 云函数静默登录/注册
  -> 写入 globalData.currentUserId/currentUserInfo
  -> 登录页可手动触发微信一键登录
  -> switchTab 到首页
```

### 衣物上传

```text
首页/衣橱入口
  -> uploadClothes 选择拍照或相册
  -> 云存储上传图片
  -> clothingInfo 录入分类、季节、材质、标签
  -> addClothing 云函数保存
  -> wardrobe 展示衣物列表
```

### AI 试穿

```text
试穿页选择衣物
  -> 可拖拽/缩放摆放
  -> 上传或切换人物形象
  -> 调用 AI 试穿云函数
  -> preview 展示结果
  -> 可收藏、生成海报或保存今日穿搭
```

### 智能推荐

```text
daily 页面获取定位和天气
  -> 用户输入场景/风格/颜色偏好
  -> 调用推荐相关云函数
  -> 读取衣橱知识库和推荐信号
  -> 返回穿搭建议、搭配要点和试穿入口
```

### 社区互动

```text
forum 拉取帖子列表
  -> postEdit 发布图文帖子
  -> postDetail 查看图文详情
  -> 支持点赞、收藏、评论、回复
  -> myPosts/collection 展示个人内容
```

## 页面路由

当前 `app.json` 注册的页面如下：

```text
pages/login/login
pages/home/home
pages/todayOutfit/todayOutfit
pages/outfitHistory/outfitHistory
pages/lowCarbon/lowCarbon
pages/idleClothes/idleClothes
pages/daily/daily
pages/tryon/tryon
pages/preview/preview
pages/poster/poster
pages/forum/forum
pages/postDetail/postDetail
pages/postEdit/postEdit
pages/profile/profile
pages/profileSettings/profileSettings
pages/avatar/avatar
pages/collection/collection
pages/history/history
pages/myPosts/myPosts
pages/clothingInfo/clothingInfo
pages/uploadClothes/uploadClothes
pages/wardrobe/wardrobe
pages/clothesDetail/clothesDetail
pages/feedback/feedback
```

底部 tab：

- 首页：`pages/home/home`
- 试穿：`pages/tryon/tryon`
- 社区：`pages/forum/forum`
- 我的：`pages/profile/profile`

## 权限说明

项目使用位置权限获取天气和城市信息，用于智能推荐。

```json
{
  "scope.userLocation": {
    "desc": "我们需要您的位置来为您提供准确的实时天气和穿搭建议"
  }
}
```

如果用户拒绝位置权限，推荐页应通过城市选择或默认城市兜底。

## 开发规范

- 页面目录保持微信小程序四件套：`.js`、`.json`、`.wxml`、`.wxss`。
- 新增页面后必须同步注册到 `app.json`。
- 云函数调用建议统一封装到 `services/` 或页面方法中，避免重复散落。
- 长期维护的业务能力优先加入测试脚本。
- 图片上传后优先使用云文件 ID，展示时按需换取临时链接。
- UI 改动尽量保持页面结构稳定，优先调整 WXSS，减少不必要的 WXML 改动。
- 不要提交真实密钥、私有 token 或第三方服务凭证。

## 常见问题

### 首页无法进入

优先检查：

- `app.json` 是否能被 JSON 解析。
- `pages/home/home.json` 是否是合法 JSON。
- `pages/home/home.js` 是否有语法错误。
- 首页是否注册在 `tabBar.list` 中，并使用 `wx.switchTab` 跳转。

### 云函数调用失败

优先检查：

- `app.js` 中 `env` 是否是当前云开发环境。
- 云函数是否已上传部署。
- 云函数目录内依赖是否已安装。
- 云数据库集合权限是否允许当前操作。
- 小程序基础库版本是否支持当前云能力。

### 图片不显示

优先检查：

- 云文件 ID 是否有效。
- 是否需要调用 `wx.cloud.getTempFileURL` 获取临时链接。
- 图片路径是否来自 `/images/`、本地临时文件或云存储。
- 小程序是否开启对应域名/云存储访问能力。

### 推荐结果为空

优先检查：

- 是否已有衣物数据。
- 天气/定位是否获取成功。
- `getRecommendationSignals`、`rebuildUserKnowledgeBase` 等云函数是否可用。
- mock/cloud 服务开关是否符合当前调试环境。

## 发布前检查清单

- `app.json`、页面 `.json` 均可解析。
- 微信开发者工具无编译错误。
- 登录、首页、衣橱、试穿、社区、我的五条主路径可走通。
- 云函数已上传部署，关键函数调用成功。
- 图片上传、云存储预览、试穿结果保存可用。
- 位置权限拒绝时有兜底体验。
- 敏感配置未提交到仓库。
- 真机预览通过。

## 维护说明

- 需求文档和接口草案可补充到 `zReadme/` 或 `API_DOCUMENTATION.md`。
- 页面级问题优先从对应 `pages/<pageName>/` 排查。
- 跨页面状态优先检查 `app.js` 的 `globalData`、`wx.setStorageSync` 和 `utils/currentTryonContext.js`。
- 今日穿搭、低碳预警等领域逻辑优先检查 `services/` 与对应测试。

## 许可证

本项目为课程开发项目。如需开源或商业使用，请先补充正式许可证和第三方服务授权说明。
