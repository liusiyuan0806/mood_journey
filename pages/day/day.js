const { getRecords, deleteRecord } = require('../../utils/store');
const { byName } = require('../../utils/moods');

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

const TRIGGER_CAT_INFO = {
  positive: { label: '正面', color: '#52C41A', bg: 'rgba(82,196,26,0.1)', icon: '🌱' },
  negative: { label: '负面', color: '#F5222D', bg: 'rgba(245,34,45,0.1)', icon: '💢' },
  neutral:  { label: '中性', color: '#1890FF', bg: 'rgba(24,144,255,0.1)', icon: '🔵' },
};

const WEATHER_IMPACT_INFO = {
  '轻微':   { color: '#FAAD14', bg: 'rgba(250,173,20,0.12)' },
  '明显':   { color: '#FA541C', bg: 'rgba(250,84,28,0.12)' },
  '不确定': { color: '#8B776B', bg: 'rgba(139,119,107,0.12)' },
};

function pad(n) { return String(n).padStart(2, '0'); }

function getPeriod(time) {
  if (!time) return '上午';
  const h = parseInt(String(time).split(':')[0], 10);
  if (h >= 5 && h < 12) return '上午';
  if (h >= 12 && h < 18) return '下午';
  return '晚上';
}

function formatDateStr(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return { y, m, d, weekday: WEEKDAYS[date.getDay()] };
}

function shiftDate(dateStr, delta) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d + delta);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function isFutureDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date > today;
}

function daySummary(records) {
  if (!records || records.length === 0) return null;
  const scores = records.map(r => (byName(r.mood) || {}).score || 3);
  const avg = Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10;
  const emoji = (byName(records[0].mood) || {}).emoji || '·';
  return { emoji, score: avg };
}

function formatAudioDuration(sec) {
  if (!sec) return '';
  return `${Math.floor(sec / 60)}:${pad(sec % 60)}`;
}

