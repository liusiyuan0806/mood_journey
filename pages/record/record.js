const { moods, byName } = require('../../utils/moods');
const { getRecords, saveRecord } = require('../../utils/store');
const { generateWeather } = require('../../utils/weather');

// 根据天气类型和昼夜计算 CSS class 名（WXSS 中预定义渐变）
function getWeatherBgClass(cat, isNight) {
  if (isNight) return 'weather-bg-night';
  const map = {
    sunny: 'weather-bg-sunny',
    cloudy: 'weather-bg-cloudy',
    rainy: 'weather-bg-rainy',
    snowy: 'weather-bg-snowy',
    foggy: 'weather-bg-foggy',
    stormy: 'weather-bg-stormy',
    windy: 'weather-bg-windy',
  };
  return map[cat] || 'weather-bg-sunny';
}

// 获取缓存的天气数据（当天，且缓存不超过1小时）
function getCachedWeather() {
  const cached = wx.getStorageSync('cached_weather');
  if (!cached) return null;
  const now = Date.now();
  const oneHour = 60 * 60 * 1000;
  if (now - cached.cachedAt > oneHour) return null;
  const cachedDate = new Date(cached.cachedAt).toDateString();
  const today = new Date().toDateString();
  if (cachedDate !== today) return null;
  return cached;
}

