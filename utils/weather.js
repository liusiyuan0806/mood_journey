/**
 * 天气数据工具模块
 * — 生成拟真天气数据、关怀文案、穿衣建议、背景类型、即时反馈
 * — 支持真实天气 API 数据合并（通过 mergeRealWeather）
 */

const { moods } = require('./moods');

// ==================== 简易种子随机 ====================
function seededRandom(seed) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  s = (s * 16807) % 2147483647;
  return (s - 1) / 2147483646;
}

function randomInt(seed, min, max) {
  return Math.floor(seededRandom(seed) * (max - min + 1)) + min;
}

function pickFromSeed(seed, arr) {
  return arr[Math.floor(seededRandom(seed) * arr.length)];
}

// ==================== 季节区间 ====================
function getSeason(month) {
  if (month >= 2 && month <= 4) return 'spring';  // 3-5月
  if (month >= 5 && month <= 7) return 'summer';   // 6-8月
  if (month >= 8 && month <= 10) return 'autumn';  // 9-11月
  return 'winter';                                  // 12-2月
}

// ==================== 天气类型定义 ====================
const WEATHER_POOLS = {
  spring: [
    { type: 'sunny',      icon: '☀️', text: '晴',     weight: 30, category: 'sunny' },
    { type: 'partlyCloudy', icon: '⛅', text: '多云',  weight: 35, category: 'sunny' },
    { type: 'cloudy',     icon: '☁️', text: '阴',     weight: 15, category: 'cloudy' },
    { type: 'lightRain',  icon: '🌧️', text: '小雨',  weight: 15, category: 'rainy' },
    { type: 'rainy',      icon: '🌧️', text: '雨',     weight: 5,  category: 'rainy' },
  ],
  summer: [
    { type: 'sunny',      icon: '☀️', text: '晴',     weight: 40, category: 'sunny' },
    { type: 'partlyCloudy', icon: '⛅', text: '多云',  weight: 25, category: 'sunny' },
    { type: 'cloudy',     icon: '☁️', text: '阴',     weight: 10, category: 'cloudy' },
    { type: 'thunderstorm', icon: '⛈️', text: '雷阵雨', weight: 15, category: 'thunderstorm' },
    { type: 'heavyRain',  icon: '🌧️', text: '大雨',  weight: 10, category: 'rainy' },
  ],
  autumn: [
    { type: 'sunny',      icon: '☀️', text: '晴',     weight: 35, category: 'sunny' },
    { type: 'partlyCloudy', icon: '⛅', text: '多云',  weight: 30, category: 'sunny' },
    { type: 'cloudy',     icon: '☁️', text: '阴',     weight: 20, category: 'cloudy' },
    { type: 'lightRain',  icon: '🌧️', text: '小雨',  weight: 10, category: 'rainy' },
    { type: 'rainy',      icon: '🌧️', text: '雨',     weight: 5,  category: 'rainy' },
  ],
  winter: [
    { type: 'sunny',      icon: '☀️', text: '晴',     weight: 35, category: 'sunny' },
    { type: 'partlyCloudy', icon: '⛅', text: '多云',  weight: 20, category: 'sunny' },
    { type: 'cloudy',     icon: '☁️', text: '阴',     weight: 25, category: 'cloudy' },
    { type: 'overcast',   icon: '☁️', text: '阴天',   weight: 10, category: 'cloudy' },
    { type: 'snowy',      icon: '❄️', text: '雪',     weight: 8,  category: 'snowy' },
    { type: 'lightRain',  icon: '🌧️', text: '小雨',  weight: 2,  category: 'rainy' },
  ],
};

// 温度范围（摄氏度）
const TEMP_RANGES = {
  spring: { min: 12, max: 26 },
  summer: { min: 24, max: 37 },
  autumn: { min: 10, max: 24 },
  winter: { min: -6, max: 8 },
};

