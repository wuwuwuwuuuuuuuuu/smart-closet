# 后端接口文档

## 概述

本文档描述了小程序需要调用的后端API接口，包括接口URL、请求参数、响应格式等。

## 基础信息

- **基础URL**: `https://api.yourdomain.com` (请替换为实际域名)
- **认证方式**: JWT Token (通过微信登录获取)
- **数据格式**: JSON
- **字符编码**: UTF-8

## 接口列表

### 1. 用户认证相关

#### 1.1 微信登录
```
POST /api/auth/wechat-login
```

**请求参数**:
```json
{
  "code": "微信登录code",
  "userInfo": {
    "nickName": "用户昵称",
    "avatarUrl": "头像URL",
    "gender": 性别
  }
}
```

**响应**:
```json
{
  "code": 200,
  "data": {
    "token": "JWT Token",
    "userInfo": {
      "id": "用户ID",
      "nickname": "昵称",
      "avatar": "头像",
      "gender": "性别"
    }
  }
}
```

#### 1.2 获取用户信息
```
GET /api/user/info
```

**请求头**:
```
Authorization: Bearer {token}
```

**响应**:
```json
{
  "code": 200,
  "data": {
    "id": "用户ID",
    "nickname": "昵称",
    "avatar": "头像URL",
    "gender": "性别",
    "birthday": "生日",
    "wardrobeCount": 10,
    "postCount": 5
  }
}
```

### 2. 衣物管理相关

#### 2.1 获取衣物列表
```
GET /api/wardrobe/list
```

**查询参数**:
- `season` (可选): 季节筛选
- `category` (可选): 分类筛选
- `keyword` (可选): 关键词搜索
- `page` (可选): 页码，默认1
- `limit` (可选): 每页数量，默认20

**响应**:
```json
{
  "code": 200,
  "data": {
    "list": [
      {
        "id": "衣物ID",
        "name": "衣物名称",
        "image": "图片URL",
        "season": "适用季节",
        "category": "分类",
        "tags": ["标签1", "标签2"],
        "createTime": "创建时间"
      }
    ],
    "total": 100,
    "page": 1,
    "limit": 20
  }
}
```

#### 2.2 添加衣物
```
POST /api/wardrobe/add
```

**请求体**:
```json
{
  "name": "衣物名称",
  "image": "图片URL",
  "season": "适用季节",
  "category": "分类",
  "tags": ["标签1", "标签2"],
  "material": "材质",
  "brand": "品牌"
}
```

**响应**:
```json
{
  "code": 200,
  "data": {
    "id": "新创建的衣物ID"
  }
}
```

#### 2.3 图片上传
```
POST /api/upload/image
Content-Type: multipart/form-data
```

**表单数据**:
- `file`: 图片文件
- `type`: 上传类型（wardrobe/avatar/post）

**响应**:
```json
{
  "code": 200,
  "data": {
    "url": "上传后的图片URL"
  }
}
```

### 3. 社区功能相关

#### 3.1 获取帖子列表
```
GET /api/forum/posts
```

**查询参数**:
- `type` (可选): 帖子类型
- `page` (可选): 页码
- `limit` (可选): 每页数量

**响应**:
```json
{
  "code": 200,
  "data": {
    "list": [
      {
        "id": "帖子ID",
        "title": "标题",
        "content": "内容",
        "images": ["图片1", "图片2"],
        "author": {
          "id": "作者ID",
          "nickname": "昵称",
          "avatar": "头像"
        },
        "likes": 10,
        "comments": 5,
        "createTime": "发布时间"
      }
    ]
  }
}
```

#### 3.2 发布帖子
```
POST /api/forum/create
```

**请求体**:
```json
{
  "title": "帖子标题",
  "content": "帖子内容",
  "images": ["图片URL1", "图片URL2"],
  "tags": ["标签1", "标签2"]
}
```

### 4. 试穿功能相关

#### 4.1 AI试穿
```
POST /api/tryon/ai
```

**请求体**:
```json
{
  "userImage": "用户形象图片URL",
  "clothingImage": "衣物图片URL",
  "type": "试穿类型"
}
```

**响应**:
```json
{
  "code": 200,
  "data": {
    "resultImage": "试穿结果图片URL",
    "processingTime": "处理耗时"
  }
}
```

## 错误码说明

| 错误码 | 说明 |
|--------|------|
| 200 | 成功 |
| 400 | 请求参数错误 |
| 401 | 未授权 |
| 403 | 权限不足 |
| 404 | 资源不存在 |
| 500 | 服务器内部错误 |

## 数据字典

### 季节类型
- `spring`: 春季
- `summer`: 夏季
- `autumn`: 秋季
- `winter`: 冬季
- `all`: 通用

### 衣物分类
- `top`: 上衣
- `pants`: 裤子
- `skirt`: 裙子
- `coat`: 外套
- `hat`: 帽子
- `shoes`: 鞋子
- `accessory`: 配饰

## 开发建议

1. **接口版本控制**: 建议使用 `/api/v1/` 前缀
2. **接口文档**: 建议使用 Swagger/OpenAPI
3. **错误处理**: 统一错误响应格式
4. **数据验证**: 请求参数验证
5. **安全考虑**: SQL注入防护、XSS防护

## 前端调用示例

```javascript
// 获取衣物列表
wx.request({
  url: 'https://api.yourdomain.com/api/wardrobe/list',
  method: 'GET',
  header: {
    'Authorization': 'Bearer ' + token
  },
  data: {
    season: 'spring',
    category: 'top'
  },
  success: (res) => {
    console.log('获取成功:', res.data)
  }
})
```

## 联系方式

如有接口相关问题，请联系前端开发团队。