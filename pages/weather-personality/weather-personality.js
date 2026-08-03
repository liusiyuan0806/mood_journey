const { getRecords, getProfile } = require('../../utils/store');
const { byName } = require('../../utils/moods');

// ===== 天气分类 =====
const classifyWeather = (w) => {
  if (!w) return '晴';
  if (w.includes('雷')) return '雷';
  if (w.includes('雨')) return '雨';
  if (w.includes('雪')) return '雪';
  if (w.includes('阴')) return '阴';
  if (w.includes('多云')) return '多云';
  return '晴';
};

const WEATHER_EMOJI = {
  '晴': '☀️', '多云': '⛅', '阴': '☁️', '雨': '🌧️', '雪': '❄️', '雷': '⛈️'
};

const getTemp = (r) => {
  if (!r.weatherSnapshot) return null;
  const raw = r.weatherSnapshot.temp;
  if (raw == null) return null;
  const t = typeof raw === 'number' ? raw : parseFloat(raw);
  return isNaN(t) ? null : t;
};

// ===== 人格类型定义 =====
const PERSONALITY_TYPES = {
  'sunshine': {
    tag: '阳光型',
    emoji: '☀️',
    color: '#FFB347',
    bgGradient: 'linear-gradient(135deg, #FFF3E0 0%, #FFE0B2 100%)',
    desc: '晴天是你的能量源泉，阳光明媚时你的心情也跟着明亮起来。多云阴天时略有下降，但整体积极向上。'
  },
  'rainy': {
    tag: '雨季型',
    emoji: '🌧️',
    color: '#7BB4E8',
    bgGradient: 'linear-gradient(135deg, #E3F2FD 0%, #BBDEFB 100%)',
    desc: '雨天反而让你感到宁静和舒适，雨声是最好的白噪音。你享受独处的时光，阴雨天的心情比晴天更放松。'
  },
  'stable': {
    tag: '恒温稳定型',
    emoji: '🌿',
    color: '#81C784',
    bgGradient: 'linear-gradient(135deg, #E8F5E9 0%, #C8E6C9 100%)',
    desc: '你的心情几乎不受天气影响，无论晴雨都保持稳定的情绪状态。这份内心的稳定感是一种难得的力量。'
  },
  'sensitive': {
    tag: '温差敏感型',
    emoji: '🌡️',
    color: '#E8856A',
    bgGradient: 'linear-gradient(135deg, #FFF3E0 0%, #FFCCBC 100%)',
    desc: '天气对你的心情影响显著，晴天和雨天的情绪差异明显。你可能对光照、气压变化比较敏感，注意在阴雨天多照顾自己。'
  },
};

