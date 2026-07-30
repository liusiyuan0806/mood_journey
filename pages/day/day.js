const { getRecords } = require('../../utils/store');
Page({
  data:{
    date:'',
    records:[],
    selected:null
  },
  onLoad(options){
    this.loadData(options.date);
  },
  onShow(){
    if(this.data.date){
      this.loadData(this.data.date);
    }
  },
  loadData(date){
    const all = getRecords();
    const records = all
    .filter(item => item.date === date)
    .sort((a,b)=>{
      return a.timestamp - b.timestamp;
    });
    this.setData({
      date,
      records
    });
  },
  choose(e){
    this.setData({
      selected:e.currentTarget.dataset.record
    });
  },
  addRecord(){
    const periods = this.data.records.map(item => item.period);
    const complete =
    periods.includes('上午') &&
    periods.includes('下午') &&
    periods.includes('晚上');
    if (complete) {
      wx.showModal({
        title: '今日记录已完成',
        content: '上午、下午、晚上都已经记录，如需修改，请点击对应记录进行编辑。',
        showCancel: false
    });
    return;
    }
    wx.navigateTo({
      url:'/pages/record/record?date=' + this.data.date
    });
  },
  editRecord(e){
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url:'/pages/record/record?id=' + id
    });
  },
  close(){
    this.setData({
      selected:null
    });
  },
});