// ==================== 关怀文案库 ====================
const CARE_TEXTS = {
  sunny: [
    '阳光不错，若有空，去窗边或户外待十分钟吧。',
    '好天气是生活送的小礼物，收下它就好。',
    '今天很适合晒晒太阳，也晒晒心情。',
    '光线明亮，也许可以借着好天气做一件拖延的小事。',
  ],
  cloudy: [
    '光线偏暗，也许适合给自己安排一件小小的开心事。',
    '阴天适合做一些不赶时间的事情。',
    '云层遮住了太阳，但没遮住你可以感受好一点的可能。',
    '灰蒙蒙的天，不代表你今天的状态也要灰蒙蒙。',
  ],
  rainy: [
    '窗外有雨，今天可以把节奏放慢一点。',
    '雨水在窗上写字，也许是邀请你多停一会儿。',
    '下雨的时候，允许自己不那么高效也没关系。',
    '雨声或许可以帮你把心里的声音也听清楚一点。',
  ],
  thunderstorm: [
    '雷声或许让人不安，给自己一点安全感吧。',
    '暴风雨会过去，此刻照顾好自己最重要。',
    '外面风雨交加，但你可以在这里安放自己的感受。',
  ],
  snowy: [
    '下雪天，世界变得安静，你也可以跟着慢下来。',
    '雪花在飘，今天把对自己的要求也放轻一点。',
    '雪让一切变得柔软，也包括你的心情。',
  ],
  hot: [
    '体感较热，烦躁并不代表你做得不够好。',
    '高温天气里，多喝水就是对自己很好的照顾。',
    '炎热让人疲惫，这不是你的问题。',
    '天热的时候，降低一点对自己的期待是合理的。',
  ],
  cold: [
    '外面很冷，记得给自己一点温暖，不只是身体上的。',
    '寒冷让世界安静，也许适合窝着做点喜欢的事。',
  ],
  night: [
    '夜深了，无论今天如何，都值得一句"辛苦了"。',
    '星光很淡，但你的感受很真实。',
    '夜晚不必完美，存在即足够。',
    '这个时间还在关心自己的心情，你已经很温柔了。',
  ],
};

// ==================== 穿衣建议库（语气温和） ====================
const DRESS_TIPS = {
  // 晴天
  sunny: [
    '阳光正好，穿一件轻薄透气的长袖就很舒服。',
    '今天紫外线偏强，外出时记得戴一顶小帽或撑把伞。',
    '晴天的你可以选浅色系的衣服，会更清爽一些。',
    '光线很暖，穿宽松一点的衣服，心情也会跟着松一点。',
  ],
  // 多云 / 阴
  cloudy: [
    '云层挡住了紫外线，但也挡住了热气，穿一件薄外套刚刚好。',
    '阴天温差容易变，一件方便穿脱的外套会是不错的选择。',
    '今天不需要太厚，穿得舒服比穿得好看更重要。',
    '长袖加一件薄衫，就足以应对这种温吞的天。',
  ],
  // 雨天
  rainy: [
    '记得带一把伞，淋湿了也没关系，但能避免的时候还是避免一下。',
    '雨天可以选一双防水的鞋，脚步稳一些，心情也会稳一些。',
    '外面在下雨，建议穿深色或带防水涂层的外套。',
    '把伞放在容易拿到的地方，是对今天自己温柔的小事。',
  ],
  // 雷阵雨
  thunderstorm: [
    '雷雨天尽量减少外出，必要时穿一件防水外套再出门。',
    '今天风大又有雨，避免穿过于宽松的衣服。',
    '雷雨天安全第一，穿得简单一些，让自己行动更方便。',
    '如果一定要外出，记得避开空旷地带，外套选厚实一点。',
  ],
  // 雪天
  snowy: [
    '下雪天，羽绒服和围巾是给自己的一份温暖。',
    '路会有些滑，穿一双防滑的鞋，走慢一点也没关系。',
    '雪天建议保暖内衣 + 毛衣 + 厚外套，层层包裹更安心。',
    '手套和帽子别忘了，冷的是手，也是想被照顾的心。',
  ],
  // 高温加成
  hot: [
    '体感较热，建议穿棉麻等透气材质的浅色衣服。',
    '今天适合背心或短袖，出门前涂一点防晒更安心。',
    '热天不要穿太紧身的衣服，让皮肤能自由呼吸。',
    '高温天记得多喝水，穿得轻薄一点就是对自己最好的照顾。',
  ],
  // 寒冷加成
  cold: [
    '今天挺冷的，建议厚外套 + 围巾，把自己裹得暖和些。',
    '气温偏低，可以穿一件贴身的保暖内衣，会舒服很多。',
    '冷天别忘了护好脖子和脚踝，那两处最容易着凉。',
    '穿厚一点不是娇气，是懂得心疼自己。',
  ],
  // 夜晚加成
  night: [
    '夜里凉意重，外出的话记得披一件薄外套。',
    '夜晚气温会低一些，回家路上别让自己冷到。',
    '睡前把外套放在伸手可及的地方，半夜起来也会方便。',
    '夜深了，把今天穿出门的衣服换成柔软舒适的家居服吧。',
  ],
  // 通用兜底
  default: [
    '今天穿让自己舒服的衣服就好，不必太在意别人的眼光。',
    '选一件穿起来心情会好一点的那件。',
    '合适的衣服能温柔地拥抱今天，记得对自己好一点。',
  ],
};

