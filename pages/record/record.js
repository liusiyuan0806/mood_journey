const { moods, byName } = require('../../utils/moods'); 
const { getRecords, saveRecord, dateKey } = require('../../utils/store');
const { generateWeather, mergeRealWeather } = require('../../utils/weather');

// 获取缓存的天气数据（当天，且缓存不超过1小时）
function getCachedWeather() {
  const cached = wx.getStorageSync('cached_weather');
  if (!cached) return null;
  const now = Date.now();
  const oneHour = 60 * 60 * 1000;
  if (now - cached.cachedAt > oneHour) return null;
  // 检查是否同一天
  const cachedDate = new Date(cached.cachedAt).toDateString();
  const today = new Date().toDateString();
  if (cachedDate !== today) return null;
  return cached;
}

Page({
  data:{moods,
    date:'',
    time:'',
    selected:'',
    note:'',
    weather:'晴天',
    location:'家',
    triggers:[],
    images:[],
    today: '',
    weatherOptions:['晴天','阴天','雨天','雪天'],
    locationOptions:['家','公司','学校','户外'],
    triggerOptions:['工作','学习','家人','朋友','健康','睡眠','金钱','成长','天气'],
    // 新增：天气影响数据
    weatherImpact: '',
    weatherCategory: '',
    weatherText: '',
  },
  
  
  onLoad(q) {
    const all = getRecords();
    const now = new Date();
    const pad = n => String(n).padStart(2, '0');
    const today =
      `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}`;
    const currentTime =
      `${pad(now.getHours())}:${pad(now.getMinutes())}`;
    const date = q.date || today;

    // 优先使用缓存中的真实天气，否则用模拟数据
    const cached = getCachedWeather();
    let weatherData;
    if (cached) {
      weatherData = cached;
    } else {
      weatherData = generateWeather(new Date(date));
    }
    
    if(q.id){
      const old = all.find(item=>item.id===q.id);
      if(old){
        this.setData({
          id:old.id,
          createdAt:old.createdAt,
          date:old.date,
          today:old.date,
          selected:old.mood,
          note:old.note,
          weather:old.weather,
          location:old.location,
          timestamp: old.timestamp,
          triggers:old.triggers||[],
          time: old.time || currentTime,
          images:old.images||[],
          weatherImpact: old.weatherImpact || '',
          weatherCategory: old.weatherCategory || weatherData.weatherCategory,
          weatherText: old.weatherText || weatherData.weatherText
        });
      }
      wx.setNavigationBarTitle({
        title:'编辑记录'
      });
      return;
    };
    
    // 新建记录：接受 mood 参数（天气影响不再从URL传入，回首页后再问）
    this.setData({
      date,
      today,
      time: currentTime,
      selected: q.mood ? decodeURIComponent(q.mood) : '',
      note: '',
      weather: '晴天',
      location: '家',
      triggers: [],
      images: [],
      weatherImpact: '',
      weatherCategory: weatherData.weatherCategory,
      weatherText: weatherData.weatherText
    });
  
    wx.setNavigationBarTitle({
  
      title: '记录心情'
  
    });
  
  },
  select(e){
    this.setData({selected:e.currentTarget.dataset.name})
  },
  input(e){
    this.setData({note:e.detail.value})
  },
  pickWeather(e){
    this.setData({weather:this.data.weatherOptions[e.detail.value]})
  },
  pickLocation(e){
    this.setData({location:this.data.locationOptions[e.detail.value]})
  },
  trigger(e){
    const value=e.currentTarget.dataset.value,
    old=this.data.triggers,
    has=old.includes(value);
    if(!has&&old.length>=3)return wx.showToast({title:'最多选择3个诱因',icon:'none'});
    this.setData({triggers:has?old.filter(v=>v!==value):old.concat(value)})
  },
  images(){
    wx.chooseImage({count:9-this.data.images.length,sizeType:['compressed'],
    success:r=>this.setData({images:this.data.images.concat(r.tempFilePaths)})})
  },
  removeImage(e){
    const images=this.data.images;
    images.splice(e.currentTarget.dataset.index,1);
    this.setData({images})
  },
  changeDate(e){
    this.setData({
      date: e.detail.value
    });
  },
  
  changeTime(e){
    this.setData({
      time: e.detail.value
    });
  },
  save(){
    if(!this.data.selected)return wx.showToast({title:'请选择一种心情',icon:'none'});
    const mood=byName(this.data.selected);
    const timestamp = new Date(
      this.data.date + " " + this.data.time
    ).getTime();

    // 优先使用缓存中的真实天气类别，否则生成模拟数据
    const cached = getCachedWeather();
    const weatherCategory = cached ? cached.weatherCategory : this.data.weatherCategory;
    const weatherText = cached ? cached.weatherText : (this.data.weatherText || '未知');
    
    const recordId = this.data.id || Date.now().toString();
    const isNew = !this.data.id; // 是否为新记录

    saveRecord({
      id: recordId,
      date:this.data.date,
      time:this.data.time,
      timestamp: timestamp,
      mood:mood.name,
      emoji:mood.emoji,
      note:this.data.note,
      weather:this.data.weather,
      location:this.data.location,
      triggers:this.data.triggers,
      images:this.data.images,
      createdAt: this.data.createdAt || Date.now(),
      updatedAt: Date.now(),
      weatherImpact: this.data.weatherImpact || '',
      weatherCategory: weatherCategory,
      weatherText: weatherText
    });

    // 新记录没有天气影响 → 标记待处理，回首页后追问
    if (isNew && !this.data.weatherImpact) {
      wx.setStorageSync('pending_weather_impact_id', recordId);
    }

    wx.showToast({title:'已保存'});
    setTimeout(()=>wx.navigateBack(),500)
  },
  
});
