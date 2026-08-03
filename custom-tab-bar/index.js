Component({
  data: {
    selected: 0,
    list: [
      {
        pagePath: '/pages/home/home',
        text: '今日心情',
        icon: '☀️'
      },
      {
        pagePath: '/pages/calendar/calendar',
        text: '情绪日历',
        icon: '📅'
      },
      {
        pagePath: '/pages/insights/insights',
        text: '情绪分析',
        icon: '📊'
      },
      {
        pagePath: '/pages/profile/profile',
        text: '我的',
        icon: '🌿'
      }
    ]
  },

  methods: {
    switchTab(e) {
      const index = e.currentTarget.dataset.index;
      const path = e.currentTarget.dataset.path;
      if (index === this.data.selected) return;
      this.setData({ selected: index });
      wx.switchTab({ url: path });
    }
  }
});