// ==================== 生成穿衣建议 ====================
/**
 * 根据天气数据生成一条温和的穿衣建议
 * @param {Object} weather - 天气数据对象（需要包含 weatherCategory / weatherText / temp / isNight）
 * @param {number} [seed] - 随机种子，便于同一日输出稳定
 * @returns {string} 穿衣建议文案
 */
function getDressingTip(weather, seed) {
  if (!weather) return '';

  const category = weather.weatherCategory || 'default';
  const temp = typeof weather.temp === 'number' ? weather.temp : 20;
  const isNight = !!weather.isNight;

  // 优先按天气类别，再叠加温度与时段
  const pool = [...(DRESS_TIPS[category] || DRESS_TIPS.default)];
  if (temp > 30) pool.push(...DRESS_TIPS.hot);
  if (temp < 8)  pool.push(...DRESS_TIPS.cold);
  if (isNight)   pool.push(...DRESS_TIPS.night);

  const useSeed = typeof seed === 'number' ? seed : (new Date().getDate() * 17 + 3);
  return pickFromSeed(useSeed, pool);
}

// ==================== 生成天气数据 ====================
function generateWeather(date) {
  const month = date.getMonth();     // 0-11
  const day = date.getDate();        // 1-31
  const hour = date.getHours();
  const season = getSeason(month);

  const baseSeed = month * 100 + day;
  const isNight = hour < 6 || hour >= 19;

  // 选取天气类型
  const pool = WEATHER_POOLS[season];
  const totalWeight = pool.reduce((s, w) => s + w.weight, 0);
  let roll = seededRandom(baseSeed) * totalWeight;
  let weatherItem = pool[0];
  for (const w of pool) {
    roll -= w.weight;
    if (roll <= 0) { weatherItem = w; break; }
  }

  // 温度
  const range = TEMP_RANGES[season];
  const temp = randomInt(baseSeed + 100, range.min, range.max);
  const feelsLike = temp + randomInt(baseSeed + 200, -2, 4);

  // 湿度
  let humidity;
  if (weatherItem.category === 'rainy' || weatherItem.category === 'thunderstorm') {
    humidity = randomInt(baseSeed + 300, 70, 95);
  } else if (weatherItem.category === 'cloudy') {
    humidity = randomInt(baseSeed + 300, 45, 75);
  } else if (weatherItem.category === 'snowy') {
    humidity = randomInt(baseSeed + 300, 60, 85);
  } else {
    humidity = randomInt(baseSeed + 300, 25, 60);
  }

  // 降雨概率
  let rainProb;
  if (weatherItem.category === 'rainy') {
    rainProb = randomInt(baseSeed + 400, 55, 95);
  } else if (weatherItem.category === 'thunderstorm') {
    rainProb = randomInt(baseSeed + 400, 70, 99);
  } else if (weatherItem.category === 'cloudy') {
    rainProb = randomInt(baseSeed + 400, 10, 45);
  } else if (weatherItem.category === 'snowy') {
    rainProb = randomInt(baseSeed + 400, 40, 80);
  } else {
    rainProb = randomInt(baseSeed + 400, 0, 15);
  }

  // 风力
  const windLevel = randomInt(baseSeed + 500, 1, 4);
  const windText = windLevel === 1 ? '微风 1级' : windLevel === 2 ? '轻风 2级' : windLevel === 3 ? '和风 3级' : '清风 4级';

  // 空气质量
  const aqi = randomInt(baseSeed + 600, 20, 120);
  let aqiLevel = '优';
  if (aqi > 100) aqiLevel = '轻度污染';
  else if (aqi > 75) aqiLevel = '良';
  else if (aqi > 50) aqiLevel = '良';

  // 日出日落
  let sunriseHour, sunriseMin, sunsetHour, sunsetMin;
  if (month <= 1 || month >= 10) { // 冬季
    sunriseHour = 7; sunriseMin = randomInt(baseSeed + 700, 0, 30);
    sunsetHour  = 17; sunsetMin  = randomInt(baseSeed + 800, 0, 30);
  } else if (month >= 5 && month <= 7) { // 夏季
    sunriseHour = 5; sunriseMin = randomInt(baseSeed + 700, 0, 30);
    sunsetHour  = 19; sunsetMin  = randomInt(baseSeed + 800, 0, 30);
  } else { // 春秋
    sunriseHour = 6; sunriseMin = randomInt(baseSeed + 700, 0, 40);
    sunsetHour  = 18; sunsetMin  = randomInt(baseSeed + 800, 0, 30);
  }
  const sunrise = `${String(sunriseHour).padStart(2, '0')}:${String(sunriseMin).padStart(2, '0')}`;
  const sunset  = `${String(sunsetHour).padStart(2, '0')}:${String(sunsetMin).padStart(2, '0')}`;

  // 关怀文案
  const careCategory = weatherItem.category;
  const careTexts = [...CARE_TEXTS[careCategory]];
  if (temp > 32) careTexts.push(...CARE_TEXTS.hot);
  if (temp < 5)  careTexts.push(...CARE_TEXTS.cold);
  if (isNight)   careTexts.push(...CARE_TEXTS.night);
  const careText = pickFromSeed(baseSeed + 900, careTexts);

  // 穿衣建议（先准备一个中间对象，确保 getDressingTip 能读到所需字段）
  const draft = {
    weatherCategory: weatherItem.category,
    weatherText: weatherItem.text,
    temp,
    isNight,
  };
  const dressingTip = getDressingTip(draft, baseSeed + 1000);

  // 背景类型
  let backgroundClass = weatherItem.category;
  if (isNight && (backgroundClass === 'sunny' || backgroundClass === 'cloudy')) {
    backgroundClass = 'night';
  }
  if (weatherItem.category === 'thunderstorm') {
    backgroundClass = 'rainy';
  }

  // 气压（基于海拔和天气的拟真值）
  const pressure = 1000 + randomInt(baseSeed + 1000, 10, 40);

  // 天气预警（低概率）
  const hasWarning = seededRandom(baseSeed + 1100) < 0.05; // 5%概率
  const warningTypes = ['暴雨预警', '雷电预警', '大风预警', '高温预警', '寒潮预警'];
  const warningText = hasWarning ? pickFromSeed(baseSeed + 1200, warningTypes) : '';

  return {
    city: '当前位置',
    temp,
    feelsLike,
    weatherType: weatherItem.type,
    weatherIcon: weatherItem.icon,
    weatherText: weatherItem.text,
    weatherCategory: weatherItem.category,
    rainProb,
    humidity,
    wind: windText,
    windLevel,
    aqi,
    aqiLevel,
    sunrise,
    sunset,
    isNight,
    careText,
    dressingTip,
    backgroundClass,
    pressure,
    hasWarning,
    warningText,
  };
}

