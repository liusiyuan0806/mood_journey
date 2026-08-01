const {
  getProfile,
  saveProfile,
  getRecords,
  streak
} = require('../../utils/store');
const {
  byName
} = require('../../utils/moods');
Page({
  data: {
    profile: null,
    stats: {},
    favoriteCount: 0
  },
  onShow() {
    this.refresh();
  },
  refresh() {
    const profile = getProfile();
    const records = getRecords();
    const favorites = wx.getStorageSync('favorite_quotes') || [];

    const avg = records.length
      ? (
          records.reduce(
            (sum, record) => sum + byName(record.mood).score,
            0
          ) / records.length
        ).toFixed(1)
      : '--';

    this.setData({
      profile,
      stats: {
        total: records.length,
        streak: streak(records),
        avg
      },
      favoriteCount: favorites.length
    });
  },
  // 跳转到收藏页
  goFavorites() {
    wx.navigateTo({
      url: '/pages/favorites/favorites'
    });
  },
  login() {
    wx.showLoading({
      title: '正在登录'
    });
  
    wx.getUserProfile({
      desc: '用于展示你的头像和昵称',
      success: result => {
        wx.hideLoading();
  
        saveProfile({
          nickname: result.userInfo.nickName,
          avatar: result.userInfo.avatarUrl,
          signature: ''
        });
  
        this.refresh();
  
        wx.showToast({
          title: '登录成功',
          icon: 'success'
        });
      },
  
      fail: err => {
        wx.hideLoading();
        console.error('登录失败：', err);
  
        wx.showToast({
          title: '你取消了授权或暂不支持此登录方式',
          icon: 'none',
          duration: 2500
        });
      }
    });
  },
  logout() {
    saveProfile(null);
    this.refresh();
  },
  edit() {
    wx.navigateTo({
      url: '/pages/edit-profile/edit-profile'
    });
  },
  clear() {
    wx.showModal({
      title: '清除数据',
      content: '所有心情记录将被永久清除。',
      success: result => {
        if (result.confirm) {
          wx.removeStorageSync('mood_journal_records');
          this.refresh();
          wx.showToast({
            title: '已清除'
          });
        }
      }
    });
  },
  report() {
    wx.showToast({
      title: '周报图片功能待接入画布',
      icon: 'none'
    });
  }
});