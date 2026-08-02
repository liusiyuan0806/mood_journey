const { getRecords, deleteRecord, dateKey, streak } = require('../../utils/store');
const { byName } = require('../../utils/moods');

// 热力图颜色：按平均心情分映射 hsl
function getHeatColor(score) {
  if (!score || score <= 0) return '#EAE4DE';
  const t = Math.max(0, Math.min(1, (score - 1) / 4));
  const h = 22;
  const s = 12 + t * 73;
  const l = 92 - t * 48;
  return `hsl(${h}, ${s}%, ${l}%)`;
}

function pad(n) { return String(n).padStart(2, '0'); }

function getPeriod(time) {
  if (!time) return '上午';
  const h = parseInt(String(time).split(':')[0], 10);
  if (h >= 5 && h < 12) return '上午';
  if (h >= 12 && h < 18) return '下午';
  return '晚上';
}

// 提取高频关键词（诱因 / 身体感受）
function topKeywords(records, field, limit = 3) {
  const counts = {};
  records.forEach(r => {
    const items = r[field];
    if (Array.isArray(items)) {
      items.forEach(k => { counts[k] = (counts[k] || 0) + 1; });
    }
  });
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(e => e[0]);
}

// 取代表句（最长的一条 note）
function topExcerpt(records, limit = 40) {
  const notes = records
    .filter(r => r.note && r.note.trim())
    .sort((a, b) => b.note.length - a.note.length);
  if (notes.length === 0) return '';
  const txt = notes[0].note.trim();
  return txt.length > limit ? txt.slice(0, limit) + '…' : txt;
}

