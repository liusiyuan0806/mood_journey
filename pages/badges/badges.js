var { getRecords } = require('../../utils/store');
var { getBadgeStatus } = require('../../utils/achievements');

Page({
  data: {
    badges: [],
    unlockedCount: 0,
    totalCount: 0,
    showUnlockAnimation: false,
    unlockBadge: null,
    progressPercent: 0
  },

  onShow() {
    this.loadBadges();
  },

  loadBadges() {
    try {
      var records = getRecords();
      var status = getBadgeStatus(records);

      // 检查是否有新解锁的徽章
      if (status.newlyUnlocked.length > 0) {
        // 显示最新解锁的徽章动画
        this.setData({
          badges: status.badges,
          unlockedCount: status.unlockedCount,
          totalCount: status.totalCount,
          progressPercent: Math.round(status.unlockedCount / status.totalCount * 100),
          showUnlockAnimation: true,
          unlockBadge: status.newlyUnlocked[0]
        });
      } else {
        this.setData({
          badges: status.badges,
          unlockedCount: status.unlockedCount,
          totalCount: status.totalCount,
          progressPercent: Math.round(status.unlockedCount / status.totalCount * 100)
        });
      }
    } catch (err) {
      console.error('[badges] loadBadges error:', err);
    }
  },

  closeUnlockAnimation() {
    this.setData({ showUnlockAnimation: false, unlockBadge: null });
  },

  // 点击徽章
  tapBadge(e) {
    var badge = this.data.badges[e.currentTarget.dataset.idx];
    if (!badge) return;
    if (badge.unlocked) {
      wx.showToast({
        title: badge.name + ' · ' + badge.desc,
        icon: 'none',
        duration: 2000
      });
    } else {
      wx.showToast({
        title: '未解锁：' + badge.desc,
        icon: 'none',
        duration: 2000
      });
    }
  },

  goRecord() {
    wx.switchTab({ url: '/pages/home/home' });
  },

  onShareAppMessage() {
    return {
      title: '我已在情绪手账中解锁了' + this.data.unlockedCount + '个徽章！',
      path: '/pages/badges/badges'
    };
  }
});