Page({
  data: {
    moods,
    date: '',
    time: '',
    selected: '',
    note: '',
    weather: '晴天',
    location: '家里',
    triggers: [],
    images: [],
    today: '',
    weatherOptions: ['晴天', '阴天', '雨天', '雪天', '多云', '雷阵雨', '雾', '大风'],
    locationOptions: ['家里', '公司', '学校', '咖啡厅', '公园', '健身房', '商场', '餐厅', '医院', '户外', '地铁', '酒店', '机场', '车站'],

    // 天气快照
    weatherSnapshot: null,

    // 天气影响
    weatherImpact: '',
    weatherImpactOptions: ['无', '轻微', '明显', '不确定'],

    // 身体感受
    bodyFeelings: [],
    bodyFeelingMap: {},
    bodyFeelingOptions: ['困倦', '头痛', '闷', '舒适', '没精神', '精力充足', '乏力', '清爽', '燥热', '寒冷'],

    // 情绪诱因（三部分）
    triggerGroups: {
      positive: {
        label: '正面影响',
        icon: '🌱',
        color: '#52C41A',
        options: ['工作成就', '恋爱甜蜜', '友情温暖', '学习进步', '健康活力', '美好回忆']
      },
      negative: {
        label: '负面影响',
        icon: '💢',
        color: '#F5222D',
        options: ['工作压力', '感情困扰', '人际冲突', '学习焦虑', '身体不适', '经济压力', '孤独感', '自我怀疑', '突发事件']
      },
      neutral: {
        label: '中性影响',
        icon: '🔵',
        color: '#1890FF',
        options: ['天气变化', '生活琐事', '环境影响', '作息改变', '信息过载', '无特别原因']
      }
    },
    triggerCategory: '',
    triggerItems: [],
    triggerItemMap: {},

    // 录音
    isRecording: false,
    recordDuration: 0,
    recordTimer: null,
    audioPath: '',
    audioDuration: 0,
    isPlaying: false,

    // 定位
    currentAddress: '',
    latitude: null,
    longitude: null,

    // ===== Emoji 装饰映射（新增，不修改原有内容）=====
    weatherEmojiMap: { '晴天': '☀️', '阴天': '☁️', '雨天': '🌧️', '雪天': '❄️', '多云': '⛅', '雷阵雨': '⛈️', '雾': '🌫️', '大风': '💨' },
    locationEmojiMap: { '家里': '🏠', '公司': '🏢', '学校': '🏫', '咖啡厅': '☕', '公园': '🌳', '健身房': '🏋️', '商场': '🛍️', '餐厅': '🍽️', '医院': '🏥', '户外': '🏕️', '地铁': '🚇', '酒店': '🏨', '机场': '✈️', '车站': '🚉' },
    impactEmojiMap: { '无': '○', '轻微': '🌿', '明显': '🌧️', '不确定': '❓' },
    bodyFeelingEmojiMap: { '困倦': '😴', '头痛': '🤕', '闷': '😣', '舒适': '😌', '没精神': '😪', '精力充足': '💪', '乏力': '🥱', '清爽': '🍃', '燥热': '🥵', '寒冷': '🥶' },
    triggerEmojiMap: {
      '工作成就': '🏆', '恋爱甜蜜': '💕', '友情温暖': '🤝', '学习进步': '📚', '健康活力': '🏃', '美好回忆': '📷',
      '工作压力': '💼', '感情困扰': '💔', '人际冲突': '⚡', '学习焦虑': '📝', '身体不适': '🤒', '经济压力': '💰', '孤独感': '🌙', '自我怀疑': '🪞', '突发事件': '⚠️',
      '天气变化': '🌡️', '生活琐事': '🧹', '环境影响': '🏠', '作息改变': '⏰', '信息过载': '📱', '无特别原因': '🤷'
    },
  },

  onLoad(q) {
    try {
      const all = getRecords();
      const now = new Date();
      const pad = n => String(n).padStart(2, '0');
      const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
      const currentTime = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
      const date = q.date || today;

      // 优先使用缓存中的真实天气，否则用模拟数据
      const cached = getCachedWeather();
      let weatherData = cached || generateWeather(new Date(date));

      // 构建天气快照
      const weatherSnapshot = this.buildWeatherSnapshot(weatherData);

      if (q.id) {
        const old = all.find(item => item.id === q.id);
        if (old) {
          this.setData({
            id: old.id,
            createdAt: old.createdAt,
            date: old.date,
            today: old.date,
            selected: old.mood,
            note: old.note || '',
            weather: old.weather || '晴天',
            location: old.location || '家里',
            timestamp: old.timestamp,
            triggers: old.triggers || [],
            time: old.time || currentTime,
            images: old.images || [],
            weatherImpact: old.weatherImpact || '',
            weatherSnapshot: old.weatherSnapshot || weatherSnapshot,
            bodyFeelings: old.bodyFeelings || [],
            bodyFeelingMap: this.buildMap(old.bodyFeelings || []),
            triggerCategory: old.triggerCategory || '',
            triggerItems: old.triggerItems || [],
            triggerItemMap: this.buildMap(old.triggerItems || []),
            audioPath: old.audioPath || '',
            audioDuration: old.audioDuration || 0,
            currentAddress: old.currentAddress || '',
            latitude: old.latitude || null,
            longitude: old.longitude || null,
          });
        }
        wx.setNavigationBarTitle({ title: '编辑记录' });
        return;
      }

      // 新建记录
      this.setData({
        date,
        today,
        time: currentTime,
        selected: q.mood ? decodeURIComponent(q.mood) : '',
        note: '',
        weather: weatherSnapshot.weatherText || '晴天',
        location: '家里',
        triggers: [],
        images: [],
        weatherImpact: '',
        weatherSnapshot,
        bodyFeelings: [],
        bodyFeelingMap: {},
        triggerCategory: '',
        triggerItems: [],
        triggerItemMap: {},
        audioPath: '',
        audioDuration: 0,
        currentAddress: '',
        latitude: null,
        longitude: null,
      });

      wx.setNavigationBarTitle({ title: '记录心情' });

      // 尝试获取真实定位
      this.fetchLocationAndWeather();
    } catch (err) {
      console.error('onLoad error:', err);
    }
  },

  // 构建天气快照
  buildWeatherSnapshot(weatherData) {
    const now = new Date();
    const hour = now.getHours();
    const isNight = hour < 6 || hour >= 19;
    const aqiClassMap = {
      '优': 'good',
      '良': 'moderate',
      '轻度污染': 'light-pollution',
      '中度污染': 'heavy-pollution',
      '重度污染': 'severe',
      '严重污染': 'severe'
    };
    const aqiLevel = weatherData.aqiLevel || '优';
    const category = weatherData.weatherCategory || 'sunny';

    return {
      weatherText: weatherData.weatherText || '晴',
      weatherIcon: weatherData.weatherIcon || '☀️',
      weatherCategory: category,
      bgClass: getWeatherBgClass(category, isNight),
      temp: weatherData.temp || 25,
      feelsLike: weatherData.feelsLike || 26,
      humidity: weatherData.humidity || 50,
      wind: weatherData.wind || '微风 1级',
      windLevel: weatherData.windLevel || 1,
      aqi: weatherData.aqi || 50,
      aqiLevel: aqiLevel,
      aqiClass: aqiClassMap[aqiLevel] || 'good',
      isNight: isNight,
      hasWarning: weatherData.hasWarning || false,
      warningText: weatherData.warningText || '',
      pressure: weatherData.pressure || (1000 + Math.floor(Math.random() * 30)),
      cachedAt: Date.now(),
    };
  },

  // 获取定位（仅获取经纬度）
  fetchLocationAndWeather() {
    wx.getLocation({
      type: 'gcj02',
      success: (res) => {
        const { latitude, longitude } = res;
        this.setData({ latitude, longitude });
      },
      fail: () => {
        // 用户拒绝定位，使用默认天气
      }
    });
  },

  // 选择当前位置
  chooseLocation() {
    wx.chooseLocation({
      success: (res) => {
        this.setData({
          currentAddress: res.name || res.address,
          latitude: res.latitude,
          longitude: res.longitude,
        });
      },
      fail: (err) => {
        if (err.errMsg && err.errMsg.includes('cancel')) return;
        wx.showToast({ title: '选择位置失败', icon: 'none' });
      }
    });
  },

  buildMap(arr) {
    const map = {};
    if (arr && arr.length) arr.forEach(v => map[v] = true);
    return map;
  },

  select(e) {
    this.setData({ selected: e.currentTarget.dataset.name });
  },

  input(e) {
    this.setData({ note: e.detail.value });
  },

  // 天气标签选择 / picker 修正
  pickWeatherFromTag(e) {
    let weatherText;
    if (e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.value) {
      weatherText = e.currentTarget.dataset.value;
    } else if (e.detail && e.detail.value !== undefined) {
      weatherText = this.data.weatherOptions[e.detail.value];
    } else {
      return;
    }
    const categoryMap = {
      '晴天': 'sunny', '阴天': 'cloudy', '雨天': 'rainy', '雪天': 'snowy',
      '多云': 'sunny', '雷阵雨': 'stormy', '雾': 'foggy', '大风': 'windy'
    };
    const category = categoryMap[weatherText] || 'sunny';
    const snapshot = {
      ...this.data.weatherSnapshot,
      weatherText,
      weatherCategory: category,
      bgClass: getWeatherBgClass(category, this.data.weatherSnapshot.isNight)
    };
    this.setData({ weather: weatherText, weatherSnapshot: snapshot });
  },

  // 地点标签选择
  pickLocationFromTag(e) {
    this.setData({ location: e.currentTarget.dataset.value });
  },

  // 天气影响选择
  pickWeatherImpact(e) {
    const value = e.currentTarget.dataset.value;
    this.setData({ weatherImpact: value });
  },

  // 身体感受选择（最多3个）
  toggleBodyFeeling(e) {
    const value = e.currentTarget.dataset.value;
    const old = this.data.bodyFeelings;
    const has = old.includes(value);
    if (!has && old.length >= 3) {
      return wx.showToast({ title: '最多选择3个', icon: 'none' });
    }
    const newBodyFeelings = has ? old.filter(v => v !== value) : old.concat(value);
    this.setData({
      bodyFeelings: newBodyFeelings,
      bodyFeelingMap: this.buildMap(newBodyFeelings)
    });
  },

  // 情绪诱因分类选择
  selectTriggerCategory(e) {
    const category = e.currentTarget.dataset.category;
    this.setData({ triggerCategory: category });
  },

  // 情绪诱因项目选择
  toggleTriggerItem(e) {
    const value = e.currentTarget.dataset.value;
    const old = this.data.triggerItems;
    const has = old.includes(value);
    if (!has && old.length >= 3) {
      return wx.showToast({ title: '最多选择3个诱因', icon: 'none' });
    }
    const newTriggerItems = has ? old.filter(v => v !== value) : old.concat(value);
    this.setData({
      triggerItems: newTriggerItems,
      triggerItemMap: this.buildMap(newTriggerItems)
    });
  },

  changeDate(e) {
    this.setData({ date: e.detail.value });
  },

  changeTime(e) {
    this.setData({ time: e.detail.value });
  },

  images() {
    wx.chooseImage({
      count: 9 - this.data.images.length,
      sizeType: ['compressed'],
      success: r => this.setData({ images: this.data.images.concat(r.tempFilePaths) })
    });
  },

  removeImage(e) {
    const images = this.data.images;
    images.splice(e.currentTarget.dataset.index, 1);
    this.setData({ images });
  },

  // ========== 录音功能 ==========
  startRecord() {
    const recorderManager = wx.getRecorderManager();
    this.setData({ isRecording: true, recordDuration: 0 });

    this.data.recordTimer = setInterval(() => {
      this.setData({ recordDuration: this.data.recordDuration + 1 });
    }, 1000);

    recorderManager.start({
      duration: 60000,
      sampleRate: 44100,
      numberOfChannels: 1,
      encodeBitRate: 192000,
      format: 'mp3'
    });

    recorderManager.onStop((res) => {
      clearInterval(this.data.recordTimer);
      this.setData({
        isRecording: false,
        audioPath: res.tempFilePath,
        audioDuration: this.data.recordDuration,
        recordDuration: 0
      });
      wx.showToast({ title: '录音完成', icon: 'success' });
    });

    recorderManager.onError(() => {
      clearInterval(this.data.recordTimer);
      this.setData({ isRecording: false, recordDuration: 0 });
      wx.showToast({ title: '录音失败', icon: 'none' });
    });
  },

  stopRecord() {
    const recorderManager = wx.getRecorderManager();
    recorderManager.stop();
  },

  playAudio() {
    if (!this.data.audioPath) return;
    const innerAudioContext = wx.createInnerAudioContext();
    innerAudioContext.src = this.data.audioPath;
    this.setData({ isPlaying: true });
    innerAudioContext.play();
    innerAudioContext.onEnded(() => {
      this.setData({ isPlaying: false });
      innerAudioContext.destroy();
    });
    innerAudioContext.onError(() => {
      this.setData({ isPlaying: false });
      innerAudioContext.destroy();
    });
  },

  deleteAudio() {
    this.setData({ audioPath: '', audioDuration: 0, isPlaying: false });
  },

  save() {
    if (!this.data.selected) return wx.showToast({ title: '请选择一种心情', icon: 'none' });
    const mood = byName(this.data.selected);
    const timestamp = new Date(this.data.date + ' ' + this.data.time).getTime();

    const recordId = this.data.id || Date.now().toString();
    const isNew = !this.data.id;

    saveRecord({
      id: recordId,
      date: this.data.date,
      time: this.data.time,
      timestamp: timestamp,
      mood: mood.name,
      emoji: mood.emoji,
      note: this.data.note,
      weather: this.data.weather,
      weatherText: this.data.weatherSnapshot?.weatherText || this.data.weather,
      weatherCategory: this.data.weatherSnapshot?.weatherCategory || 'sunny',
      location: this.data.location,
      triggers: this.data.triggers,
      images: this.data.images,
      createdAt: this.data.createdAt || Date.now(),
      updatedAt: Date.now(),
      weatherImpact: this.data.weatherImpact || '',
      weatherSnapshot: this.data.weatherSnapshot,
      bodyFeelings: this.data.bodyFeelings,
      triggerCategory: this.data.triggerCategory,
      triggerItems: this.data.triggerItems,
      audioPath: this.data.audioPath,
      audioDuration: this.data.audioDuration,
      currentAddress: this.data.currentAddress,
      latitude: this.data.latitude,
      longitude: this.data.longitude,
    });

    if (isNew && !this.data.weatherImpact) {
      wx.setStorageSync('pending_weather_impact_id', recordId);
    }

    wx.showToast({ title: '已保存' });
    setTimeout(() => wx.navigateBack(), 500);
  },
});