// ==================== 场景化提问 ====================
function getContextQuestion(weatherData) {
  const questions = {
    rainy: [
      '这样的雨天里，你感觉如何？',
      '下雨的时候，心情有没有跟着变？',
      '雨天的你，此刻更接近哪一种状态？',
    ],
    sunny: [
      '阳光这么好，你此刻的状态是？',
      '晴天的你，心里更接近哪种感受？',
      '好天气里，你的心情是怎样的？',
    ],
    cloudy: [
      '阴天的光线里，你的心情是怎样的？',
      '这样的天色下，你感觉如何？',
      '云层下的你，此刻更接近什么状态？',
    ],
    snowy: [
      '下雪了，你此刻的心情是？',
      '雪花在飘，你的感受如何？',
    ],
    thunderstorm: [
      '雷雨声中，你的状态如何？',
      '外面的风雨有没有影响你的心情？',
    ],
    night: [
      '夜晚的此刻，你的感受是？',
      '夜深了，你此刻更接近哪一种状态？',
    ],
    default: [
      '这样的天气里，你感觉如何？',
      '今天的天气有没有影响你？',
      '此刻更接近哪一种状态？',
    ],
  };

  const key = weatherData.weatherCategory;
  const pool = questions[key] || questions.default;
  return pickFromSeed(new Date().getDate() * 7, pool);
}

