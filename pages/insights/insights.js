const { getRecords, dateKey } = require('../../utils/store');
const { byName } = require('../../utils/moods');
const rangeStart=(type)=>{
  const d=new Date();
  if(type==='week')d.setDate(d.getDate()-6);
  if(type==='month')d.setMonth(d.getMonth()-1);
  if(type==='all')d.setFullYear(2000);return d
};
Page({
  data:{
    tab:'week',
    records:[],
    score:0,
    level:'开始记录',
    line:[],
    weather:[],
    warning:false
  },
  onShow(){
    this.refresh()
  },
  setTab(e){
    this.setData({
      tab:e.currentTarget.dataset.tab
    });
    this.refresh()
  },
  refresh(){
    const all=Object.values(getRecords()),
    from=rangeStart(this.data.tab),
    records=all.filter(r=>new Date(r.date)>=from).sort((a,b)=>a.date.localeCompare(b.date));
    if(!records.length)return 
    this.setData({
      records,
      score:0,
      level:'开始记录',
      line:[],
      weather:[],
      warning:false
    });
    const scores=records.map(r=>byName(r.mood).score),
    avg=scores.reduce((a,b)=>a+b,0)/scores.length,
    std=Math.sqrt(scores.reduce((s,n)=>s+(n-avg)**2,0)/scores.length);
    let low=0;
    for(let i=scores.length-1;i>=0&&scores[i]<=2;i--)low++;
    const score=Math.max(0,Math.min(100,Math.round(avg/5*100-std*3-low)));
    const weather={晴:[],雨:[],阴:[]};
    records.forEach(r=>{const key=(r.weather||'晴').includes('雨')?'雨':(r.weather||'晴').includes('阴')?'阴':'晴';
    weather[key].push(byName(r.mood).score)});
    this.setData({
      records,
      score,
      level:score>=80?'优秀':score>=60?'良好':score>=40?'注意':'关怀',
      line:records.map(r=>({date:r.date.slice(5),height:`${byName(r.mood).score*18}%`,score:byName(r.mood).score})),weather:Object.keys(weather).map(k=>({name:k,value:weather[k].length?Math.round(weather[k].reduce((a,b)=>a+b,0)/weather[k].length*20):0})),
      warning:low>=3
    });
  },
  goRecord(){
    wx.switchTab({url:'/pages/home/home'})
  }
});
