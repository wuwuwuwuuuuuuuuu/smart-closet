// 图标映射配置
const iconMapping = {
  'icon_back.png': 'img36.png',
  'icon_arrow.png': 'img7.png',
  'icon_weather.png': 'img15.png',
  'icon_heart.png': 'img27.png',
  'icon_heart_filled.png': 'img28.png',
  'icon_feather.png': 'img24.png',
  'icon_add.png': 'img35.png',
  'icon_more.png': 'img11.png',
  'icon_poster.png': 'img12.png',
  'icon_download.png': 'img30.png',
  'icon_share.png': 'img31.png',
  'icon_star.png': 'img20.png',
  'icon_toggle.png': 'img43.png',
  'icon_search.png': 'img8.png',
  'icon_confirm.png': 'img34.png',
  'icon_avatar.png': 'img5.png',
  'icon_crown.png': 'img23.png',
  'icon_wardrobe.png': 'img22.png',
  'icon_list.png': 'img21.png',
  'icon_delete.png': 'img25.png',
  'icon_comment.png': 'img29.png',
  'icon_upload.png': 'img6.png',
  'icon_tryon.png': 'img37.png',
  'icon_product.png': 'img36.png'
};

// 需要更新的文件列表
const filesToUpdate = [
  'pages/home/home.wxml',
  'pages/daily/daily.wxml',
  'pages/tryon/tryon.wxml',
  'pages/preview/preview.wxml',
  'pages/poster/poster.wxml',
  'pages/forum/forum.wxml',
  'pages/postDetail/postDetail.wxml',
  'pages/postEdit/postEdit.wxml',
  'pages/profile/profile.wxml',
  'pages/avatar/avatar.wxml',
  'pages/collection/collection.wxml',
  'pages/history/history.wxml',
  'pages/myPosts/myPosts.wxml'
];

console.log('图标映射配置已准备好，请手动更新以下文件中的图标引用：');
console.log('需要更新的文件列表：', filesToUpdate);
console.log('图标映射关系：', iconMapping);