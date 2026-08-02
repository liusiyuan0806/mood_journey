const { getProfile, saveProfile, getRecords, streak } = require('../../utils/store');
const { byName } = require('../../utils/moods');
const { randomQuote } = require('../../utils/quotes');

function getRandomShareImage() {
  const idx = Math.floor(Math.random() * 13) + 1;
  return `/image/share/card-${idx}.png`;
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

  generateShareCard() {
    wx.showLoading({ title: '生成中...', mask: true });

    const query = this.createSelectorQuery();
    query.select('#shareCanvas').fields({ node: true }).exec(res => {
      if (!res || !res[0] || !res[0].node) {
        wx.hideLoading();
        wx.showToast({ title: '画布未就绪', icon: 'none' });
        return;
      }

      const canvas = res[0].node;
      const ctx = canvas.getContext('2d');
      const dpr = wx.getSystemInfoSync().pixelRatio;
      canvas.width = 750 * dpr;
      canvas.height = 1334 * dpr;
      ctx.scale(dpr, dpr);

      const bgPath = getRandomShareImage();
      const profile = this.data.profile;
      const nickname = (profile && profile.nickname) || '未登录';
      const { total = 0, streak: days = 0, avg = '--' } = this.data.stats;
      const avatarUrl = profile && profile.avatar;
      const dailyQuote = randomQuote();
      console.log('[generateShareCard] dailyQuote=', dailyQuote);

      // 同时加载背景图 + 头像
      const tasks = [
        this._loadCanvasImage(canvas, bgPath).catch(err => {
          console.warn('[canvas] 背景图加载失败:', err);
          return null;
        })
      ];
      if (avatarUrl) {
        tasks.push(
          this._loadCanvasImage(canvas, avatarUrl).catch(err => {
            console.warn('[canvas] 头像加载失败:', err);
            return null;
          })
        );
      }

      Promise.all(tasks).then(([bgImg, avatarImg]) => {
        // 背景
        if (bgImg) {
          ctx.drawImage(bgImg, 0, 0, 750, 1334);
        } else {
          const g = ctx.createLinearGradient(0, 0, 750, 1334);
          g.addColorStop(0, '#ffd6a5');
          g.addColorStop(0.5, '#ffadad');
          g.addColorStop(1, '#a0c4ff');
          ctx.fillStyle = g;
          ctx.fillRect(0, 0, 750, 1334);
        }
        this._drawContent(ctx, profile, nickname, total, days, avg, avatarImg, dailyQuote);
        this._exportCanvas(canvas);
      });
    });
  },

  _drawContent(ctx, profile, nickname, total, days, avg, avatarImg, dailyQuote) {
    // 半透蒙版
    ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.fillRect(0, 0, 750, 500);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.fillRect(0, 500, 750, 500);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.fillRect(0, 1000, 750, 334);

    // 标题
    ctx.fillStyle = '#2c3e50';
    ctx.font = 'bold 64px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('我的心情日记', 375, 180);
    ctx.fillStyle = '#7f8c8d';
    ctx.font = '28px sans-serif';
    ctx.fillText('记录生活的温度', 375, 230);

    // 头像
    ctx.save();
    ctx.beginPath();
    ctx.arc(375, 340, 60, 0, Math.PI * 2);
    ctx.clip();
    if (avatarImg) {
      ctx.drawImage(avatarImg, 315, 280, 120, 120);
    } else {
      ctx.fillStyle = '#ecf0f1';
      ctx.fillRect(315, 280, 120, 120);
    }
    ctx.restore();
    // 白边
    ctx.beginPath();
    ctx.arc(375, 340, 60, 0, Math.PI * 2);
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();

    // 昵称
    ctx.fillStyle = '#2c3e50';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(nickname, 375, 450);

    // 数据卡片
    const cardY = 560;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    this._roundRect(ctx, 75, cardY, 600, 280, 24);
    ctx.fill();

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

    // 每日一句 —— 用最稳的方式
    if (dailyQuote) {
      console.log('[share] 每日一句:', dailyQuote);
      const quoteY = cardY + 400; // 960

      try {
        // 装饰线
        ctx.strokeStyle = '#1a1a1a';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(180, quoteY);
        ctx.lineTo(570, quoteY);
        ctx.stroke();

        // 装饰小圆点
        ctx.fillStyle = '#1a1a1a';
        ctx.beginPath();
        ctx.arc(375, quoteY, 5, 0, Math.PI * 2);
        ctx.fill();

        // 标签
        ctx.fillStyle = '#1a1a1a';
        ctx.font = 'bold 26px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText('每日一句', 375, quoteY + 42);

        // 主体句子 —— 简单按 14 字换行（不依赖 measureText，最稳）
        const maxChars = 14;
        const quoteLines = [];
        let remaining = dailyQuote;
        while (remaining.length > maxChars) {
          // 优先在标点处断行
          let cut = maxChars;
          const lastPunc = Math.max(
            remaining.lastIndexOf('，', maxChars - 1),
            remaining.lastIndexOf('。', maxChars - 1),
            remaining.lastIndexOf('；', maxChars - 1),
            remaining.lastIndexOf('、', maxChars - 1)
          );
          if (lastPunc > 5) cut = lastPunc + 1;
          quoteLines.push(remaining.substring(0, cut));
          remaining = remaining.substring(cut);
        }
        if (remaining) quoteLines.push(remaining);
        console.log('[share] 每日一句 换行:', quoteLines);

        // 文字
        ctx.fillStyle = '#000000';
        ctx.font = 'bold 36px sans-serif';
        ctx.textAlign = 'center';
        const lineH = 50;
        const startY = quoteY + 95;
        for (let i = 0; i < quoteLines.length; i++) {
          ctx.fillText(quoteLines[i], 375, startY + i * lineH);
        }
      } catch (e) {
        console.error('[share] 每日一句绘制失败:', e);
        // 兜底：直接画一句不换行
        ctx.fillStyle = '#000000';
        ctx.font = 'bold 30px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(dailyQuote, 375, quoteY + 100);
      }
    }

    // 底部
    const now = new Date();
    const dateStr = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')}`;
    ctx.fillStyle = '#1a1a1a';
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText(dateStr, 375, 1220);
    ctx.fillStyle = '#4A3A32';
    ctx.fillText('Mood Journey · 心情日记', 375, 1265);
  },

  _exportCanvas(canvas) {
    setTimeout(() => {
      wx.canvasToTempFilePath({
        canvas,
        x: 0, y: 0, width: 750, height: 1334,
        destWidth: 750 * 2, destHeight: 1334 * 2,
        fileType: 'png',
        success: res => {
          wx.hideLoading();
          this.setData({ shareImagePath: res.tempFilePath, showShareModal: true });
        },
        fail: err => {
          wx.hideLoading();
          console.error('[canvas] 导出失败:', err);
          wx.showToast({ title: '导出失败', icon: 'none' });
        }
      });
    }, 300);
  },

  _loadCanvasImage(canvas, src) {
    return new Promise((resolve, reject) => {
      if (!src) { reject(new Error('src 为空')); return; }
      console.log('[canvas-img] 开始加载:', src);

      // 网络图片
      if (src.startsWith('http://') || src.startsWith('https://')) {
        const img = canvas.createImage();
        img.onload = () => { console.log('[canvas-img] 网络图片成功:', src); resolve(img); };
        img.onerror = e => reject(new Error('网络图片加载失败: ' + JSON.stringify(e)));
        img.src = src;
        return;
      }

      // 本地图片
      wx.getImageInfo({
        src,
        success: info => {
          console.log('[canvas-img] getImageInfo 成功:', src, '→', info.path);
          const fs = wx.getFileSystemManager();
          fs.readFile({
            filePath: info.path,
            encoding: 'base64',
            success: readRes => {
              const img = canvas.createImage();
              img.onload = () => { console.log('[canvas-img] 本地图片加载成功:', src); resolve(img); };
              img.onerror = e => reject(new Error('图片解析失败: ' + JSON.stringify(e)));
              const ext = (info.type || src.split('.').pop() || 'png').toLowerCase();
              const mime = ext === 'jpg' || ext === 'jpeg' ? 'jpeg' : 'png';
              img.src = `data:image/${mime};base64,${readRes.data}`;
            },
            fail: err => { console.error('[canvas-img] fs.readFile 失败:', err); reject(err); }
          });
        },
        fail: err => { console.error('[canvas-img] getImageInfo 失败:', err, 'src=', src); reject(err); }
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

  // 文字换行：根据 maxWidth 把长文本拆成多行
  _wrapText(ctx, text, maxWidth) {
    const lines = [];
    let currentLine = '';
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      const testLine = currentLine + ch;
      if (ctx.measureText(testLine).width > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = ch;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) lines.push(currentLine);
    return lines.length ? lines : [text];
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
