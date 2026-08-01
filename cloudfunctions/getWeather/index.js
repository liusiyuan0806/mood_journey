/**
 * 云函数：获取真实天气数据
 * 天气数据：Open-Meteo（免费，无需 API Key）
 * 城市逆地理编码：腾讯地图 WebService API
 * 部署前需在云函数目录执行 npm install
 * 
 * ========== 部署前必须填入腾讯地图 Key ==========
 * 1. 去 https://lbs.qq.com/ 注册登录
 * 2. 控制台 → 应用管理 → 创建应用 → 添加 Key
 * 3. 启用产品勾选 "WebServiceAPI"
 * 4. 把 Key 填入下方 TENCENT_MAP_KEY
 */
const TENCENT_MAP_KEY = 'I7DBZ-AQNC3-HQP34-RHG5Y-ZLR4V-V5FBD'; // ← 替换为你的腾讯地图 Key

const fetch = require('node-fetch');

// Open-Meteo 天气代码 → 中文描述映射
const WMO_CODES = {
  0:  { type: 'sunny',      icon: '☀️', text: '晴',     category: 'sunny' },
  1:  { type: 'sunny',      icon: '☀️', text: '晴',     category: 'sunny' },
  2:  { type: 'partlyCloudy', icon: '⛅', text: '多云',  category: 'sunny' },
  3:  { type: 'cloudy',     icon: '☁️', text: '阴',     category: 'cloudy' },
  45: { type: 'foggy',      icon: '🌫️', text: '雾',     category: 'cloudy' },
  48: { type: 'foggy',      icon: '🌫️', text: '雾',     category: 'cloudy' },
  51: { type: 'lightRain',  icon: '🌧️', text: '小雨',  category: 'rainy' },
  53: { type: 'rainy',      icon: '🌧️', text: '雨',     category: 'rainy' },
  55: { type: 'heavyRain',  icon: '🌧️', text: '大雨',  category: 'rainy' },
  61: { type: 'lightRain',  icon: '🌧️', text: '小雨',  category: 'rainy' },
  63: { type: 'rainy',      icon: '🌧️', text: '雨',     category: 'rainy' },
  65: { type: 'heavyRain',  icon: '🌧️', text: '大雨',  category: 'rainy' },
  71: { type: 'snowy',      icon: '❄️', text: '雪',     category: 'snowy' },
  73: { type: 'snowy',      icon: '❄️', text: '雪',     category: 'snowy' },
  75: { type: 'snowy',      icon: '❄️', text: '大雪',  category: 'snowy' },
  77: { type: 'snowy',      icon: '❄️', text: '雪',     category: 'snowy' },
  80: { type: 'lightRain',  icon: '🌧️', text: '阵雨',  category: 'rainy' },
  81: { type: 'rainy',      icon: '🌧️', text: '雨',     category: 'rainy' },
  82: { type: 'heavyRain',  icon: '🌧️', text: '大雨',  category: 'rainy' },
  85: { type: 'snowy',      icon: '❄️', text: '雪',     category: 'snowy' },
  86: { type: 'snowy',      icon: '❄️', text: '雪',     category: 'snowy' },
  95: { type: 'thunderstorm', icon: '⛈️', text: '雷阵雨', category: 'thunderstorm' },
  96: { type: 'thunderstorm', icon: '⛈️', text: '雷暴',  category: 'thunderstorm' },
  99: { type: 'thunderstorm', icon: '⛈️', text: '雷暴',  category: 'thunderstorm' },
};

/**
 * 腾讯地图逆地理编码 → 返回城市名
 * @param {number} lat 纬度
 * @param {number} lng 经度
 * @returns {string|null} 城市名，如"广州市"或"南山区"
 */
