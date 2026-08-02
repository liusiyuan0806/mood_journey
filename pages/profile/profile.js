const { getProfile, saveProfile, getRecords, streak } = require('../../utils/store');
const { byName } = require('../../utils/moods');
const { randomQuote } = require('../../utils/quotes');

function getRandomShareImage() {
  const idx = Math.floor(Math.random() * 13) + 1;
  return `/image/share/card-${idx}.png`;
}

// 天气 emoji 映射（与 record.js 一致）
const WEATHER_EMOJI_MAP = {
  '晴天': '☀️', '阴天': '☁️', '雨天': '🌧️', '雪天': '❄️',
  '多云': '⛅', '雷阵雨': '⛈️', '雾': '🌫️', '大风': '💨'
};

// 行楷字体栈：自定义加载的字体 > 系统字体 > 兜底
function xingkaiFont(self) {
  return (
    (self && self.data && self.data.xingkaiFont) ||
    'STXingkai, "Xingkai SC", "华文行楷", KaiTi, "STKaiti", "楷体", "Songti SC", cursive, sans-serif'
  );
}

Page({
  data: { profile: null, stats: {}, shareImagePath: '', showShareModal: false, xingkaiFont: '' },
  onShow() { this.refresh(); },
  onLoad() { this._loadXingkaiFont(); },

  // 动态加载网络行楷字体（仅 HTTPS）
  // ⚠️ wx.loadFontFace 不支持本地路径，必须是网络 URL
  // 想让 Android 真机也显示行楷：
  //   1. 下载一个行楷 .ttf 字体（搜「行楷字体 ttf 下载」）
  //   2. 上传到你的云存储 / 服务器，得到 https URL
  //   3. 改下面 XINGKAI_FONT_URL 常量
  // 不改也能用：iOS 会用系统自带的 STXingkai/KaiTi，Android 自动回退到 sans-serif
  XINGKAI_FONT_URL: '', // 例：'https://your-cdn.com/xingkai.ttf'

  _loadXingkaiFont() {
    const url = this.XINGKAI_FONT_URL;
    if (!url) {
      console.log('[font] 未配置网络字体 URL，使用系统字体栈（iOS 上能显示行楷 STXingkai/KaiTi）');
      return;
    }
    wx.loadFontFace({
      global: true, // 必须 true，否则 canvas 2d 用不到
      family: 'MyXingkai',
      source: `url("${url}")`,
      scopes: ['webview', 'native'],
      success: () => {
        console.log('[font] 行楷字体加载成功:', url);
        this.setData({ xingkaiFont: 'MyXingkai' });
      },
      fail: err => {
        console.warn('[font] 行楷字体加载失败，回退到系统字体栈:', err);
      }
    });
  },
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
  goFavorites() { wx.navigateTo({ url: '/pages/favorites/favorites' }); },
  goWeatherMood() { wx.navigateTo({ url: '/pages/weather-mood/weather-mood' }); },
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

      // ===== 数据准备：按设计稿的 7 个模块 =====
      const records = getRecords();
      const nowTs = Date.now();
      const sevenDaysAgo = nowTs - 7 * 24 * 60 * 60 * 1000;

      // 本周记录
      const weekRecords = records.filter(r => {
        const t = r.timestamp || (r.date ? new Date(r.date).getTime() : 0);
        return t >= sevenDaysAgo;
      });

      // 1. 本周主导心情
      const moodCount = {};
      weekRecords.forEach(r => {
        if (r.mood) moodCount[r.mood] = (moodCount[r.mood] || 0) + 1;
      });
      const dominantName = Object.keys(moodCount).sort((a, b) => moodCount[b] - moodCount[a])[0] || '平静';
      const dominant = byName(dominantName);
      const dominantCount = moodCount[dominantName] || 0;

      // 2. 一周心情色卡（最近 7 条，缺位用浅灰占位）
      const last7 = records.slice(-7);
      const weekColors = last7.map(r => byName(r.mood).color);

      // 3. EHI 情绪健康指数：本周均分×18 + 连续天数×2，封顶 100
      const weekAvgScore = weekRecords.length
        ? weekRecords.reduce((s, r) => s + byName(r.mood).score, 0) / weekRecords.length
        : 0;
      const ehi = Math.max(0, Math.min(100, Math.round((weekAvgScore || 3) * 18 + days * 2)));

      // 4. 天气 × 心情速览（取最新一条）
      const latest = records[records.length - 1] || {};
      const latestWeatherName = latest.weather || '晴天';
      const latestWeatherEmoji = WEATHER_EMOJI_MAP[latestWeatherName] || '🌤️';
      const latestMoodName = latest.mood || '平静';
      const latestMoodObj = byName(latestMoodName);

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
        this._drawContent(ctx, {
          profile, nickname, avatarImg, total, days, avg, dailyQuote,
          dominant, weekColors, ehi, latestWeatherEmoji, latestWeatherName, latestMoodObj, latestMoodName,
          dominantCount, weekRecordCount: weekRecords.length
        });
        this._exportCanvas(canvas);
      });
    });
  },

  _drawContent(ctx, data) {
    const {
      profile, nickname, avatarImg, total, days, avg, dailyQuote,
      dominant, weekColors, ehi, latestWeatherEmoji, latestWeatherName, latestMoodObj, latestMoodName
    } = data;
    console.log('[draw] ENTER _drawContent, dailyQuote=', dailyQuote);

    // ===== 全局半透蒙版（让背景图变淡，文字可读）=====
    try {
      ctx.fillStyle = 'rgba(255, 252, 248, 0.55)';
      ctx.fillRect(0, 0, 750, 1334);
    } catch (e) { console.error('[draw] 蒙版失败:', e); }

    // ===== 1. 标题区 =====
    try {
      ctx.fillStyle = '#2c3e50';
      ctx.font = this._fontXingkai(56, 'bold');
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText('我的心情日记', 375, 90);

      ctx.fillStyle = '#8B776B';
      ctx.font = this._fontXingkai(24);
      ctx.fillText('·  记录生活的温度  ·', 375, 132);

      // 装饰小横线
      ctx.strokeStyle = '#B8A59A';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(310, 152);
      ctx.lineTo(440, 152);
      ctx.stroke();
    } catch (e) { console.error('[draw] 标题失败:', e); }

    // ===== 2. 头像 · 昵称 · 日期（横向一行）=====
    try {
      const headY = 200;
      // 头像
      ctx.save();
      ctx.beginPath();
      ctx.arc(120, headY, 38, 0, Math.PI * 2);
      ctx.clip();
      if (avatarImg) {
        ctx.drawImage(avatarImg, 82, headY - 38, 76, 76);
      } else {
        ctx.fillStyle = '#ecf0f1';
        ctx.fillRect(82, headY - 38, 76, 76);
      }
      ctx.restore();
      ctx.beginPath();
      ctx.arc(120, headY, 38, 0, Math.PI * 2);
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#FFFFFF';
      ctx.stroke();

      // 昵称
      ctx.fillStyle = '#2c3e50';
      ctx.font = this._fontXingkai(34, 'bold');
      ctx.textAlign = 'left';
      ctx.fillText(nickname, 180, headY - 4);

      // 日期副标
      const now = new Date();
      const weekArr = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
      const dateStr = `${now.getMonth() + 1}月${now.getDate()}日 · ${weekArr[now.getDay()]}`;
      ctx.fillStyle = '#8B776B';
      ctx.font = this._fontXingkai(22);
      ctx.fillText(dateStr, 180, headY + 28);
    } catch (e) { console.error('[draw] 头像失败:', e); }

    // ===== 3. 本周主导心情 =====
    try {
      const y = 310;
      // 小标题
      ctx.fillStyle = '#8B776B';
      ctx.font = this._fontXingkai(24);
      ctx.textAlign = 'center';
      ctx.fillText('—  本周主导心情  —', 375, y);

      // 大 emoji + 名称
      const cx = 280, cy = y + 70;
      // 圆形浅色底
      const bgG = ctx.createLinearGradient(cx - 50, cy - 50, cx + 50, cy + 50);
      bgG.addColorStop(0, dominant.color);
      bgG.addColorStop(1, '#FFFFFF');
      ctx.fillStyle = bgG;
      ctx.beginPath();
      ctx.arc(cx, cy, 50, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.lineWidth = 3;
      ctx.stroke();

      // emoji
      ctx.font = this._fontSans(56);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(dominant.emoji, cx, cy + 2);

      // 右侧：名称 + 频次
      ctx.fillStyle = '#2c3e50';
      ctx.font = this._fontXingkai(40, 'bold');
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(dominant.name, 360, cy - 5);

      ctx.fillStyle = '#8B776B';
      ctx.font = this._fontXingkai(20);
      const moodCount = dominant && (data.dominantCount || 0);
      const weekRecordCount = data.weekRecordCount || 0;
      ctx.fillText(`本周出现 ${moodCount} 次`, 360, cy + 28);
    } catch (e) { console.error('[draw] 主导心情失败:', e); }

    // ===== 4. 一周心情色卡 =====
    try {
      const y = 460;
      // 小标题
      ctx.fillStyle = '#8B776B';
      ctx.font = this._fontXingkai(24);
      ctx.textAlign = 'center';
      ctx.fillText('—  一周心情色卡  —', 375, y);

      // 7 个色块
      const swatchY = y + 30;
      const swatchH = 48;
      const swatchW = 76;
      const gap = 12;
      const totalW = swatchW * 7 + gap * 6;
      const startX = (750 - totalW) / 2;
      const dayLabels = ['日', '一', '二', '三', '四', '五', '六'];

      for (let i = 0; i < 7; i++) {
        const x = startX + i * (swatchW + gap);
        const hasData = i < weekColors.length;
        const color = hasData ? weekColors[i] : '#EEE5DD';

        // 圆角色块
        this._roundRect(ctx, x, swatchY, swatchW, swatchH, 12);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.6)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // 下方日期标签
        ctx.fillStyle = '#7A665C';
        ctx.font = this._fontSans(20);
        ctx.textAlign = 'center';
        ctx.fillText(dayLabels[i], x + swatchW / 2, swatchY + swatchH + 24);
      }
    } catch (e) { console.error('[draw] 色卡失败:', e); }

    // ===== 5. 情绪健康指数 EHI =====
    try {
      const y = 600;
      // 小标题
      ctx.fillStyle = '#8B776B';
      ctx.font = this._fontXingkai(24);
      ctx.textAlign = 'left';
      ctx.fillText('情绪健康指数 EHI', 90, y);

      // 数字
      ctx.fillStyle = '#2c3e50';
      ctx.font = this._fontSans(48, 'bold');
      ctx.textAlign = 'right';
      ctx.fillText(`${ehi}`, 600, y + 4);
      ctx.font = this._fontXingkai(22);
      ctx.fillStyle = '#8B776B';
      ctx.fillText('分', 660, y + 4);

      // 进度条
      const barX = 90, barY = y + 30, barW = 570, barH = 18;
      // 底
      this._roundRect(ctx, barX, barY, barW, barH, 9);
      ctx.fillStyle = 'rgba(200, 180, 165, 0.25)';
      ctx.fill();
      // 进度
      const w = (ehi / 100) * barW;
      if (w > 1) {
        const g = ctx.createLinearGradient(barX, 0, barX + barW, 0);
        g.addColorStop(0, '#E8856A');
        g.addColorStop(1, '#F5B27A');
        this._roundRect(ctx, barX, barY, w, barH, 9);
        ctx.fillStyle = g;
        ctx.fill();
      }

      // 评价文字
      let comment = '继续保持';
      if (ehi >= 80) comment = '状态极佳 ✨';
      else if (ehi >= 60) comment = '状态良好';
      else if (ehi >= 40) comment = '需要关注';
      else if (ehi > 0) comment = '温柔对待自己';
      ctx.fillStyle = '#8B776B';
      ctx.font = this._fontXingkai(20);
      ctx.textAlign = 'left';
      ctx.fillText(comment, 90, y + 76);
    } catch (e) { console.error('[draw] EHI 失败:', e); }

    // ===== 6. 连续打卡天数 =====
    try {
      const y = 740;
      ctx.fillStyle = '#8B776B';
      ctx.font = this._fontXingkai(24);
      ctx.textAlign = 'left';
      ctx.fillText('连续打卡天数', 90, y);

      // 大数字 + 单位
      ctx.fillStyle = '#E8856A';
      ctx.font = this._fontSans(60, 'bold');
      ctx.textAlign = 'right';
      ctx.fillText(String(days), 580, y + 14);
      ctx.fillStyle = '#8B776B';
      ctx.font = this._fontXingkai(26);
      ctx.fillText('天', 660, y + 14);

      // 装饰
      ctx.font = this._fontSans(36);
      ctx.fillText('🔥', 670, y + 6);
    } catch (e) { console.error('[draw] 连续打卡失败:', e); }

    // ===== 7. 每日一句 =====
    try {
      const y = 850;
      if (dailyQuote) {
        // 装饰分隔线
        ctx.strokeStyle = '#B8A59A';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(150, y);
        ctx.lineTo(280, y);
        ctx.moveTo(470, y);
        ctx.lineTo(600, y);
        ctx.stroke();
        ctx.fillStyle = '#B8A59A';
        ctx.beginPath();
        ctx.arc(375, y, 4, 0, Math.PI * 2);
        ctx.fill();

        // 标签
        ctx.fillStyle = '#8B776B';
        ctx.font = this._fontXingkai(22);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText('✦  每 日 一 句  ✦', 375, y + 34);

        // 主体 —— 自动换行
        ctx.fillStyle = '#1a1a1a';
        ctx.font = this._fontXingkai(34, 'bold');
        const maxWidth = 580;
        const lines = this._wrapText(ctx, dailyQuote, maxWidth);
        const lineH = 46;
        const startY = y + 80;
        for (let i = 0; i < lines.length; i++) {
          ctx.fillText(lines[i], 375, startY + i * lineH);
        }
      }
    } catch (e) { console.error('[draw] 每日一句失败:', e); }

    // ===== 8. 天气 × 心情速览 =====
    try {
      const y = 1060;
      // 小标题
      ctx.fillStyle = '#8B776B';
      ctx.font = this._fontXingkai(24);
      ctx.textAlign = 'center';
      ctx.fillText('—  天气 × 心情速览  —', 375, y);

      // 卡片
      const cardY = y + 30;
      const cardH = 90;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      this._roundRect(ctx, 90, cardY, 570, cardH, 20);
      ctx.fill();
      ctx.strokeStyle = 'rgba(184, 165, 154, 0.4)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // 左：天气
      ctx.font = this._fontSans(48);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(latestWeatherEmoji, 175, cardY + cardH / 2);
      ctx.fillStyle = '#2c3e50';
      ctx.font = this._fontXingkai(24, 'bold');
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(latestWeatherName, 220, cardY + 36);
      ctx.fillStyle = '#8B776B';
      ctx.font = this._fontXingkai(18);
      ctx.fillText('今日天气', 220, cardY + 64);

      // 中间连接符
      ctx.fillStyle = '#B8A59A';
      ctx.font = this._fontSans(36);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('×', 375, cardY + cardH / 2);

      // 右：心情
      ctx.font = this._fontSans(48);
      ctx.fillText(latestMoodObj.emoji, 480, cardY + cardH / 2);
      ctx.fillStyle = '#2c3e50';
      ctx.font = this._fontXingkai(24, 'bold');
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(latestMoodName, 525, cardY + 36);
      ctx.fillStyle = '#8B776B';
      ctx.font = this._fontXingkai(18);
      ctx.fillText('最近心情', 525, cardY + 64);
    } catch (e) { console.error('[draw] 天气速览失败:', e); }

    // ===== 9. Footer =====
    try {
      // 装饰分隔线
      ctx.strokeStyle = 'rgba(184, 165, 154, 0.4)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(180, 1240);
      ctx.lineTo(570, 1240);
      ctx.stroke();

      const now = new Date();
      const dateStr = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')}`;
      ctx.fillStyle = '#7A665C';
      ctx.font = this._fontXingkai(22, 'bold');
      ctx.textAlign = 'center';
      ctx.fillText(dateStr, 375, 1278);

      ctx.fillStyle = '#8B776B';
      ctx.font = this._fontXingkai(20);
      ctx.fillText('Mood Journey · 心情日记', 375, 1310);
    } catch (e) { console.error('[draw] footer 失败:', e); }

    console.log('[draw] EXIT _drawContent');
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

  // 行楷字体（用于装饰性文字：标题、每日一句、底部）
  _fontXingkai(size, weight = 'normal') {
    return `${weight} ${size}px ${xingkaiFont(this)}`;
  },
  // 系统字体（用于数字、英文、emoji）
  _fontSans(size, weight = 'normal') {
    return `${weight} ${size}px sans-serif`;
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
