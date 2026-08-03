Page({
  data: {
    current: 0,
    steps: [
      {
        icon: '🌿',
        title: '欢迎来到情绪手账',
        desc: '这里是你私人的情绪花园\n记录每一刻的心情\n让它陪伴你成长',
        color: '#8FBC5A'
      },
      {
        icon: '🌤️',
        title: '天气联动心情',
        desc: '我们会自动获取当地天气\n天气和心情有着奇妙的关联\n记录下来，你会发现规律',
        color: '#F0B27A'
      },
      {
        icon: '🌳',
        title: '情绪树会陪你成长',
        desc: '每次记录心情\n你的情绪树就会长出一颗果实\n颜色代表心情，大小代表笔记',
        color: '#7BAB4A'
      },
      {
        icon: '🧘',
        title: '难过时，记得深呼吸',
        desc: '当你记录了焦虑或压力\n我们会推荐呼吸练习\n4-7-8呼吸法帮你快速放松',
        color: '#6C5CE7'
      },
      {
        icon: '📊',
        title: '定期回顾，了解自己',
        desc: '周报、晴雨表、情绪日历\n用数据温柔地看见自己\n每一次记录都有意义',
        color: '#E8856A'
      }
    ]
  },

  onLoad() {
    // 检查是否首次使用
    var hasOnboarded = wx.getStorageSync('has_onboarded');
    if (hasOnboarded) {
      this.goHome();
      return;
    }
  },

  // 下一页
  next() {
    if (this.data.current < this.data.steps.length - 1) {
      this.setData({ current: this.data.current + 1 });
      if (wx.vibrateShort) wx.vibrateShort({ type: 'light' });
    } else {
      this.finish();
    }
  },

  // 上一页
  prev() {
    if (this.data.current > 0) {
      this.setData({ current: this.data.current - 1 });
    }
  },

  // 跳过
  skip() {
    this.finish();
  },

  // 完成
  finish() {
    wx.setStorageSync('has_onboarded', true);
    this.goHome();
  },

  goHome() {
    wx.switchTab({
      url: '/pages/home/home',
      fail: function() {
        wx.redirectTo({ url: '/pages/home/home' });
      }
    });
  }
});