async function getCityFromTencentMap(lat, lng) {
  if (!TENCENT_MAP_KEY || TENCENT_MAP_KEY === 'YOUR_KEY_HERE') {
    console.log('未配置腾讯地图 Key，跳过逆地理编码');
    return null;
  }
  try {
    const url = `https://apis.map.qq.com/ws/geocoder/v1/?location=${lat},${lng}&key=${TENCENT_MAP_KEY}&get_poi=0`;
    // 兼容老版本 Node：手动超时（2.5秒），不依赖 AbortSignal.timeout
    // 必须小于 wx.cloud.callFunction 默认超时（3秒）
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), 2500)
    );
    const fetchPromise = fetch(url);
    const res = await Promise.race([fetchPromise, timeoutPromise]);
    if (!res.ok) return null;
    const json = await res.json();
    // status=0 表示成功
    if (json.status === 0 && json.result) {
      const adInfo = json.result.ad_info || {};
      const addr = json.result.address_component || {};
      // 优先返回完整的市名，其次区名，最后省名
      return adInfo.city || addr.district || adInfo.province || null;
    } else {
      console.log('腾讯地图逆地理编码返回异常:', json.status, json.message);
      return null;
    }
  } catch (err) {
    console.log('腾讯地图逆地理编码失败:', err.message);
    return null;
  }
}

exports.main = async (event) => {
  const { latitude, longitude, skipGeo, clientCity } = event;

  if (!latitude || !longitude) {
    return { success: false, error: '缺少经纬度参数' };
  }

  try {
    // 并行获取天气 + 城市名（腾讯地图国内访问通畅）
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,precipitation_probability&daily=sunrise,sunset&timezone=auto&forecast_days=1`;

    // 决策：是否调用腾讯地图逆地理编码
    // - 前端传入 clientCity（缓存命中）→ 直接用，跳过腾讯地图
    // - skipGeo=true → 跳过
    // - 其他情况 → 调用腾讯地图（注意每日配额）
    let city = null;
    if (clientCity) {
      city = clientCity;
      console.log('使用前端传入的城市:', city);
    } else if (skipGeo) {
      console.log('跳过逆地理编码（skipGeo=true）');
    } else {
      city = await getCityFromTencentMap(latitude, longitude);
    }

    const weatherRes = await fetch(weatherUrl);
    const weatherData = await weatherRes.json();

    if (!weatherData || !weatherData.current) {
      return { success: false, error: '天气数据获取失败' };
    }

    const current = weatherData.current;
    const daily = weatherData.daily || {};

    // 解析天气代码
    const weatherCode = current.weather_code;
    const weatherInfo = WMO_CODES[weatherCode] || WMO_CODES[3];

    // 风力等级
    const windSpeed = current.wind_speed_10m || 0;
    const windLevel = windSpeed < 1.6 ? 1 : windSpeed < 3.4 ? 2 : windSpeed < 5.5 ? 3 : windSpeed < 8 ? 4 : 5;
    const windLevels = ['无风', '微风 1级', '轻风 2级', '和风 3级', '清风 4级', '劲风 5级'];
    const windText = windLevels[Math.min(windLevel, 5)];

    console.log('天气获取成功，城市:', city || '(未获取到)');

    return {
      success: true,
      data: {
        temp: Math.round(current.temperature_2m),
        feelsLike: Math.round(current.apparent_temperature),
        humidity: current.relative_humidity_2m,
        rainProb: current.precipitation_probability || 0,
        wind: windText,
        windLevel,
        weatherType: weatherInfo.type,
        weatherIcon: weatherInfo.icon,
        weatherText: weatherInfo.text,
        weatherCategory: weatherInfo.category,
        sunrise: daily.sunrise ? daily.sunrise[0].slice(11, 16) : '06:30',
        sunset: daily.sunset ? daily.sunset[0].slice(11, 16) : '18:30',
        aqi: null,
        aqiLevel: null,
        city, // 腾讯地图逆地理编码返回的城市名
      }
    };
  } catch (err) {
    console.error('天气获取失败:', err);
    return { success: false, error: err.message || '网络请求失败' };
  }
};
