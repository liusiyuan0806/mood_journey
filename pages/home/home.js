const {
  getProfile,
  getRecords,
  dateKey,
  saveRecord
} = require('../../utils/store');
const { moods } = require('../../utils/moods');
const {
  generateWeather,
  getContextQuestion,
  generateFeedback,
  mergeRealWeather,
  generateForecast,
  generateWeatherAdvice
} = require('../../utils/weather');
const { quotes, randomQuote } = require('../../utils/quotes');
Page({
  data:{ 
    moods, 
    profile:null, 
    greeting:'', 
    clock:'', 
    todayRecords:[],
    weather:
      { city:'定位中', icon:'☁️', temp:'--' },
    quote:quotes[0],
    quoteFavorited:false, // 当前这句话是否已被收藏

    // ===== 三层升级新增数据 =====
    // 第一层：完整天气数据
    weatherData: null,
    isRealWeather: false,
    // 第二层：情境提问 & 天气影响追问（记录页保存后回首页才显示）
    contextQuestion: '此刻的你，是什么心情？',
    showWeatherImpact: false,
    weatherImpactOptions: [
      { value: '没感觉', label: '没感觉' },
      { value: '有一点', label: '有一点' },
      { value: '很明显', label: '很明显' },
      { value: '说不清', label: '说不清' },
    ],
    // 第三层：即时反馈（天气影响问答后显示）
    showFeedback: false,
    feedbackText: '',

    // ===== 天气前瞻与微行动 =====
    weatherAdvice: null,
    showAdvice: true,
  },
  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 0 });
    }
    const profile = getProfile();
    this.setData({
      profile,
      quote: quotes[new Date().getDate() % quotes.length],
      quoteFavorited: this._isQuoteFavorited(quotes[new Date().getDate() % quotes.length])
    });
    this.updateClock();
    clearInterval(this.timer);
    this.timer = setInterval(() => this.updateClock(), 60000);
    this.loadWeather();
    this.loadTodayRecords();
    this.loadForecastAdvice();

    // 先检查是否需要显示天气影响追问（记录页保存后回来）
    this.checkPendingWeatherImpact();
  },
  onUnload(){ 
    clearInterval(this.timer); 
    clearTimeout(this._feedbackTimer);
  },
  updateClock(){ 
    const now=new Date(), 
    hour=now.getHours(); 
    const greeting=hour<5?'深夜好':hour<8?'清晨好':hour<12?'上午好':hour<18?'下午好':'晚上好'; 
    const days=['日','一','二','三','四','五','六']; 
    this.setData({
      greeting,
      clock:`${now.getMonth()+1}月${now.getDate()}日 星期${days[now.getDay()]}  ${String(hour).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`
    }); 
  },

  // ===== 天气前瞻与微行动建议 =====

  loadForecastAdvice() {
    try {
      // 1. 获取今天的天气文案（可以是模拟数据，也可以是真实天气数据）
      const weatherData = this.data.weatherData;
      const todayWeatherText = weatherData
        ? (weatherData.weatherText || weatherData.weatherSnapshot?.weatherText || '晴')
        : '晴';

      // 2. 生成明日预报（模拟）
      const forecast = generateForecast(todayWeatherText);

      // 3. 获取历史记录并生成建议
      let records;
      try { records = getRecords(); } catch (e) { records = []; }
      const advice = generateWeatherAdvice(forecast, records, todayWeatherText);

      // 4. 清除旧数据
      try { wx.removeStorageSync('advice_dismissed_at'); } catch (e) {}

      this.setData({
        weatherAdvice: advice,
        showAdvice: !!advice
      });
    } catch (err) {
      console.error('[天气前瞻] 生成失败:', err);
      const fallback = {
        forecast: {
          weatherText: '未知',
          weatherIcon: '🌤️',
          tempRange: '--',
          humidity: 50
        },
        title: '明日天气前瞻',
        body: '无论什么天气，你都可以选择温柔对待自己。',
        tags: ['温柔对待自己'],
        level: 'gentle'
      };
      this.setData({
        weatherAdvice: fallback,
        showAdvice: true
      });
    }
  },

  // 去记录此刻心情
  goRecordNow() {
    wx.navigateTo({ url: '/pages/record/record' });
  },

  // ===== 加载天气 =====
  loadWeather(){
    const now = new Date();
    let weatherData = generateWeather(now);
    this.applyWeather(weatherData, false);

    wx.getLocation({
      type: 'gcj02',
      success: (res) => {
        const { latitude, longitude } = res;
        weatherData.city = '定位中…';
        this.applyWeather(weatherData, false);
        this.fetchRealWeather(latitude, longitude, weatherData);
      },
      fail: (err) => {
        console.warn('定位失败，使用默认城市（北京）获取天气:', err.errMsg);
        weatherData.city = '北京市';
        this.applyWeather(weatherData, false);
        this.fetchRealWeather(39.9042, 116.4074, weatherData);
      }
    });
  },

  pickLocation() {
    if (!wx.chooseLocation) {
      wx.showToast({ title: '当前微信版本不支持', icon: 'none' });
      return;
    }
    wx.chooseLocation({
      success: (res) => {
        const { latitude, longitude, address } = res;
        const cityMatch = address.match(/([^市]+市)/) || address.match(/([^区]+区)/);
        const city = cityMatch ? cityMatch[1] : address.split('市')[0] + '市';
        const baseData = wx.getStorageSync('cached_weather') || generateWeather(new Date());
        baseData.city = city;
        this.applyWeather(baseData, false);
        this.fetchRealWeather(latitude, longitude, baseData);
      },
      fail: () => {}
    });
  },

  fetchRealWeather(latitude, longitude, baseWeatherData) {
    if (!wx.cloud) {
      console.warn('云开发未初始化，使用模拟天气数据');
      if (baseWeatherData.city === '定位中…') {
        baseWeatherData.city = '你的城市';
        this.applyWeather(baseWeatherData, false);
      }
      return;
    }

    // ===== 本地城市缓存策略 =====
    // 把坐标按 ~10km 精度取整，作为缓存 key
    // 用户在同城/同区活动时直接用缓存，不再调用腾讯地图（省配额）
    const cacheKey = `${latitude.toFixed(1)}_${longitude.toFixed(1)}`;
    const cityCache = wx.getStorageSync('city_cache') || {};
    const cachedCity = cityCache[cacheKey];
    const CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 缓存 7 天

    // 如果缓存命中且未过期，且不是首次加载，使用缓存的城市
    const useCache = cachedCity && (Date.now() - cachedCity.timestamp < CACHE_DURATION);
    if (useCache) {
      console.log('📦 使用本地城市缓存:', cachedCity.city);
      wx.cloud.callFunction({
        name: 'getWeather',
        data: {
          latitude,
          longitude,
          skipGeo: true,           // 跳过腾讯地图 API 调用
          clientCity: cachedCity.city // 直接用缓存的城市名
        },
        config: { timeout: 8000 }
      }).then(res => this._handleWeatherResponse(res, baseWeatherData, latitude, longitude, cacheKey))
        .catch(err => this._handleWeatherError(err, baseWeatherData));
      return;
    }

    // 缓存未命中，正常调用（让云函数去查腾讯地图）
    wx.cloud.callFunction({
      name: 'getWeather',
      data: { latitude, longitude },
      config: { timeout: 8000 }
    }).then(res => this._handleWeatherResponse(res, baseWeatherData, latitude, longitude, cacheKey))
      .catch(err => this._handleWeatherError(err, baseWeatherData));
  },

  // 统一处理云函数返回
  _handleWeatherResponse(res, baseWeatherData, latitude, longitude, cacheKey) {
    if (res.result && res.result.success) {
      const realData = res.result.data;
      const merged = mergeRealWeather(baseWeatherData, realData);
      merged.city = realData.city || (baseWeatherData.city === '定位中…' ? '你的城市' : baseWeatherData.city);
      this.applyWeather(merged, true);
      console.log('✅ 已获取真实天气数据，城市:', merged.city);

      // 缓存城市（仅当确实拿到真实城市时）
      if (realData.city) {
        this._cacheCity(cacheKey, realData.city);
      }
    } else {
      console.warn('云函数返回失败:', res.result?.error);
      if (baseWeatherData.city === '定位中…') {
        baseWeatherData.city = '你的城市';
        this.applyWeather(baseWeatherData, false);
      }
    }
  },

  _handleWeatherError(err, baseWeatherData) {
    console.warn('云函数调用失败:', err.errMsg || err.message);
    if (baseWeatherData.city === '定位中…') {
      baseWeatherData.city = '你的城市';
      this.applyWeather(baseWeatherData, false);
    }
  },

  // 缓存城市到本地存储
  _cacheCity(cacheKey, city) {
    const cityCache = wx.getStorageSync('city_cache') || {};
    cityCache[cacheKey] = { city, timestamp: Date.now() };
    wx.setStorageSync('city_cache', cityCache);
    console.log('💾 已缓存城市:', cacheKey, '→', city);
  },

  applyWeather(weatherData, isReal) {
    const contextQuestion = getContextQuestion(weatherData);
    wx.setStorageSync('cached_weather', { ...weatherData, cachedAt: Date.now() });
    this.setData({
      weatherData, isRealWeather: isReal, contextQuestion,
      weather: { city: weatherData.city, icon: weatherData.weatherIcon, temp: weatherData.temp + '°' }
    });
  },

  // ===== 最新流程：选择心情 → 直接跳转记录页 → 保存后回首页 → 显示天气影响追问 → 显示反馈 =====

  // 心情选择 → 直接跳转记录页
  selectMood(e){
    const moodName = e.currentTarget.dataset.mood || e.currentTarget.dataset.name;
    wx.vibrateShort({ type: 'light' });
    wx.navigateTo({
      url: `/pages/record/record?mood=${encodeURIComponent(moodName)}`
    });
  },

  // 原有：更多记录（"写下更多"按钮）
  more(){
    wx.navigateTo({ url: '/pages/record/record' });
  },

  // ===== 每日一句：换一句 / 收藏 / 取消收藏 =====

  // 换一句（不重复当前）
  refreshQuote() {
    const current = this.data.quote;
    let next = current;
    // 最多重试 5 次避免死循环
    for (let i = 0; i < 5 && next === current; i++) {
      next = quotes[Math.floor(Math.random() * quotes.length)];
    }
    this.setData({
      quote: next,
      quoteFavorited: this._isQuoteFavorited(next)
    });
    // 轻震动反馈
    if (wx.vibrateShort) wx.vibrateShort({ type: 'light' });
  },

  // 切换收藏
  toggleFavoriteQuote() {
    const quote = this.data.quote;
    if (!quote) return;
    const list = wx.getStorageSync('favorite_quotes') || [];
    const idx = list.findIndex(item => item.text === quote);
    let favorited;
    if (idx >= 0) {
      // 已收藏 → 取消
      list.splice(idx, 1);
      favorited = false;
      wx.showToast({ title: '已取消收藏', icon: 'none', duration: 1200 });
    } else {
      // 未收藏 → 加入（按时间倒序）
      list.unshift({
        text: quote,
        time: Date.now()
      });
      favorited = true;
      wx.showToast({ title: '已收藏到「我的」', icon: 'success', duration: 1200 });
    }
    wx.setStorageSync('favorite_quotes', list);
    this.setData({ quoteFavorited: favorited });
    // 轻震动反馈
    if (wx.vibrateShort) wx.vibrateShort({ type: 'light' });
  },

  // 工具：判断某句话是否已收藏
  _isQuoteFavorited(text) {
    const list = wx.getStorageSync('favorite_quotes') || [];
    return list.some(item => item.text === text);
  },

  // 检查是否有新创建的记录需要补充天气影响数据
  checkPendingWeatherImpact() {
    const pendingId = wx.getStorageSync('pending_weather_impact_id');
    if (!pendingId) {
      // 没有待处理的记录，走正常反馈流程
      this.checkNewFeedback();
      return;
    }
    // 清除标记，避免重复弹
    wx.removeStorageSync('pending_weather_impact_id');

    // 检查该记录是否存在且未填写天气影响
    const records = getRecords();
    const record = records.find(r => r.id === pendingId);
    if (!record || record.weatherImpact) {
      // 已有天气影响或记录不存在，直接走反馈
      this.checkNewFeedback();
      return;
    }

    // 显示天气影响追问面板
    this.setData({ showWeatherImpact: true });
    // 把记录 ID 缓存到 data，供后续保存用
    this._pendingRecordId = pendingId;
    this._pendingRecord = record;

    // 滚动到面板
    setTimeout(() => {
      wx.pageScrollTo({ selector: '.weather-impact-panel', duration: 300 });
    }, 200);
  },

  // 用户回答天气影响 → 更新记录 → 显示反馈
  answerWeatherImpact(e) {
    const impact = e.currentTarget.dataset.value;
    this.setData({ showWeatherImpact: false });
    this._saveWeatherImpact(impact);
  },

  skipWeatherImpact() {
    this.setData({ showWeatherImpact: false });
    this._saveWeatherImpact(''); // 空值表示跳过
  },

  _saveWeatherImpact(impact) {
    if (!this._pendingRecord) {
      this.checkNewFeedback();
      return;
    }
    // 更新已有记录，补上天气影响字段
    const updatedRecord = {
      ...this._pendingRecord,
      weatherImpact: impact,
      updatedAt: Date.now()
    };
    saveRecord(updatedRecord);

    // 生成反馈并显示
    this._showFeedbackForRecord(updatedRecord);
    this._pendingRecord = null;
    this._pendingRecordId = null;
  },

  // ===== 加载今日记录 =====
  loadTodayRecords(){
    const records = getRecords();
    const today = dateKey();
    const todayRecords = records
      .filter(item => item.date === today)
      .sort((a, b) => b.timestamp - a.timestamp);
    this.setData({ todayRecords });
  },

  // ===== 第三层：反馈（没有待处理天气影响时直接触发）=====
  checkNewFeedback() {
    const records = getRecords();
    if (records.length === 0) return;
    
    const latest = records.reduce((a, b) => 
      (b.timestamp || b.createdAt) > (a.timestamp || a.createdAt) ? b : a
    );

    const shownFeedbackFor = wx.getStorageSync('shown_feedback_id');
    if (shownFeedbackFor === latest.id) return;
    if (!latest.weatherCategory) return;

    this._showFeedbackForRecord(latest);
  },

  _showFeedbackForRecord(record) {
    const records = getRecords();
    const feedbackText = generateFeedback(record, records);

    this.setData({ showFeedback: true, feedbackText }, () => {
      wx.pageScrollTo({ selector: '.feedback-card', duration: 300 });
    });

    wx.setStorageSync('shown_feedback_id', record.id);

    clearTimeout(this._feedbackTimer);
    this._feedbackTimer = setTimeout(() => {
      this.setData({ showFeedback: false });
    }, 8000);
  },

  dismissFeedback() {
    this.setData({ showFeedback: false });
  },
});