// ==================== 即时反馈生成 ====================
function generateFeedback(newRecord, allRecords) {
  const { mood, emoji, weatherImpact } = newRecord;
  const weatherText = newRecord.weatherText || newRecord.weather || newRecord.weatherSnapshot?.weatherText || '今天';
  const weatherCategory = newRecord.weatherCategory || newRecord.weatherSnapshot?.weatherCategory || 'sunny';
  const now = new Date();
  const isNight = now.getHours() < 6 || now.getHours() >= 19;

  // 筛选当前天气 + 当前心情的历史记录
  const sameWeatherRecords = allRecords.filter(
    r => r.weatherCategory === weatherCategory && r.id !== newRecord.id
  );
  const sameWeatherMoodRecords = sameWeatherRecords.filter(
    r => r.mood === mood
  );

  const feedbacks = [];

  // 1. 天气影响自述
  if (weatherImpact === '很明显') {
    feedbacks.push(`你感觉今天的天气对你影响很明显，从你的记录来看，${weatherText}天的你选择了「${mood}」。`);
  } else if (weatherImpact === '有一点') {
    feedbacks.push(`你觉得天气对你有一点点影响——在${weatherText}天记录下了「${mood}」，这很真实。`);
  } else if (weatherImpact === '没感觉') {
    feedbacks.push(`即便${weatherText}天，你也能清晰地感知到自己的状态——「${mood}」。`);
  } else if (weatherImpact === '说不清') {
    feedbacks.push(`天气和心情之间的关系，有时候确实不太容易说清楚。你在${weatherText}天记录下了「${mood}」，这就够了。`);
  }

  // 2. 历史模式
  if (sameWeatherMoodRecords.length >= 3) {
    feedbacks.push(`这是你第 ${sameWeatherMoodRecords.length + 1} 次在${weatherText}天感到「${mood}」，这似乎是你的一种模式。`);
  } else if (sameWeatherMoodRecords.length === 1) {
    feedbacks.push(`上一次在${weatherText}天，你也记录过「${mood}」，也许这不是偶然。`);
  }

  // 3. 与历史平均对比
  if (sameWeatherRecords.length >= 2) {
    const scoreMap = {};
    moods.forEach(m => { scoreMap[m.name] = m.score; });

    const currentScore = scoreMap[mood] || 3;
    const historicalScores = sameWeatherRecords.map(r => scoreMap[r.mood] || 3);
    const avgScore = historicalScores.reduce((a, b) => a + b, 0) / historicalScores.length;

    if (currentScore > avgScore + 0.8) {
      feedbacks.push(`和以往的${weatherText}天相比，今天的你似乎比平时更愉悦一些。`);
    } else if (currentScore < avgScore - 0.8) {
      feedbacks.push(`和以往的${weatherText}天相比，今天的你似乎比平时低落一些——这不是你的问题，情绪本身就在流动。`);
    } else {
      feedbacks.push(`和以往的${weatherText}天相比，今天的心情与平时差不多。`);
    }
  }

  // 4. 通用关怀
  if (!weatherImpact && feedbacks.length === 0) {
    feedbacks.push(`你在${weatherText}天依然记录下了感受，这很珍贵。`);
  }

  // 5. 夜晚特别关怀
  if (isNight && feedbacks.length === 0) {
    feedbacks.push('夜深了还来记录心情，今晚请给自己一个柔软的收尾。');
  }

  // 选择一条最合适的反馈（优先天气影响相关的）
  return feedbacks[0] || `你在${weatherText}天记录下了「${mood}」，谢谢你愿意看见自己。`;
}