Page({
  data: {
    date: '',
    records: [],
    dateInfo: null,
    avgScore: 0,
    scoreLabel: '',
    moodRange: null,
    moodColors: [],
    timeline: [],
    insights: null,
    prevDay: null,
    nextDay: null,
    isFuture: false,
    isToday: false,
    headerColor: '#FFF1E6',
  },

  onLoad(options) {
    this.loadData(options.date);
  },

  onShow() {
    if (this.data.date) {
      this.loadData(this.data.date);
    }
  },

  loadData(date) {
    const all = getRecords();
    const records = all
      .filter(item => item.date === date)
      .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

    const dateInfo = formatDateStr(date);
    const future = isFutureDate(date);

    const now = new Date();
    const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    const isToday = date === today;

    // ---- Enrich records ----
    const enriched = records.map(r => {
      const moodInfo = byName(r.mood) || { emoji: '🙂', name: r.mood, score: 3, color: '#EAE4D7' };
      const period = r.period || getPeriod(r.time);
      const triggerInfo = r.triggerCategory ? TRIGGER_CAT_INFO[r.triggerCategory] : null;
      const weatherImpactInfo = (r.weatherImpact && r.weatherImpact !== '无') ? (WEATHER_IMPACT_INFO[r.weatherImpact] || null) : null;

      const hasSnapshot = !!(r.weatherSnapshot && r.weatherSnapshot.temp != null);
      let weatherDisplay = null;
      if (hasSnapshot) {
        const ws = r.weatherSnapshot;
        weatherDisplay = {
          icon: ws.weatherIcon || '🌤️',
          text: ws.weatherText || '',
          tempText: `${ws.temp}° / 体感${ws.feelsLike}°`,
          humidityText: ws.humidity != null ? `💧${ws.humidity}%` : '',
          windText: ws.wind ? `💨${ws.wind}` : '',
          aqiText: ws.aqi != null ? `AQI ${ws.aqi}` : '',
        };
      }

      return Object.assign({}, r, {
        moodInfo: moodInfo,
        period: period,
        triggerInfo: triggerInfo,
        weatherImpactInfo: weatherImpactInfo,
        hasSnapshot: hasSnapshot,
        weatherDisplay: weatherDisplay,
        audioDurationDisplay: formatAudioDuration(r.audioDuration)
      });
    });

    // ---- Avg score ----
    let avgScore = 0;
    if (enriched.length > 0) {
      const total = enriched.reduce((s, r) => s + ((r.moodInfo || {}).score || 3), 0);
      avgScore = Math.round((total / enriched.length) * 10) / 10;
    }
    const scoreLabel = avgScore >= 4.5 ? '非常好' : avgScore >= 3.5 ? '还不错' : avgScore >= 2.5 ? '一般' : '不太好';

    // ---- Mood color strip ----
    const moodColors = enriched.map(r => (r.moodInfo || {}).color || '#EAE4D7');

    // ---- Mood range ----
    let moodRange = null;
    if (enriched.length >= 2) {
      const sorted = [...enriched].sort((a, b) => ((b.moodInfo || {}).score || 3) - ((a.moodInfo || {}).score || 3));
      const hi = sorted[0];
      const lo = sorted[sorted.length - 1];
      if (hi.moodInfo.score !== lo.moodInfo.score) {
        moodRange = {
          highestEmoji: hi.moodInfo.emoji,
          highestName: hi.moodInfo.name,
          lowestEmoji: lo.moodInfo.emoji,
          lowestName: lo.moodInfo.name,
          range: hi.moodInfo.score - lo.moodInfo.score,
        };
      }
    }

    // ---- Timeline ----
    const periodOrder = ['上午', '下午', '晚上'];
    const groups = {};
    enriched.forEach(r => {
      const p = r.period;
      if (!groups[p]) groups[p] = [];
      groups[p].push(r);
    });
    const timeline = periodOrder
      .filter(p => groups[p] && groups[p].length > 0)
      .map(p => ({
        period: p,
        icon: p === '上午' ? '☀️' : p === '下午' ? '🌤️' : '🌙',
        records: groups[p],
        avgScore: Math.round(groups[p].reduce((s, r) => s + ((r.moodInfo || {}).score || 3), 0) / groups[p].length * 10) / 10,
        count: groups[p].length,
      }));

    // ---- Insights ----
    let insights = null;
    if (enriched.length > 0) {
      // Dominant trigger category
      const catCounts = {};
      enriched.forEach(r => {
        if (r.triggerCategory) catCounts[r.triggerCategory] = (catCounts[r.triggerCategory] || 0) + 1;
      });
      const topCat = Object.entries(catCounts).sort((a, b) => b[1] - a[1])[0];
      const dominantTrigger = topCat ? Object.assign({}, TRIGGER_CAT_INFO[topCat[0]], { count: topCat[1] }) : null;

      // Weather-mood correlation
      let weatherMood = null;
      const wGroups = {};
      enriched.forEach(r => {
        const w = (r.hasSnapshot ? (r.weatherDisplay || {}).text : null) || r.weatherText || r.weather || '未知';
        if (!wGroups[w]) wGroups[w] = [];
        wGroups[w].push((r.moodInfo || {}).score || 3);
      });
      const wEntries = Object.entries(wGroups);
      if (wEntries.length >= 2) {
        const wAvgs = wEntries.map(([w, scores]) => ({
          weather: w,
          avg: Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10,
        }));
        const sortedW = wAvgs.sort((a, b) => b.avg - a.avg);
        const best = sortedW[0];
        const worst = sortedW[sortedW.length - 1];
        if (best.avg > worst.avg) {
          weatherMood = { weather: best.weather, avg: best.avg, worstWeather: worst.weather, worstAvg: worst.avg };
        }
      }

      insights = { dominantTrigger, weatherMood, recordCount: enriched.length };
    }

    // ---- Header color ----
    let headerColor = '#FFF1E6';
    if (enriched.length > 0) {
      const bestMood = [...enriched].sort((a, b) => ((b.moodInfo || {}).score || 3) - ((a.moodInfo || {}).score || 3))[0];
      headerColor = (bestMood.moodInfo || {}).color || '#FFF1E6';
    }

    // ---- Prev / Next day ----
    const prevDate = shiftDate(date, -1);
    const nextDate = shiftDate(date, 1);
    const prevSum = daySummary(all.filter(r => r.date === prevDate));
    const nextSum = daySummary(all.filter(r => r.date === nextDate));

    wx.setNavigationBarTitle({ title: `${dateInfo.m}月${dateInfo.d}日 · 星期${dateInfo.weekday}` });

    this.setData({
      date,
      records: enriched,
      dateInfo,
      avgScore,
      scoreLabel,
      moodRange,
      moodColors,
      timeline,
      insights,
      prevDay: { date: prevDate, emoji: (prevSum || {}).emoji || '', score: (prevSum || {}).score || 0 },
      nextDay: { date: nextDate, emoji: (nextSum || {}).emoji || '', score: (nextSum || {}).score || 0 },
      isFuture: future,
      isToday,
      headerColor,
    });
  },

  goPrev() {
    this.loadData(this.data.prevDay.date);
  },

  goNext() {
    if (this.data.isFuture) return;
    this.loadData(this.data.nextDay.date);
  },

  editRecord(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: '/pages/record/record?id=' + id });
  },

  deleteRecord(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '删除这条记录',
      content: '删除后无法恢复，确定继续吗？',
      confirmText: '删除',
      confirmColor: '#E8856A',
      cancelText: '再想想',
      success: (res) => {
        if (!res.confirm) return;
        deleteRecord(id);
        wx.showToast({ title: '已删除', icon: 'success', duration: 1200 });
        this.loadData(this.data.date);
      }
    });
  },

  addRecord() {
    const periods = this.data.records.map(item => item.period);
    const complete = periods.includes('上午') && periods.includes('下午') && periods.includes('晚上');
    if (complete) {
      wx.showModal({
        title: '今日记录已完成',
        content: '上午、下午、晚上都已经记录，如需修改，请点击对应记录进行编辑。',
        showCancel: false,
      });
      return;
    }
    wx.navigateTo({ url: '/pages/record/record?date=' + this.data.date });
  },

  previewImage(e) {
    const { urls, current } = e.currentTarget.dataset;
    wx.previewImage({ current, urls });
  },

  playAudio(e) {
    const path = e.currentTarget.dataset.path;
    if (!path) return;
    const ctx = wx.createInnerAudioContext();
    ctx.src = path;
    ctx.play();
    ctx.onEnded(() => ctx.destroy());
    ctx.onError(() => ctx.destroy());
  },
});
