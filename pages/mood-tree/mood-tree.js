var { getRecords } = require('../../utils/store');
var { generateTreeData } = require('../../utils/moodTree');
var { byName } = require('../../utils/moods');

Page({
  data: {
    tree: null,
    selectedFruit: null,
    showFruitDetail: false,
    shareText: ''
  },

  onLoad() {
    this.loadTree();
  },

  onShow() {
    this.loadTree();
  },

  loadTree() {
    try {
      var records = getRecords();
      var tree = generateTreeData(records);

      // 为每个果实添加点击信息
      tree.fruits = tree.fruits.map(function(f) {
        var moodInfo = byName(f.moodName);
        return {
          id: f.id,
          cx: f.cx,
          cy: f.cy,
          r: f.r,
          color: f.color,
          emoji: f.emoji,
          moodName: f.moodName,
          score: f.score,
          date: f.date,
          time: f.time,
          note: f.note,
          weather: f.weather,
          hasNote: f.hasNote,
          delay: f.delay,
          scoreLabel: moodInfo.score >= 4 ? '积极' : moodInfo.score >= 3 ? '平稳' : '低落'
        };
      });

      // 生成分享文案
      var shareText = '我的情绪树已经长到「' + tree.level.name + '」等级了！';
      if (tree.progress.next) {
        shareText += '再记录' + tree.progress.remaining + '次就能升级到「' + tree.progress.next.name + '」🌱';
      }

      this.setData({ tree: tree, shareText: shareText });
    } catch (err) {
      console.error('[mood-tree] loadTree error:', err);
    }
  },

  // 点击果实
  tapFruit(e) {
    var fruitId = e.currentTarget.dataset.id;
    var fruit = this.data.tree.fruits.find(function(f) { return f.id === fruitId; });
    if (fruit) {
      this.setData({ selectedFruit: fruit, showFruitDetail: true });
      if (wx.vibrateShort) wx.vibrateShort({ type: 'light' });
    }
  },

  // 关闭果实详情
  closeFruitDetail() {
    this.setData({ showFruitDetail: false, selectedFruit: null });
  },

  // 去记录
  goRecord() {
    wx.switchTab({ url: '/pages/home/home' });
  },

  // 分享
  onShareAppMessage() {
    return {
      title: this.data.shareText,
      path: '/pages/mood-tree/mood-tree'
    };
  },

  // 预览分享
  shareTree() {
    wx.showActionSheet({
      itemList: ['分享给好友', '保存截图到相册'],
      success: function(res) {
        if (res.tapIndex === 0) {
          // 分享给好友由 onShareAppMessage 处理
          wx.showToast({ title: '点击右上角「...」分享', icon: 'none' });
        } else if (res.tapIndex === 1) {
          wx.showToast({ title: '请使用截屏功能保存', icon: 'none' });
        }
      }
    });
  }
});
