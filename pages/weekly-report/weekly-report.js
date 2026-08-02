const { getRecords } = require('../../utils/store');
const { generateWeeklyReport } = require('../../utils/weeklyReport');

Page({
  data: {
    report: null,
    loading: true
  },

  onShow() {
    this.loadReport();
  },

  loadReport() {
    this.setData({ loading: true });
    try {
      const records = getRecords();
      const report = generateWeeklyReport(records);
      this.setData({ report, loading: false });
    } catch (err) {
      console.error('[周报] 生成失败:', err);
      this.setData({ report: { empty: true }, loading: false });
    }
  },

  // 重新生成（刷新数据）
  refresh() {
    this.loadReport();
  },

  // 去记录心情
  goRecord() {
    wx.switchTab({ url: '/pages/home/home' });
  },

  // 去晴雨表看更多分析
  goInsights() {
    wx.switchTab({ url: '/pages/insights/insights' });
  },

  // 下拉刷新
  onPullDownRefresh() {
    this.loadReport();
    wx.stopPullDownRefresh();
  }
});
