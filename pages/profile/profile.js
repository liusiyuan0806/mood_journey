const { getProfile, saveProfile, getRecords, streak } = require('../../utils/store');
const { byName } = require('../../utils/moods');

function getRandomShareImage() {
  const imgs = [
    '/image/share/card-1.png',
    '/image/share/card-2.png',
    '/image/share/card-3.png',
    '/image/share/card-4.png',
  ];
  return imgs[Math.floor(Math.random() * imgs.length)];
}

Page({
  data: { profile: null, stats: {}, shareImagePath: '', showShareModal: false },
  onShow() { this.refresh(); },
  refresh() {
    const profile = getProfile();
    const records = getRecords();
    const avg = records.length
      ? (records.reduce((s, r) => s + byName(r.mood).score, 0) / records.length).toFixed(1)
      : '--';
    this.setData({ profile, stats: { total: records.length, streak: streak(records), avg } });
  },
  login() {
    wx.showLoading({ title: '正在登录' });
    wx.getUserProfile({
      desc: '用于展示你的头像和昵称',
      success: r => {
        wx.hideLoading();
        saveProfile({ nickname: r.userInfo.nickName, avatar: r.userInfo.avatarUrl, signature: '' });
        this.refresh();
        wx.showToast({ title: '登录成功', icon: 'success' });
      },
      fail: () => { wx.hideLoading(); wx.showToast({ title: '你取消了授权', icon: 'none' }); }
    });
  },
  logout() { saveProfile(null); this.refresh(); },
  edit() { wx.navigateTo({ url: '/pages/edit-profile/edit-profile' }); },
  clear() {
    wx.showModal({
      title: '清除数据', content: '所有心情记录将被永久清除。',
      success: r => { if (r.confirm) { wx.removeStorageSync('mood_journal_records'); this.refresh(); wx.showToast({ title: '已清除' }); } }
    });
  },

  report() { this.generateShareCard(); },

  async generateShareCard() {
    console.log('==========  开始生成分享卡  ==========');
    wx.showLoading({ title: '生成中...', mask: true });
    const timer = setTimeout(() => wx.hideLoading(), 10000);

    try {
      // 1. 拿 canvas
      const canvas = await this._getCanvas();
      const ctx = canvas.getContext('2d');
      const dpr = wx.getSystemInfoSync().pixelRatio;
      canvas.width = 750 * dpr;
      canvas.height = 1334 * dpr;
      ctx.scale(dpr, dpr);
      console.log('1) canvas 初始化完毕 dpr =', dpr);

      // 2. 加载背景图 —— 用 getImageInfo 拿临时路径，再给 createImage
      const bgPath = getRandomShareImage();
      console.log('2) 准备加载背景图:', bgPath);
      let bgImg = null;
      try {
        bgImg = await this._loadCanvasImage(canvas, bgPath);
        console.log('2) ✓ 背景图加载成功');
      } catch (e) {
        console.error('2) ✗ 背景图加载失败:', JSON.stringify(e));
      }

      // 3. 加载头像
      let avatarImg = null;
      if (this.data.profile && this.data.profile.avatar) {
        try { avatarImg = await this._loadCanvasImage(canvas, this.data.profile.avatar); } catch (e) {}
      }

      // 4. 绘制
      if (bgImg) {
        console.log('4) 绘制用户提供的背景图');
        ctx.drawImage(bgImg, 0, 0, 750, 1334);
      } else {
        console.warn('4) bgImg 为空，使用渐变兜底');
        const g = ctx.createLinearGradient(0, 0, 750, 1334);
        g.addColorStop(0, '#ffd6a5');
        g.addColorStop(0.5, '#ffadad');
        g.addColorStop(1, '#a0c4ff');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 750, 1334);
      }
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.fillRect(0, 0, 750, 1334);

      // 5. 文字内容
      ctx.fillStyle = '#2c3e50';
      ctx.font = 'bold 64px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('我的心情日记', 375, 180);
      ctx.fillStyle = '#7f8c8d';
      ctx.font = '28px sans-serif';
      ctx.fillText('记录生活的温度', 375, 230);

      if (avatarImg) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(375, 340, 60, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(avatarImg, 315, 280, 120, 120);
        ctx.restore();
      } else {
        ctx.fillStyle = '#ecf0f1';
        ctx.beginPath();
        ctx.arc(375, 340, 60, 0, Math.PI * 2);
        ctx.fill();
      }

      const nickname = (this.data.profile && this.data.profile.nickname) || '未登录';
      ctx.fillStyle = '#2c3e50';
      ctx.font = 'bold 36px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(nickname, 375, 450);

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

      const emojis = ['😊', '😌', '🌸', '🍃', '✨', '🌿', '🌈'];
      ctx.font = '60px sans-serif';
      ctx.fillText(emojis[Math.floor(Math.random() * emojis.length)], 375, cardY + 340);

      const now = new Date();
      const dateStr = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')}`;
      ctx.fillStyle = '#7f8c8d';
      ctx.font = '24px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(dateStr, 375, 1240);
      ctx.fillText('Mood Journey · 心情日记', 375, 1280);

      const result = await this._exportCanvas(canvas);
      this.setData({ shareImagePath: result.tempFilePath, showShareModal: true });
      console.log('==========  完成  ==========');
    } catch (e) {
      console.error('顶层异常:', JSON.stringify(e));
      wx.showToast({ title: '生成失败', icon: 'none' });
    } finally {
      clearTimeout(timer);
      wx.hideLoading();
    }
  },

  // 关键方法：getImageInfo → createImage + 临时路径
  _loadCanvasImage(canvas, src) {
    return new Promise((resolve, reject) => {
      // 网络图片
      if (src.startsWith('http://') || src.startsWith('https://')) {
        const img = canvas.createImage();
        img.onload = () => resolve(img);
        img.onerror = (e) => reject(new Error('网络图片失败: ' + src));
        img.src = src;
        return;
      }

      // 本地图片：先 getImageInfo
      console.log('[loadImage] 调 getImageInfo, src =', src);
      wx.getImageInfo({
        src: src,
        success: info => {
          console.log('[loadImage] getImageInfo 成功, 返回 path =', info.path);
          const img = canvas.createImage();
          img.onload = () => {
            console.log('[loadImage] Image.onload 成功, w =', img.width, 'h =', img.height);
            resolve(img);
          };
          img.onerror = (e) => {
            console.error('[loadImage] Image.onerror:', JSON.stringify(e));
            reject(new Error('Image 加载失败'));
          };
          img.src = info.path;  // 关键：传临时路径，不是原路径
        },
        fail: err => {
          console.error('[loadImage] getImageInfo 失败:', JSON.stringify(err));
          reject(err);
        }
      });
    });
  },

  _getCanvas() {
    return new Promise((resolve, reject) => {
      const q = this.createSelectorQuery();
      q.select('#shareCanvas').fields({ node: true, size: true }).exec(res => {
        if (!res || !res[0]) return reject(new Error('画布未找到'));
        resolve(res[0].node);
      });
    });
  },

  _exportCanvas(canvas) {
    return new Promise((resolve, reject) => {
      wx.canvasToTempFilePath({
        canvas, x: 0, y: 0, width: 750, height: 1334,
        destWidth: 750 * 2, destHeight: 1334 * 2,
        fileType: 'png',
        success: resolve,
        fail: reject
      });
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

  closeShareModal() { this.setData({ showShareModal: false }); },

  saveShareImage() {
    wx.saveImageToPhotosAlbum({
      filePath: this.data.shareImagePath,
      success: () => { wx.showToast({ title: '已保存到相册', icon: 'success' }); this.closeShareModal(); },
      fail: err => {
        if (err.errMsg.includes('auth')) {
          wx.showModal({ title: '需要相册权限', content: '请在设置中允许保存到相册', success: r => { if (r.confirm) wx.openSetting(); } });
        } else {
          wx.showToast({ title: '保存失败', icon: 'none' });
        }
      }
    });
  },
});
