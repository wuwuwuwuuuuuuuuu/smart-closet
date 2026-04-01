# 智能衣橱后端云函数

## 项目概述

本目录包含智能衣橱小程序的后端云函数，使用微信云开发实现。

## 云函数列表

| 云函数名称 | 功能描述 | 接口路径 | 方法 |
|----------|---------|---------|------|
| login | 微信登录 | /api/auth/wechat-login | POST |
| getUserInfo | 获取用户信息 | /api/user/info | GET |
| updateProfile | 更新用户信息 | /api/user/update | POST |
| getClothesList | 获取衣物列表 | /api/wardrobe/list | GET |
| addClothing | 添加衣物 | /api/wardrobe/add | POST |
| updateClothing | 更新衣物 | /api/wardrobe/update | POST |
| deleteClothing | 删除衣物 | /api/wardrobe/delete | POST |
| uploadImage | 图片上传 | /api/upload/image | POST |
| getPosts | 获取帖子列表 | /api/forum/posts | GET |
| createPost | 创建帖子 | /api/forum/create | POST |
| likePost | 点赞帖子 | /api/forum/like | POST |
| commentPost | 评论帖子 | /api/forum/comment | POST |
| aiTryon | AI试穿 | /api/tryon/ai | POST |

## 数据库结构

### 1. users 集合
- _id: 用户ID
- openid: 微信openid
- nickname: 昵称
- avatar: 头像URL
- gender: 性别
- birthday: 生日
- created_at: 创建时间
- updated_at: 更新时间

### 2. clothes 集合
- _id: 衣物ID
- user_id: 用户ID
- name: 衣物名称
- image: 图片URL
- season: 适用季节
- category: 衣物分类
- tags: 标签数组
- material: 材质
- brand: 品牌
- created_at: 创建时间
- updated_at: 更新时间

### 3. posts 集合
- _id: 帖子ID
- author_id: 作者ID
- title: 标题
- content: 内容
- images: 图片URL数组
- tags: 标签数组
- created_at: 创建时间
- updated_at: 更新时间

### 4. comments 集合
- _id: 评论ID
- post_id: 帖子ID
- user_id: 用户ID
- content: 评论内容
- created_at: 创建时间

### 5. likes 集合
- _id: 点赞ID
- post_id: 帖子ID
- user_id: 用户ID
- created_at: 创建时间

### 6. tryonRecords 集合
- _id: 试穿记录ID
- user_id: 用户ID
- user_image: 用户形象图片URL
- clothing_image: 衣物图片URL
- result_image: 试穿结果图片URL
- type: 试穿类型
- processing_time: 处理时间
- created_at: 创建时间

## 部署步骤

1. **初始化云开发环境**
   - 在微信开发者工具中打开项目
   - 点击「云开发」按钮，开通云开发服务
   - 记录云开发环境ID

2. **配置云函数**
   - 在 `project.config.json` 文件中配置云开发环境ID
   - 例如：`"cloudfunctionRoot": "cloudfunctions/", "cloudfunctionTemplateRoot": "cloudfunctionTemplate/"`

3. **部署云函数**
   - 在微信开发者工具中，右键点击 `cloudfunctions` 目录
   - 选择「上传并部署」
   - 等待部署完成

4. **初始化数据库**
   - 部署 `initDB` 云函数
   - 调用 `initDB` 云函数初始化数据库集合

5. **配置前端**
   - 在 `app.js` 文件中配置云开发环境ID
   - 例如：`wx.cloud.init({ env: 'your-env-id' })`

## 测试方法

1. **本地调试**
   - 在微信开发者工具中，右键点击云函数，选择「本地调试」
   - 输入测试参数，点击「调用」

2. **真机测试**
   - 在微信开发者工具中，点击「真机调试」
   - 使用手机扫描二维码，在手机上测试

3. **接口测试**
   - 使用 Postman 或其他API测试工具测试云函数接口
   - 接口URL格式：`https://api.weixin.qq.com/tcb/invokecloudfunction?access_token=ACCESS_TOKEN&env=ENV&name=FUNCTION_NAME`

## 注意事项

1. **安全问题**
   - 本项目使用简化的token验证方式，实际项目中应该使用JWT
   - 云函数需要添加适当的权限控制

2. **性能优化**
   - 对于大量数据查询，应该添加适当的索引
   - 图片上传应该限制大小和格式

3. **错误处理**
   - 云函数应该添加完善的错误处理机制
   - 前端应该根据后端返回的错误码进行相应的处理

## 技术栈

- 微信云开发
- Node.js
- 微信小程序云函数

## 联系方式

如有技术问题，请联系后端开发团队。