// ==================== 合并真实天气 API 数据 ====================
/**
 * 将云函数返回的真实天气数据合并到天气对象中
 * @param {Object} baseData - generateWeather 生成的基础数据（含关怀文案等）
 * @param {Object} realData - 云函数返回的真实天气数据
 * @returns {Object} 合并后的完整天气数据
 */
function mergeRealWeather(baseData, realData) {
  if (!realData) return baseData;

  const now = new Date();
  const hour = now.getHours();
  const isNight = hour < 6 || hour >= 19;

  // 用真实数据覆盖模拟数据的关键字段
  const merged = {
    ...baseData,
    temp: realData.temp ?? baseData.temp,
    feelsLike: realData.feelsLike ?? baseData.feelsLike,
    humidity: realData.humidity ?? baseData.humidity,
    rainProb: realData.rainProb ?? baseData.rainProb,
    wind: realData.wind ?? baseData.wind,
    windLevel: realData.windLevel ?? baseData.windLevel,
    weatherType: realData.weatherType || baseData.weatherType,
    weatherIcon: realData.weatherIcon || baseData.weatherIcon,
    weatherText: realData.weatherText || baseData.weatherText,
    weatherCategory: realData.weatherCategory || baseData.weatherCategory,
    sunrise: realData.sunrise || baseData.sunrise,
    sunset: realData.sunset || baseData.sunset,
    aqi: realData.aqi ?? baseData.aqi,
    aqiLevel: realData.aqiLevel || baseData.aqiLevel,
    pressure: realData.pressure ?? baseData.pressure,
    hasWarning: realData.hasWarning ?? baseData.hasWarning,
    warningText: realData.warningText || baseData.warningText,
    isNight,
    isRealData: true, // 标记为真实数据
  };

  // 重新确定背景类型（基于真实天气类别）
  let backgroundClass = merged.weatherCategory;
  if (isNight && (backgroundClass === 'sunny' || backgroundClass === 'cloudy')) {
    backgroundClass = 'night';
  }
  if (merged.weatherCategory === 'thunderstorm') {
    backgroundClass = 'rainy';
  }
  merged.backgroundClass = backgroundClass;

  // 重新生成关怀文案（基于真实天气数据）
  const careTexts = [...(CARE_TEXTS[merged.weatherCategory] || [])];
  if (merged.temp > 32) careTexts.push(...CARE_TEXTS.hot);
  if (merged.temp < 5)  careTexts.push(...CARE_TEXTS.cold);
  if (isNight)          careTexts.push(...CARE_TEXTS.night);
  if (careTexts.length > 0) {
    merged.careText = pickFromSeed(new Date().getDate() * 13, careTexts);
  }

  // 重新生成穿衣建议（基于真实天气数据）
  merged.dressingTip = getDressingTip(merged, new Date().getDate() * 19 + 5);

  return merged;
}

// ==================== 导出 ====================
module.exports = {
  generateWeather,
  getContextQuestion,
  generateFeedback,
  mergeRealWeather,
  getDressingTip,
};
