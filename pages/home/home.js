const {
  getProfile,
  getRecords,
  dateKey
} = require('../../utils/store');
const { moods } = require('../../utils/moods');
const quotes = [
  '慢慢来，一切都会在合适的时候抵达。',
  '你已经做得很好了，别忘了拥抱自己。',
  '每一种情绪，都值得被温柔看见。',
  '今天也请把一点耐心留给自己。'
];
Page({
  data:{ 
    moods, 
    profile:null, 
    greeting:'', 
    clock:'', 
    todayRecords:[],
    weather:
      { city:'定位中', icon:'☁️', temp:'--' },
    quote:quotes[0]
  },
  onShow() {
    const profile = getProfile();
    console.log("profile =", profile);
    console.log("avatar =", profile && profile.avatar);
    this.setData({
      profile,
      quote: quotes[new Date().getDate() % quotes.length]
    });
    this.updateClock();
    clearInterval(this.timer);
    this.timer = setInterval(() => this.updateClock(), 60000);
    this.loadWeather();
    this.loadTodayRecords();
  },
  onUnload(){ 
    clearInterval(this.timer); 
  },
  updateClock(){ 
    const now=new Date(), 
    hour=now.getHours(); 
    const greeting=hour<5?'深夜好':hour<8?'清晨好':hour<12?'上午好':hour<18?'下午好':'晚上好'; const days=['日','一','二','三','四','五','六']; 
    this.setData({
      greeting,clock:`${now.getMonth()+1}月${now.getDate()}日 星期${days[now.getDay()]}  ${String(hour).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`
    }); 
  },
  loadWeather(){ 
    wx.getLocation({ 
      type:'gcj02', 
      success:() => this.setData({weather:{city:'当前位置',icon:'🌤️',temp:'--'}}), 
      fail:() => this.setData({weather:{city:'暂未授权定位',icon:'☁️',temp:'--'}}) 
    }); 
  },
  recordMood(e){ 
    wx.navigateTo({url:`/pages/record/record?mood=${encodeURIComponent(e.currentTarget.dataset.name)}`}); 
  },
  more(){ 
    wx.navigateTo({url:'/pages/record/record'}); 
  },
  loadTodayRecords(){
    const records = getRecords();
    const today = dateKey();
    const todayRecords = records
    .filter(item => item.date === today)
    .sort((a, b) => b.timestamp - a.timestamp);
    this.setData({
        todayRecords
    });
  },
});
