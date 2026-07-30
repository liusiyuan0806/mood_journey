const { moods, byName } = require('../../utils/moods'); 
const { getRecords, saveRecord, dateKey } = require('../../utils/store');

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
    triggerOptions:['工作','学习','家人','朋友','健康','睡眠','金钱','成长','天气']
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
          images:old.images||[]
        });
      }
      wx.setNavigationBarTitle({
        title:'编辑记录'
      });
      return;
    };
    
    // 找到当天所有记录
    
    this.setData({
      date,
      today,
      time: currentTime,
      selected: '',
      note: '',
      weather: '晴天',
      location: '家',
      triggers: [],
      images: []
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
    saveRecord({
      id: this.data.id || Date.now().toString(),
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
      updatedAt: Date.now()
  });
    wx.showToast({title:'已保存'});
    setTimeout(()=>wx.navigateBack(),500)
  },
  
});
