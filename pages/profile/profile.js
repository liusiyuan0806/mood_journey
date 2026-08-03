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
  data: { profile: null, stats: {}, shareImagePath: '', showShareModal: false, xingkaiFont: '', showWatermark: true },
  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 3 });
    }
    this.refresh();
  },
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
  goWeatherPersonality() { wx.navigateTo({ url: '/pages/weather-personality/weather-personality' }); },
  clear() {
    wx.showModal({
      title: '清除数据', content: '所有心情记录将被永久清除。',
      success: r => { if (r.confirm) { wx.removeStorageSync('mood_journal_records'); this.refresh(); wx.showToast({ title: '已清除' }); } }
    });
  },

  report() { wx.navigateTo({ url: '/pages/weekly-report/weekly-report' }); },

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

      // ===== 数据准备：当日心情分析 =====
      const records = getRecords();
      const nowDate = new Date();
      const todayStr = `${nowDate.getFullYear()}-${String(nowDate.getMonth() + 1).padStart(2, '0')}-${String(nowDate.getDate()).padStart(2, '0')}`;

      // 今天记录
      const todayRecords = records.filter(r => {
        const t = r.timestamp || (r.date ? new Date(r.date).getTime() : 0);
        const d = new Date(t);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` === todayStr;
      });

      // 折线图数据：时间 + 分数（按时间排序）
      const chartData = todayRecords.map(r => {
        const t = new Date(r.timestamp || r.date);
        const timeStr = `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`;
        const moodObj = byName(r.mood);
        return { time: timeStr, score: moodObj.score, emoji: moodObj.emoji, name: r.mood, color: moodObj.color };
      }).sort((a, b) => a.time.localeCompare(b.time));

      // 当日心情色卡
      const todayColors = todayRecords.map(r => byName(r.mood).color);
      const todayMoods = todayRecords.map(r => ({ emoji: byName(r.mood).emoji, name: r.mood }));

      // EHI 情绪健康指数：基于全部记录均分×18 + 连续天数×2，封顶 100
      const allAvgScore = records.length
        ? records.reduce((s, r) => s + byName(r.mood).score, 0) / records.length
        : 0;
      const ehi = Math.max(0, Math.min(100, Math.round((allAvgScore || 3) * 18 + days * 2)));

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
          chartData, todayColors, todayMoods, todayCount: todayRecords.length,
          ehi, latestWeatherEmoji, latestWeatherName, latestMoodObj, latestMoodName,
          showWatermark: this.data.showWatermark
        });
        this._exportCanvas(canvas);
      });
    });
  },

  _drawContent(ctx, data) {
    const {
      profile, nickname, avatarImg, total, days, avg, dailyQuote,
      chartData, todayColors, todayMoods, todayCount,
      ehi, latestWeatherEmoji, latestWeatherName, latestMoodObj, latestMoodName,
      showWatermark
    } = data;
    console.log('[draw] ENTER _drawContent, todayRecords=', todayCount, 'dailyQuote=', dailyQuote);

    // ===== 全局半透蒙版 =====
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

      ctx.fillStyle = '#4A3A32';
      ctx.font = this._fontXingkai(24);
      ctx.fillText('·  记录生活的温度  ·', 375, 132);

      ctx.strokeStyle = '#B8A59A';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(310, 152);
      ctx.lineTo(440, 152);
      ctx.stroke();
    } catch (e) { console.error('[draw] 标题失败:', e); }

    // ===== 2. 头像 · 昵称 · 日期 =====
    try {
      const headY = 200;
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

      ctx.fillStyle = '#2c3e50';
      ctx.font = this._fontXingkai(34, 'bold');
      ctx.textAlign = 'left';
      ctx.fillText(nickname, 180, headY - 4);

      const now = new Date();
      const weekArr = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
      const dateStr = `${now.getMonth() + 1}月${now.getDate()}日 · ${weekArr[now.getDay()]}`;
      ctx.fillStyle = '#4A3A32';
      ctx.font = this._fontXingkai(22);
      ctx.fillText(dateStr, 180, headY + 28);
    } catch (e) { console.error('[draw] 头像失败:', e); }

    // ===== 3. 今日心情折线图 =====
    try {
      this._drawMoodChart(ctx, chartData, 310);
    } catch (e) { console.error('[draw] 折线图失败:', e); }

    // ===== 4. 今日心情色卡 =====
    try {
      this._drawTodaySwatches(ctx, todayColors, todayMoods, 560);
    } catch (e) { console.error('[draw] 色卡失败:', e); }

    // ===== 5. 情绪健康指数 EHI =====
    try {
      const y = 650;
      ctx.fillStyle = '#4A3A32';
      ctx.font = this._fontXingkai(24);
      ctx.textAlign = 'left';
      ctx.fillText('情绪健康指数 EHI', 90, y);

      ctx.fillStyle = '#2c3e50';
      ctx.font = this._fontSans(48, 'bold');
      ctx.textAlign = 'right';
      ctx.fillText(`${ehi}`, 600, y + 4);
      ctx.font = this._fontXingkai(22);
      ctx.fillStyle = '#4A3A32';
      ctx.fillText('分', 660, y + 4);

      const barX = 90, barY = y + 30, barW = 570, barH = 18;
      this._roundRect(ctx, barX, barY, barW, barH, 9);
      ctx.fillStyle = 'rgba(200, 180, 165, 0.25)';
      ctx.fill();
      const w = (ehi / 100) * barW;
      if (w > 1) {
        const g = ctx.createLinearGradient(barX, 0, barX + barW, 0);
        g.addColorStop(0, '#E8856A');
        g.addColorStop(1, '#F5B27A');
        this._roundRect(ctx, barX, barY, w, barH, 9);
        ctx.fillStyle = g;
        ctx.fill();
      }

      let comment = '继续保持';
      if (ehi >= 80) comment = '状态极佳 ✨';
      else if (ehi >= 60) comment = '状态良好';
      else if (ehi >= 40) comment = '需要关注';
      else if (ehi > 0) comment = '温柔对待自己';
      ctx.fillStyle = '#4A3A32';
      ctx.font = this._fontXingkai(20);
      ctx.textAlign = 'left';
      ctx.fillText(comment, 90, y + 76);
    } catch (e) { console.error('[draw] EHI 失败:', e); }

    // ===== 6. 连续打卡天数 =====
    try {
      const y = 810;
      ctx.fillStyle = '#4A3A32';
      ctx.font = this._fontXingkai(24);
      ctx.textAlign = 'left';
      ctx.fillText('连续打卡天数', 90, y);

      ctx.fillStyle = '#E8856A';
      ctx.font = this._fontSans(60, 'bold');
      ctx.textAlign = 'right';
      ctx.fillText(String(days), 580, y + 14);
      ctx.fillStyle = '#4A3A32';
      ctx.font = this._fontXingkai(26);
      ctx.fillText('天', 660, y + 14);

      ctx.font = this._fontSans(36);
      ctx.fillText('🔥', 670, y + 6);
    } catch (e) { console.error('[draw] 连续打卡失败:', e); }

    // ===== 7. 天气 × 心情速览 =====
    try {
      const y = 930;
      ctx.fillStyle = '#4A3A32';
      ctx.font = this._fontXingkai(24);
      ctx.textAlign = 'center';
      ctx.fillText('—  天气 × 心情速览  —', 375, y);

      const cardY = y + 30;
      const cardH = 90;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      this._roundRect(ctx, 90, cardY, 570, cardH, 20);
      ctx.fill();
      ctx.strokeStyle = 'rgba(184, 165, 154, 0.4)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.font = this._fontSans(48);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(latestWeatherEmoji, 175, cardY + cardH / 2);
      ctx.fillStyle = '#2c3e50';
      ctx.font = this._fontXingkai(24, 'bold');
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(latestWeatherName, 220, cardY + 36);
      ctx.fillStyle = '#4A3A32';
      ctx.font = this._fontXingkai(18);
      ctx.fillText('今日天气', 220, cardY + 64);

      ctx.fillStyle = '#B8A59A';
      ctx.font = this._fontSans(36);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('×', 375, cardY + cardH / 2);

      ctx.font = this._fontSans(48);
      ctx.fillText(latestMoodObj.emoji, 480, cardY + cardH / 2);
      ctx.fillStyle = '#2c3e50';
      ctx.font = this._fontXingkai(24, 'bold');
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(latestMoodName, 525, cardY + 36);
      ctx.fillStyle = '#4A3A32';
      ctx.font = this._fontXingkai(18);
      ctx.fillText('最近心情', 525, cardY + 64);
    } catch (e) { console.error('[draw] 天气速览失败:', e); }

    // ===== 8. 每日一句（底部，不写「每日一句」标签）=====
    try {
      if (dailyQuote) {
        const y = 1100;
        // 装饰分隔线
        ctx.strokeStyle = '#B8A59A';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(180, y);
        ctx.lineTo(300, y);
        ctx.moveTo(450, y);
        ctx.lineTo(570, y);
        ctx.stroke();
        ctx.fillStyle = '#B8A59A';
        ctx.beginPath();
        ctx.arc(375, y, 4, 0, Math.PI * 2);
        ctx.fill();

        // 直接写句子（行楷 30px），自动换行
        ctx.fillStyle = '#1a1a1a';
        ctx.font = this._fontXingkai(30, 'bold');
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        const maxWidth = 560;
        const lines = this._wrapText(ctx, dailyQuote, maxWidth);
        const lineH = 42;
        const startY = y + 48;
        for (let i = 0; i < lines.length; i++) {
          ctx.fillText(lines[i], 375, startY + i * lineH);
        }
      }
    } catch (e) { console.error('[draw] 每日一句失败:', e); }

    // ===== 9. Footer（水印可控）=====
    if (showWatermark) {
      try {
        ctx.strokeStyle = 'rgba(184, 165, 154, 0.4)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(180, 1240);
        ctx.lineTo(570, 1240);
        ctx.stroke();

        const now2 = new Date();
        const dateStr2 = `${now2.getFullYear()}.${String(now2.getMonth() + 1).padStart(2, '0')}.${String(now2.getDate()).padStart(2, '0')}`;
        ctx.fillStyle = '#3A2A22';
        ctx.font = this._fontXingkai(22, 'bold');
        ctx.textAlign = 'center';
        ctx.fillText(dateStr2, 375, 1278);

        ctx.fillStyle = '#4A3A32';
        ctx.font = this._fontXingkai(20);
        ctx.fillText('Mood Journey · 心情日记', 375, 1310);
      } catch (e) { console.error('[draw] footer 失败:', e); }
    }

    console.log('[draw] EXIT _drawContent');
  },

  // ===== 当日心情折线图 =====
  _drawMoodChart(ctx, chartData, startY) {
    const chartX = 70, chartW = 610, chartH = 210;
    const scoreMin = 1, scoreMax = 5;

    // 小标题
    ctx.fillStyle = '#4A3A32';
    ctx.font = this._fontXingkai(22);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('—  今日心情波动  —', 375, startY);

    const plotTop = startY + 28;
    const plotBottom = plotTop + chartH;
    const plotLeft = chartX + 40;
    const plotRight = chartX + chartW - 10;

    if (!chartData || chartData.length === 0) {
      // 无记录：显示提示
      ctx.fillStyle = '#4A3A32';
      ctx.font = this._fontXingkai(28);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('今天还没有记录心情，去记录一笔吧 🌱', 375, plotTop + chartH / 2);
      return;
    }

    // 背景底板
    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
    this._roundRect(ctx, chartX, plotTop, chartW, chartH, 14);
    ctx.fill();

    // Y 轴刻度线 + 标签
    ctx.strokeStyle = 'rgba(184, 165, 154, 0.25)';
    ctx.lineWidth = 0.8;
    ctx.setLineDash([4, 4]);
    ctx.fillStyle = '#4A3A32';
    ctx.font = this._fontSans(18);
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let s = scoreMin; s <= scoreMax; s++) {
      const y = plotBottom - ((s - scoreMin) / (scoreMax - scoreMin)) * chartH;
      ctx.beginPath();
      ctx.moveTo(plotLeft, y);
      ctx.lineTo(plotRight, y);
      ctx.stroke();
      ctx.fillText(String(s), plotLeft - 8, y);
    }
    ctx.setLineDash([]);

    // 数据点映射到坐标
    const points = chartData.map((d, i) => {
      const x = plotLeft + (chartData.length === 1 ? chartW / 2 : (i / (chartData.length - 1)) * (chartW - 40));
      const y = plotBottom - ((d.score - scoreMin) / (scoreMax - scoreMin)) * chartH;
      return { x, y, ...d };
    });

    // 单条记录：只画一个大圆点
    if (points.length === 1) {
      const p = points[0];
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      ctx.fillStyle = '#2c3e50';
      ctx.font = this._fontSans(28);
      ctx.textAlign = 'center';
      ctx.fillText(p.emoji, p.x, p.y - 28);
      ctx.font = this._fontXingkai(20);
      ctx.fillStyle = '#4A3A32';
      ctx.fillText(`${p.time} · ${p.name}`, p.x, p.y + 32);
      return;
    }

    // 多条记录：连线 + 渐变填充
    // 渐变填充区域
    const grad = ctx.createLinearGradient(0, plotTop, 0, plotBottom);
    grad.addColorStop(0, 'rgba(232, 133, 106, 0.2)');
    grad.addColorStop(1, 'rgba(232, 133, 106, 0.02)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(points[0].x, plotBottom);
    for (let i = 0; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.lineTo(points[points.length - 1].x, plotBottom);
    ctx.closePath();
    ctx.fill();

    // 连线
    ctx.strokeStyle = '#E8856A';
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i < points.length; i++) {
      if (i === 0) ctx.moveTo(points[i].x, points[i].y);
      else ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.stroke();

    // 数据点 + emoji + 时间标签
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      // 圆点
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Emoji（交替上下偏移防重叠）
      const emojiOffset = i % 2 === 0 ? -26 : 26;
      ctx.font = this._fontSans(22);
      ctx.fillStyle = '#2c3e50';
      ctx.textAlign = 'center';
      ctx.fillText(p.emoji, p.x, p.y + emojiOffset);

      // 时间标签（只在点下方）
      ctx.font = this._fontSans(16);
      ctx.fillStyle = '#4A3A32';
      ctx.fillText(p.time, p.x, plotBottom + 22);
    }
  },

  // ===== 今日心情色卡 =====
  _drawTodaySwatches(ctx, colors, moods, startY) {
    if (!colors || colors.length === 0) return;

    ctx.fillStyle = '#4A3A32';
    ctx.font = this._fontXingkai(22);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('—  今日心情色卡  —', 375, startY);

    const swatchY = startY + 28;
    const swatchH = 44;
    const maxW = 580, gap = 10;
    const count = Math.min(colors.length, 7);
    const swatchW = (maxW - gap * (count - 1)) / count;
    const startX = (750 - (swatchW * count + gap * (count - 1))) / 2;

    for (let i = 0; i < count; i++) {
      const x = startX + i * (swatchW + gap);
      this._roundRect(ctx, x, swatchY, swatchW, swatchH, 10);
      ctx.fillStyle = colors[i];
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // 色块内 emoji
      ctx.font = this._fontSans(22);
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const m = moods[i] || {};
      ctx.fillText(m.emoji || '', x + swatchW / 2, swatchY + swatchH / 2);
    }
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

  toggleWatermark() { this.setData({ showWatermark: !this.data.showWatermark }); },
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