Page({
  data: {
    hasData: false,
    personality: null,       // { type, tag, emoji, color, bgGradient, desc }
    sunnyAvg: '--',
    rainyAvg: '--',
    sensitivity: '--',       // 温差敏感度
    sunnyCount: 0,
    rainyCount: 0,
    bestTempRange: '--',
    worstWeather: '--',
    worstWeatherEmoji: '',
    worstWeatherScore: '--',
    bestWeather: '--',
    bestWeatherEmoji: '',
    bestWeatherScore: '--',
    totalRecords: 0,
    currentSlide: 0,
    showShareModal: false,
    shareImagePath: '',
    nickname: '心情旅人',
  },

  onLoad() {
    this.computePersonality();
  },

  computePersonality() {
    const records = getRecords();
    const profile = getProfile();

    if (!records || records.length === 0) {
      this.setData({ hasData: false });
      return;
    }

    const nickname = (profile && profile.nickname) || '心情旅人';

    // 按天气分组
    const weatherGroups = {};
    records.forEach(r => {
      const key = classifyWeather(r.weather);
      if (!weatherGroups[key]) weatherGroups[key] = [];
      weatherGroups[key].push(r);
    });

    // 晴天组（晴 + 多云）
    const sunnyRecords = [
      ...(weatherGroups['晴'] || []),
      ...(weatherGroups['多云'] || [])
    ];
    // 雨天组（雨 + 雷）
    const rainyRecords = [
      ...(weatherGroups['雨'] || []),
      ...(weatherGroups['雷'] || [])
    ];

    const calcAvg = (arr) => {
      if (!arr.length) return null;
      return arr.reduce((s, r) => s + byName(r.mood).score, 0) / arr.length;
    };

    const sunnyAvg = calcAvg(sunnyRecords);
    const rainyAvg = calcAvg(rainyRecords);

    // 温差敏感度
    let sensitivity = null;
    if (sunnyAvg != null && rainyAvg != null) {
      sensitivity = Math.abs(sunnyAvg - rainyAvg);
    } else if (sunnyAvg != null) {
      sensitivity = 0;
    } else if (rainyAvg != null) {
      sensitivity = 0;
    }

    // ===== 判定人格类型 =====
    const diff = (sunnyAvg != null && rainyAvg != null) ? (sunnyAvg - rainyAvg) : 0;
    let typeKey = 'stable';

    if (sunnyAvg != null && rainyAvg != null) {
      if (diff > 1.5) {
        typeKey = 'sensitive';
      } else if (diff < -1.0) {
        typeKey = 'rainy';
      } else if (sunnyAvg >= 4.0 && diff >= 0.5) {
        typeKey = 'sunshine';
      } else if (Math.abs(diff) < 0.5) {
        typeKey = 'stable';
      } else if (diff >= 0) {
        typeKey = 'sunshine';
      } else {
        typeKey = 'rainy';
      }
    } else if (sunnyAvg != null) {
      typeKey = sunnyAvg >= 3.5 ? 'sunshine' : 'stable';
    } else if (rainyAvg != null) {
      typeKey = 'rainy';
    }

    const personality = PERSONALITY_TYPES[typeKey];

    // ===== 最佳/最差天气 =====
    const weatherOrder = ['晴', '多云', '阴', '雨', '雪', '雷'];
    const weatherStats = weatherOrder
      .filter(k => weatherGroups[k] && weatherGroups[k].length > 0)
      .map(k => {
        const arr = weatherGroups[k];
        const avg = calcAvg(arr);
        return { name: k, avg, count: arr.length, emoji: WEATHER_EMOJI[k] || '🌤️' };
      })
      .sort((a, b) => b.avg - a.avg);

    const bestWeather = weatherStats[0] || null;
    const worstWeather = weatherStats[weatherStats.length - 1] || null;

    // ===== 最佳温度区间 =====
    const tempRecords = records.filter(r => getTemp(r) != null);
    let bestTempRange = '--';
    if (tempRecords.length > 0) {
      const tempBuckets = {};
      tempRecords.forEach(r => {
        const t = getTemp(r);
        const bucketMin = Math.floor(t / 5) * 5;
        if (!tempBuckets[bucketMin]) tempBuckets[bucketMin] = [];
        tempBuckets[bucketMin].push(r);
      });

      let bestBucket = null;
      let bestAvg = -1;
      Object.keys(tempBuckets).forEach(minStr => {
        const arr = tempBuckets[minStr];
        const avg = calcAvg(arr);
        if (avg > bestAvg) {
          bestAvg = avg;
          bestBucket = parseInt(minStr);
        }
      });

      if (bestBucket !== null) {
        bestTempRange = `${bestBucket}~${bestBucket + 5}°C`;
      }
    }

    this.setData({
      hasData: true,
      nickname,
      personality,
      sunnyAvg: sunnyAvg != null ? sunnyAvg.toFixed(1) : '--',
      rainyAvg: rainyAvg != null ? rainyAvg.toFixed(1) : '--',
      sensitivity: sensitivity != null ? sensitivity.toFixed(1) : '--',
      sunnyCount: sunnyRecords.length,
      rainyCount: rainyRecords.length,
      bestTempRange,
      bestWeather: bestWeather ? bestWeather.name : '--',
      bestWeatherEmoji: bestWeather ? bestWeather.emoji : '',
      bestWeatherScore: bestWeather ? bestWeather.avg.toFixed(1) : '--',
      worstWeather: worstWeather ? worstWeather.name : '--',
      worstWeatherEmoji: worstWeather ? worstWeather.emoji : '',
      worstWeatherScore: worstWeather ? worstWeather.avg.toFixed(1) : '--',
      totalRecords: records.length,
    });
  },

  onSwiperChange(e) {
    this.setData({ currentSlide: e.detail.current });
  },

  // ===== Canvas 海报生成 =====
  generatePoster() {
    if (!this.data.hasData) return;
    wx.showLoading({ title: '生成中...', mask: true });

    const query = this.createSelectorQuery();
    query.select('#posterCanvas').fields({ node: true }).exec(res => {
      if (!res || !res[0] || !res[0].node) {
        wx.hideLoading();
        wx.showToast({ title: '画布未就绪', icon: 'none' });
        return;
      }

      const canvas = res[0].node;
      const ctx = canvas.getContext('2d');
      const dpr = wx.getSystemInfoSync().pixelRatio;
      canvas.width = 750 * dpr;
      canvas.height = 1100 * dpr;
      ctx.scale(dpr, dpr);

      this._drawPoster(ctx, canvas);
    });
  },

  _drawPoster(ctx, canvas) {
    const { personality, sunnyAvg, rainyAvg, sensitivity, bestTempRange,
            bestWeather, bestWeatherEmoji, worstWeather, worstWeatherEmoji,
            nickname, totalRecords } = this.data;

    // ===== 背景 =====
    const bgGrad = ctx.createLinearGradient(0, 0, 750, 1100);
    bgGrad.addColorStop(0, '#FFF8F2');
    bgGrad.addColorStop(0.5, '#FFF1E6');
    bgGrad.addColorStop(1, '#FFE8D6');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 750, 1100);

    // ===== 顶部装饰 =====
    ctx.fillStyle = personality.color + '20';
    ctx.beginPath();
    ctx.arc(375, 120, 200, 0, Math.PI * 2);
    ctx.fill();

    // ===== 标题 =====
    ctx.fillStyle = '#4A3A32';
    ctx.font = 'bold 32px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('我的天气心情人格', 375, 60);

    ctx.fillStyle = '#B5A69C';
    ctx.font = '22px sans-serif';
    ctx.fillText('— Weather Mood Personality —', 375, 90);

    // ===== 人格 emoji 大圆 =====
    const emojiY = 200;
    ctx.save();
    ctx.beginPath();
    ctx.arc(375, emojiY, 70, 0, Math.PI * 2);
    const circleGrad = ctx.createRadialGradient(375, emojiY, 0, 375, emojiY, 70);
    circleGrad.addColorStop(0, '#FFFFFF');
    circleGrad.addColorStop(1, personality.color + '60');
    ctx.fillStyle = circleGrad;
    ctx.fill();
    ctx.strokeStyle = personality.color;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();

    ctx.font = '70px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(personality.emoji, 375, emojiY + 4);

    // ===== 人格标签 =====
    ctx.fillStyle = personality.color;
    ctx.font = 'bold 48px sans-serif';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(personality.tag, 375, 310);

    // ===== 昵称 =====
    ctx.fillStyle = '#8B776B';
    ctx.font = '24px sans-serif';
    ctx.fillText(nickname + ' · 基于 ' + totalRecords + ' 条记录', 375, 348);

    // ===== 分隔线 =====
    ctx.strokeStyle = '#F0E0D0';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(120, 380);
    ctx.lineTo(630, 380);
    ctx.stroke();

    // ===== 3 个关键指标卡 =====
    const cardY = 410;
    const cardH = 130;
    const cardW = 190;
    const gap = 15;
    const startX = (750 - (cardW * 3 + gap * 2)) / 2;

    const metrics = [
      { label: '晴天均分', value: sunnyAvg, emoji: '☀️', color: '#FFB347' },
      { label: '雨天均分', value: rainyAvg, emoji: '🌧️', color: '#7BB4E8' },
      { label: '温差敏感度', value: sensitivity, emoji: '🌡️', color: '#E8856A' },
    ];

    metrics.forEach((m, i) => {
      const x = startX + i * (cardW + gap);
      // 卡片背景
      this._roundRect(ctx, x, cardY, cardW, cardH, 16);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.fill();
      ctx.strokeStyle = m.color + '40';
      ctx.lineWidth = 2;
      ctx.stroke();

      // emoji
      ctx.font = '36px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(m.emoji, x + cardW / 2, cardY + 38);

      // 数值
      ctx.fillStyle = m.color;
      ctx.font = 'bold 40px sans-serif';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(String(m.value), x + cardW / 2, cardY + 95);

      // 标签
      ctx.fillStyle = '#8B776B';
      ctx.font = '20px sans-serif';
      ctx.fillText(m.label, x + cardW / 2, cardY + 118);
    });

    // ===== 人格描述 =====
    const descY = 580;
    ctx.fillStyle = '#4A3A32';
    ctx.font = '22px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('— 人格画像 —', 375, descY);

    // 描述文字自动换行
    ctx.fillStyle = '#5D4A40';
    ctx.font = '24px sans-serif';
    ctx.textAlign = 'left';
    const maxWidth = 560;
    const lines = this._wrapText(ctx, personality.desc, maxWidth);
    const lineH = 38;
    const descStartY = descY + 40;
    const descStartX = (750 - maxWidth) / 2;
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], descStartX, descStartY + i * lineH);
    }

    // ===== 最佳温度区间 + 最易低落天气 =====
    const insightY = descStartY + lines.length * lineH + 30;
    ctx.fillStyle = '#4A3A32';
    ctx.font = '22px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('— 天气洞察 —', 375, insightY);

    const insightCardY = insightY + 25;
    const insightCardW = 320;
    const insightCardH = 85;
    const insightGap = 20;

    // 最佳温度
    this._roundRect(ctx, 55, insightCardY, insightCardW, insightCardH, 14);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.fill();
    ctx.strokeStyle = '#FFB347' + '40';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.font = '30px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🌡️', 95, insightCardY + insightCardH / 2);
    ctx.fillStyle = '#8B776B';
    ctx.font = '20px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('最佳温度区间', 130, insightCardY + 30);
    ctx.fillStyle = '#E8856A';
    ctx.font = 'bold 28px sans-serif';
    ctx.fillText(bestTempRange, 130, insightCardY + 62);

    // 最易低落天气
    this._roundRect(ctx, 375, insightCardY, insightCardW, insightCardH, 14);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.fill();
    ctx.strokeStyle = '#7BB4E8' + '40';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.font = '30px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(worstWeatherEmoji || '☁️', 415, insightCardY + insightCardH / 2);
    ctx.fillStyle = '#8B776B';
    ctx.font = '20px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('最易低落天气', 450, insightCardY + 30);
    ctx.fillStyle = '#7BB4E8';
    ctx.font = 'bold 28px sans-serif';
    ctx.fillText(worstWeather || '--', 450, insightCardY + 62);

    // ===== 底部 =====
    ctx.strokeStyle = '#F0E0D0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(180, 1020);
    ctx.lineTo(570, 1020);
    ctx.stroke();

    const now = new Date();
    const dateStr = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')}`;
    ctx.fillStyle = '#4A3A32';
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(dateStr, 375, 1055);

    ctx.fillStyle = '#B5A69C';
    ctx.font = '20px sans-serif';
    ctx.fillText('Mood Journey · 天气心情人格', 375, 1085);

    // 导出
    setTimeout(() => {
      wx.canvasToTempFilePath({
        canvas,
        x: 0, y: 0, width: 750, height: 1100,
        destWidth: 750 * 2, destHeight: 1100 * 2,
        fileType: 'png',
        success: res => {
          wx.hideLoading();
          this.setData({ shareImagePath: res.tempFilePath, showShareModal: true });
        },
        fail: err => {
          wx.hideLoading();
          console.error('[poster] 导出失败:', err);
          wx.showToast({ title: '导出失败', icon: 'none' });
        }
      });
    }, 300);
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
        if (err.errMsg && err.errMsg.includes('auth')) {
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

  goRecord() {
    wx.switchTab({ url: '/pages/home/home' });
  },
});
