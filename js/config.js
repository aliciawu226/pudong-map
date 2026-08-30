// 地图项目配置：平时只需要修改这里
window.MAP_CONFIG = {
  // 高德开放平台的 Key（Web端 JS API）
  amapKey: '0c44c7ef9ce1d7a4bb7295b6c3e9b7b4',

  // 高德 JS API 2.0 安全密钥
  amapSecurityCode: 'db04662022a98056fee0c42188612fd6',

  // 管理页本地密码的指纹（未配置云端时使用；想换密码请让助手重新生成）
  localAdminPasswordHash: '54da56a941eaa72d27ffa217590aecefa81a312270ed0bbff6285e583e154fda',

  // 云端数据库（Supabase）配置，暂时留空；配置后自动启用云端保存
  supabase: {
    url: '',
    anonKey: '',
    adminEmail: 'aliciawu226@gmail.com'
  },

  // 地图初始中心（浦东新区）
  mapCenter: [121.56, 31.22],
  mapZoom: 11
};
