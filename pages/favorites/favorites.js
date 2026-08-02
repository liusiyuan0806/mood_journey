const STORAGE_KEY = 'favorite_quotes';

function loadList() {
  const raw = wx.getStorageSync(STORAGE_KEY) || [];
  // 格式化时间展示
  return raw.map(item => ({
    text: item.text,
    time: item.time,
    timeText: formatTime(item.time)
  }));
}

function formatTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const pad = n => (n < 10 ? '0' + n : '' + n);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) {
    return `今天 ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

Page({
  data: {
    list: []
  },

  onShow() {
    this.refresh();
  },

  // 从 onShow 也读一次，防止新增收藏后未刷新
  refresh() {
    this.setData({ list: loadList() });
  },

  // 复制句子
  copyQuote(e) {
    const text = e.currentTarget.dataset.text;
    wx.setClipboardData({
      data: text,
      success: () => {
        wx.showToast({ title: '已复制', icon: 'success' });
      }
    });
  },

  // 单条移除
  removeQuote(e) {
    const idx = e.currentTarget.dataset.idx;
    const list = wx.getStorageSync(STORAGE_KEY) || [];
    const item = list[idx];
    if (!item) return;

    wx.showModal({
      title: '移除收藏',
      content: '确定要移除这条句子吗？',
      success: res => {
        if (res.confirm) {
          list.splice(idx, 1);
          wx.setStorageSync(STORAGE_KEY, list);
          this.refresh();
          wx.showToast({ title: '已移除', icon: 'none' });
        }
      }
    });
  },

  // 清空全部
  clearAll() {
    wx.showModal({
      title: '清空收藏',
      content: '所有收藏的句子将被永久清除，无法恢复。',
      success: res => {
        if (res.confirm) {
          wx.removeStorageSync(STORAGE_KEY);
          this.refresh();
          wx.showToast({ title: '已清空', icon: 'success' });
        }
      }
    });
  }
});