Page({
  data: {
    year: 0,
    month: 0,
    days: [],
    records: [],
    streak: 0,
    summary: [],

    // 月度增强概览
    recordRate: 0,
    recordDaysDisplay: '',
    moodDiversity: 0,
    monthAvgScore: 0,
    trendDisplay: '—',
    trendUp: false,
    trendDown: false,
    bestDay: null,
    attentionDay: null,
    todayStr: '',

    // 月度心情色带
    colorBand: [],

    // 底部动作面板
    showActions: false,
    actionDate: '',

    // 天气-心情简报
    showBrief: false,
    briefData: null,

    // 当日编辑面板
    showDayEdit: false,
    editDate: '',
    editRecords: []
  },

  onShow() {
    const n = new Date();
    if (!this.data.year) {
      this.setData({ year: n.getFullYear(), month: n.getMonth() + 1 });
    }
    this.build();
  },

  build() {
    const { year, month } = this.data;
    const records = getRecords();
    const first = new Date(year, month - 1, 1).getDay();
    const total = new Date(year, month, 0).getDate();

    // Today string
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

    // 按日期分组
    const dateMap = {};
    records.forEach(r => {
      if (!dateMap[r.date]) dateMap[r.date] = [];
      dateMap[r.date].push(r);
    });

    const days = [];
    for (let i = 0; i < first; i++) days.push({ empty: true });

    let recordedDays = 0;

    for (let d = 1; d <= total; d++) {
      const date = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayRecords = dateMap[date] || [];
      const hasRecords = dayRecords.length > 0;
      if (hasRecords) recordedDays++;

      let avgScore = 0;
      let dominantEmoji = '';
      if (hasRecords) {
        const totalScore = dayRecords.reduce((s, r) => s + (byName(r.mood)?.score || 3), 0);
        avgScore = Math.round((totalScore / dayRecords.length) * 10) / 10;
        // 取当天出现最多的心情 emoji
        const moodCounts = {};
        dayRecords.forEach(r => { moodCounts[r.mood] = (moodCounts[r.mood] || 0) + 1; });
        const dominantMood = Object.entries(moodCounts).sort((a, b) => b[1] - a[1])[0];
        dominantEmoji = dominantMood ? (byName(dominantMood[0])?.emoji || '') : '';
      }

      days.push({
        day: d,
        date,
        hasRecords,
        count: dayRecords.length,
        avgScore,
        heatColor: getHeatColor(avgScore),
        dominantEmoji,
        isToday: date === todayStr,
        record: dayRecords[0] || null
      });
    }

    // ---- Month metrics ----
    const monthPrefix = `${year}-${String(month).padStart(2, '0')}`;
    const monthly = records.filter(r => r.date.startsWith(monthPrefix));

    // Record rate
    const recordRate = Math.round(recordedDays / total * 100);

    // Mood diversity
    const moodSet = new Set(monthly.map(r => r.mood));
    const moodDiversity = moodSet.size;

    // Month avg score
    let monthAvgScore = 0;
    if (monthly.length > 0) {
      monthAvgScore = Math.round(monthly.reduce((s, r) => s + (byName(r.mood)?.score || 3), 0) / monthly.length * 10) / 10;
    }

    // Trend vs prev month
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    const prevMonthPrefix = `${prevYear}-${String(prevMonth).padStart(2, '0')}`;
    const prevMonthly = records.filter(r => r.date.startsWith(prevMonthPrefix));
    let prevMonthAvgScore = 0;
    if (prevMonthly.length > 0) {
      prevMonthAvgScore = Math.round(prevMonthly.reduce((s, r) => s + (byName(r.mood)?.score || 3), 0) / prevMonthly.length * 10) / 10;
    }

    let trendDisplay = '—';
    let trendUp = false;
    let trendDown = false;
    if (prevMonthAvgScore > 0 && monthAvgScore > 0) {
      const diff = Math.round((monthAvgScore - prevMonthAvgScore) * 10) / 10;
      if (diff > 0) {
        trendDisplay = `↑${diff}`;
        trendUp = true;
      } else if (diff < 0) {
        trendDisplay = `↓${Math.abs(diff)}`;
        trendDown = true;
      } else {
        trendDisplay = '持平';
      }
    }

    // 心情最好的一天 & 情绪低谷的一天
    let bestDay = null;
    let attentionDay = null;
    const validDays = days.filter(d => d.hasRecords);
    if (validDays.length > 0) {
      const sorted = [...validDays].sort((a, b) => b.avgScore - a.avgScore);

      // 心情最好
      const best = sorted[0];
      const bestRecords = dateMap[best.date] || [];
      const bestMoodCounts = {};
      bestRecords.forEach(r => { bestMoodCounts[r.mood] = (bestMoodCounts[r.mood] || 0) + 1; });
      const bestMoodName = Object.keys(bestMoodCounts).sort((a, b) => bestMoodCounts[b] - bestMoodCounts[a])[0] || '';
      const bestMoodInfo = bestMoodName ? byName(bestMoodName) : null;
      bestDay = {
        day: best.day,
        date: best.date,
        score: best.avgScore,
        emoji: bestMoodInfo?.emoji || '😊',
        moodName: bestMoodName || '开心'
      };

      // 情绪低谷（分数最低且与最高不同）
      if (sorted.length > 1 && sorted[sorted.length - 1].avgScore !== best.avgScore) {
        const worst = sorted[sorted.length - 1];
        const worstRecords = dateMap[worst.date] || [];
        const worstMoodCounts = {};
        worstRecords.forEach(r => { worstMoodCounts[r.mood] = (worstMoodCounts[r.mood] || 0) + 1; });
        const worstMoodName = Object.keys(worstMoodCounts).sort((a, b) => worstMoodCounts[b] - worstMoodCounts[a])[0] || '';
        const worstMoodInfo = worstMoodName ? byName(worstMoodName) : null;
        attentionDay = {
          day: worst.day,
          date: worst.date,
          score: worst.avgScore,
          emoji: worstMoodInfo?.emoji || '😔',
          moodName: worstMoodName || '低落'
        };
      }
    }

    // Mood distribution summary (top 3)
    const groups = {};
    monthly.forEach(r => { groups[r.mood] = (groups[r.mood] || 0) + 1; });
    const summary = Object.keys(groups).slice(0, 3).map(name => ({
      name,
      count: groups[name],
      width: `${Math.round(groups[name] / Math.max(monthly.length, 1) * 100)}%`
    }));

    // Monthly color band
    const colorBand = days.filter(d => !d.empty).map(d => ({
      day: d.day,
      color: d.hasRecords ? d.heatColor : '#F0E8E0',
      hasRecords: d.hasRecords,
    }));

    this.setData({
      days,
      records,
      streak: streak(records),
      summary,
      recordRate,
      recordDaysDisplay: `${recordedDays}/${total}`,
      moodDiversity,
      monthAvgScore,
      trendDisplay,
      trendUp,
      trendDown,
      bestDay,
      attentionDay,
      todayStr,
      colorBand,
    });
  },

  prev() {
    let { year, month } = this.data;
    if (--month === 0) { year--; month = 12; }
    this.setData({ year, month }, () => this.build());
  },

  next() {
    let { year, month } = this.data;
    if (++month === 13) { year++; month = 1; }
    this.setData({ year, month }, () => this.build());
  },

  // 点击日期格
  choose(e) {
    const date = e.currentTarget.dataset.date;
    const hasRecords = e.currentTarget.dataset.hasRecords;
    if (hasRecords) {
      this.setData({ showActions: true, actionDate: date });
    } else {
      wx.navigateTo({ url: '/pages/day/day?date=' + date });
    }
  },

  // 从概览跳转到某一天
  jumpToDay(e) {
    const date = e.currentTarget.dataset.date;
    if (date) {
      wx.navigateTo({ url: '/pages/day/day?date=' + date });
    }
  },

  closeActions() {
    this.setData({ showActions: false, actionDate: '' });
  },

  // 天气-心情简报
  showBrief() {
    const date = this.data.actionDate;
    const dayRecords = this.data.records.filter(r => r.date === date);
    if (dayRecords.length === 0) return;

    const scores = dayRecords.map(r => byName(r.mood)?.score || 3);
    const avgScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length * 10) / 10;
    const moodNames = [...new Set(dayRecords.map(r => r.mood))];

    // 天气：取最常出现的
    const weatherCounts = {};
    dayRecords.forEach(r => {
      const w = r.weatherText || r.weather || '未知';
      weatherCounts[w] = (weatherCounts[w] || 0) + 1;
    });
    const topWeather = Object.entries(weatherCounts).sort((a, b) => b[1] - a[1])[0] || ['未知'];

    // 高频诱因 & 身体感受
    const triggers = topKeywords(dayRecords, 'triggerItems', 4);
    const feelings = topKeywords(dayRecords, 'bodyFeelings', 3);
    const excerpt = topExcerpt(dayRecords, 60);

    const scoreLabel = avgScore >= 4.5 ? '非常好' : avgScore >= 3.5 ? '还不错' : avgScore >= 2.5 ? '一般' : '不太好';

    // Location summary
    const locationCounts = {};
    dayRecords.forEach(r => {
      const loc = r.currentAddress || r.location || '';
      if (loc) locationCounts[loc] = (locationCounts[loc] || 0) + 1;
    });
    const topLocations = Object.entries(locationCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(e => e[0]);

    // Period distribution
    const periodDist = { morning: 0, afternoon: 0, evening: 0 };
    dayRecords.forEach(r => {
      const p = r.period || getPeriod(r.time);
      if (p === '上午') periodDist.morning++;
      else if (p === '下午') periodDist.afternoon++;
      else if (p === '晚上') periodDist.evening++;
    });

    // Photos
    const photos = [];
    dayRecords.forEach(r => {
      if (r.images && r.images.length > 0) {
        r.images.forEach(img => photos.push(img));
      }
    });

    this.setData({
      showActions: false,
      showBrief: true,
      briefData: {
        date,
        avgScore,
        scoreLabel,
        recordCount: dayRecords.length,
        moodNames,
        weather: topWeather[0],
        triggers,
        feelings,
        excerpt,
        topLocations,
        periodDist,
        photos: photos.slice(0, 6),
        periodTotal: dayRecords.length,
      }
    });
  },

  closeBrief() {
    this.setData({ showBrief: false, briefData: null });
  },

  // 编辑当日心情 → 直接进入 day 页面（在该页查看 / 编辑 / 新增 / 删除）
  showDayEdit() {
    const date = this.data.actionDate;
    if (!date) return;
    this.setData({ showActions: false, actionDate: '' });
    wx.navigateTo({ url: '/pages/day/day?date=' + date });
  },

  closeDayEdit() {
    this.setData({ showDayEdit: false, editDate: '', editRecords: [] });
    this.build(); // 刷新热力图
  },

  // 编辑单条记录
  editRecord(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: '/pages/record/record?id=' + id });
  },

  // 删除单条记录
  removeRecord(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '删除记录',
      content: '确定删除这一条心情记录吗？',
      confirmColor: '#E8856A',
      success: res => {
        if (res.confirm) {
          deleteRecord(id);
          // 从当前编辑列表中移除
          const editRecords = this.data.editRecords.filter(r => r.id !== id);
          if (editRecords.length === 0) {
            this.closeDayEdit();
          } else {
            this.setData({ editRecords });
          }
        }
      }
    });
  },

  // 新增当天记录
  addRecord() {
    const date = this.data.editDate;
    wx.navigateTo({ url: '/pages/record/record?date=' + date });
  }
});
