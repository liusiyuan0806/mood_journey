const {
  getProfile,
  saveProfile,
  getRecords,
  streak
} = require('../../utils/store');
const {
  byName
} = require('../../utils/moods');

// 随机抽取分享卡背景图
function getRandomShareImage() {
  const shareImages = [
    '/image/share/card-1.png',
    '/image/share/card-2.png',
    '/image/share/card-3.png',
    '/image/share/card-4.png',
  ];
  return shareImages[Math.floor(Math.random() * shareImages.length)];
}

Page({
  data: {
    profile: null,
    stats: {},
    shareImagePath: '',
    showShareModal: false
  },
  onShow() {
    this.refresh();
  },
  refresh() {
    const profile = getProfile();
    const records = getRecords();
    const avg = records.length
      ? (records.reduce((sum, r) => sum + byName(r.mood).score, 0) / records.length).toFixed(1)
      : '--';
    this.setData({
      profile,
      stats: { total: records.length, streak: streak(records), avg }
    });
  },
  login() {
    wx.showLoading({ title: '正在登录' });
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
        wx.showToast({ title: '登录成功', icon: 'success' });
      },
      fail: err => {
        wx.hideLoading();
        wx.showToast({ title: '你取消了授权', icon: 'none' });
      }
    });
  },
  logout() {
    saveProfile(null);
    this.refresh();
  },
  edit() {
    wx.navigateTo({ url: '/pages/edit-profile/edit-profile' });
  },
  clear() {
    wx.showModal({
      title: '清除数据',
      content: '所有心情记录将被永久清除。',
      success: result => {
        if (result.confirm) {
          wx.removeStorageSync('mood_journal_records');
          this.refresh();
          wx.showToast({ title: '已清除' });
        }
      }
    });
  },

  // ===== 生成分享卡（替换原来的占位 report）=====
  report() {
    this.generateShareCard();
  },

  async generateShareCard() {
    wx.showLoading({ title: '生成中...', mask: true });

    // 1. 抽背景图
    const bgPath = getRandomShareImage();
    let bgInfo;
    try {
      bgInfo = await this._downloadImage(bgPath);
    } catch (e) {
      wx.hideLoading();
      wx.showToast({ title: '请先在 images/share/ 放图片', icon: 'none' });
      return;
    }

    // 2. 准备头像
    let avatarInfo = null;
    if (this.data.profile && this.data.profile.avatar) {
      try { avatarInfo = await this._downloadImage(this.data.profile.avatar); } catch (e) {}
    }

    // 3. 拿 canvas
    const query = wx.createSelectorQuery();
    query.select('#shareCanvas').fields({ node: true, size: true }).exec(res => {
      if (!res[0]) {
        wx.hideLoading();
        wx.showToast({ title: '画布未找到', icon: 'none' });
        return;
      }

      const canvas = res[0].node;
      const ctx = canvas.getContext('2d');
      const dpr = wx.getSystemInfoSync().pixelRatio;
      canvas.width = 750 * dpr;
      canvas.height = 1334 * dpr;
      ctx.scale(dpr, dpr);

      // 4. 绘制背景
      ctx.drawImage(bgInfo.path, 0, 0, 750, 1334);
      // 半透蒙版让文字清晰
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.fillRect(0, 0, 750, 1334);

      // 5. 绘制内容
      // 标题
      ctx.fillStyle = '#2c3e50';
      ctx.font = 'bold 64px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('我的心情日记', 375, 180);
      ctx.fillStyle = '#7f8c8d';
      ctx.font = '28px sans-serif';
      ctx.fillText('记录生活的温度', 375, 230);

      // 头像
      if (avatarInfo) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(375, 340, 60, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(avatarInfo.path, 315, 280, 120, 120);
        ctx.restore();
      } else {
        ctx.fillStyle = '#ecf0f1';
        ctx.beginPath();
        ctx.arc(375, 340, 60, 0, Math.PI * 2);
        ctx.fill();
      }

      // 昵称
      const nickname = (this.data.profile && this.data.profile.nickname) || '未登录';
      ctx.fillStyle = '#2c3e50';
      ctx.font = 'bold 36px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(nickname, 375, 450);

      // 数据卡片
      const cardY = 560;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
      this._roundRect(ctx, 75, cardY, 600, 280, 24);
      ctx.fill();

      const { total = 0, streak: days = 0, avg = '--' } = this.data.stats;
      ctx.fillStyle = '#2c3e50';
      ctx.font = 'bold 64px sans-serif';
      ctx.fillText(String(total), 195, cardY + 140);
      ctx.fillText(String(days), 375, cardY + 140);
      ctx.fillText(String(avg), 555, cardY + 140);

      ctx.fillStyle = '#7f8c8d';
      ctx.font = '26px sans-serif';
      ctx.fillText('总记录', 195, cardY + 200);
      ctx.fillText('连续天数', 375, cardY + 200);
      ctx.fillText('平均心情', 555, cardY + 200);

      // 心情云
      const emojis = ['😊', '😌', '🌸', '🍃', '✨', '🌿', '🌈'];
      ctx.font = '60px sans-serif';
      ctx.fillText(emojis[Math.floor(Math.random() * emojis.length)], 375, cardY + 340);

      // 底部
      const now = new Date();
      const dateStr = `${now.getFullYear()}.${String(now.getMonth()+1).padStart(2,'0')}.${String(now.getDate()).padStart(2,'0')}`;
      ctx.fillStyle = '#7f8c8d';
      ctx.font = '24px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(dateStr, 375, 1240);
      ctx.fillText('Mood Journey · 心情日记', 375, 1280);

      // 6. 导出图片
      wx.canvasToTempFilePath({
        canvas,
        x: 0, y: 0, width: 750, height: 1334,
        destWidth: 750 * 2, destHeight: 1334 * 2,
        fileType: 'png',
        success: result => {
          wx.hideLoading();
          this.setData({ shareImagePath: result.tempFilePath, showShareModal: true });
        },
        fail: err => {
          wx.hideLoading();
          console.error('导出失败：', err);
          wx.showToast({ title: '生成失败', icon: 'none' });
        }
      });
    });
  },

  _downloadImage(path) {
    return new Promise((resolve, reject) => {
      // 本地项目图片（/ 开头）走 getImageInfo 会失败
      // 直接返回路径，让 canvas.drawImage 自己处理
      if (path.startsWith('/')) {
        resolve({ path });
        return;
      }
      // 网络图片才走 getImageInfo
      wx.getImageInfo({ src: path, success: resolve, fail: reject });
    });
  },

  _roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  },

  closeShareModal() {
    this.setData({ showShareModal: false });
  },

  saveShareImage() {
    wx.saveImageToPhotosAlbum({
      filePath: this.data.shareImagePath,
      success: () => {
        wx.showToast({ title: '已保存到相册', icon: 'success' });
        this.closeShareModal();
      },
      fail: err => {
        if (err.errMsg.includes('auth')) {
          wx.showModal({
            title: '需要相册权限',
            content: '请在设置中允许保存到相册',
            success: r => { if (r.confirm) wx.openSetting(); }
          });
        } else {
          wx.showToast({ title: '保存失败', icon: 'none' });
        }
      }
    });
  },
});
