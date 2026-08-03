const { getRecords, streak } = require('../../utils/store');
const { byName } = require('../../utils/moods');
const { predictMood, getPredictionText } = require('../../utils/moodPrediction');

const rangeStart = (type) => {
  const d = new Date();
  if (type === 'week') d.setDate(d.getDate() - 6);
  if (type === 'month') d.setMonth(d.getMonth() - 1);
  if (type === 'all') d.setFullYear(2000);
  return d;
};

// ===== Weather metadata =====
// bgColor / borderColor 已增强透明度与描边，让天气背景在图表中可辨识
const WEATHER_META = {
  '晴':   { icon: '☀️', color: '#FFE19A', bgColor: 'rgba(255,225,154,0.42)', borderColor: 'rgba(255,185,80,0.70)' },
  '多云': { icon: '⛅', color: '#F0C27A', bgColor: 'rgba(240,194,122,0.42)', borderColor: 'rgba(215,155,60,0.70)' },
  '阴':   { icon: '☁️', color: '#C8C8D0', bgColor: 'rgba(200,200,208,0.45)', borderColor: 'rgba(155,155,165,0.75)' },
  '雨':   { icon: '🌧️', color: '#BBD4EE', bgColor: 'rgba(187,212,238,0.48)', borderColor: 'rgba(125,165,205,0.75)' },
  '雪':   { icon: '❄️', color: '#D0E8F5', bgColor: 'rgba(208,232,245,0.48)', borderColor: 'rgba(145,190,215,0.75)' },
  '雷':   { icon: '⛈️', color: '#9B8EC8', bgColor: 'rgba(155,142,200,0.40)', borderColor: 'rgba(115,100,165,0.70)' },
};

const classifyWeather = (w) => {
  if (!w) return '晴';
  if (w.includes('雷')) return '雷';
  if (w.includes('雨')) return '雨';
  if (w.includes('雪')) return '雪';
  if (w.includes('阴')) return '阴';
  if (w.includes('多云')) return '多云';
  return '晴';
};

// ===== EHI levels =====
const EHI_LEVELS = [
  { min: 80, label: '优秀', color: '#7BC97D', icon: '✨' },
  { min: 60, label: '良好', color: '#F0B27A', icon: '🌿' },
  { min: 40, label: '注意', color: '#E8A05A', icon: '🌸' },
  { min: 0,  label: '关怀', color: '#E8856A', icon: '💛' },
];

const getEhiLevel = (score) => EHI_LEVELS.find(l => score >= l.min) || EHI_LEVELS[3];

const generateAdvice = (score, std, low, streakDays) => {
  if (score >= 80) {
    if (streakDays >= 7) return '状态很棒，连续记录让好心情延续';
    return '本周状态很棒，继续保持这份好心情';
  }
  if (score >= 60) {
    if (std > 1.2) return '整体不错，但情绪有些波动，试试每天给自己一点安静的时间';
    return '保持得很好，继续记录让好心情延续';
  }
  if (score >= 40) {
    if (low >= 2) return '最近有几天比较低落，记得照顾自己的感受';
    return '情绪有些起伏，试试深呼吸或散步来调整';
  }
  return '最近可能比较辛苦，给自己一个拥抱。如果持续低落，可以找信任的人聊聊';
};

// ===== Previous period EHI for trend comparison =====
const computePrevEHI = (all, type) => {
  if (type === 'all') return null;
  const now = new Date();
  let prevStart, prevEnd;
  if (type === 'week') {
    prevEnd = new Date(now);
    prevEnd.setDate(prevEnd.getDate() - 7);
    prevStart = new Date(prevEnd);
    prevStart.setDate(prevStart.getDate() - 6);
  } else {
    prevEnd = new Date(now);
    prevEnd.setMonth(prevEnd.getMonth() - 1);
    prevStart = new Date(prevEnd);
    prevStart.setMonth(prevStart.getMonth() - 1);
  }
  const prevRecords = all.filter(r => {
    const d = new Date(r.date);
    return d >= prevStart && d <= prevEnd;
  });
  if (!prevRecords.length) return null;
  const scores = prevRecords.map(r => byName(r.mood).score);
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  const std = Math.sqrt(scores.reduce((s, n) => s + Math.pow(n - avg, 2), 0) / scores.length);
  let low = 0;
  for (let i = scores.length - 1; i >= 0 && scores[i] <= 2; i--) low++;
  return Math.max(0, Math.min(100, Math.round(avg / 5 * 100 - std * 3 - low)));
};

// ===== Temperature extraction =====
const getTemp = (r) => {
  if (!r.weatherSnapshot) return null;
  const raw = r.weatherSnapshot.temp;
  if (raw == null) return null;
  const t = typeof raw === 'number' ? raw : parseFloat(raw);
  return isNaN(t) ? null : t;
};

Page({
  data: {
    records: [],
    // EHI module
    ehiScore: 0,
    ehiLevel: '开始记录',
    ehiLevelIcon: '',
    ehiLevelColor: '#B5A69C',
    ehiTrend: null,
    ehiBreakdown: [],
    showBreakdown: false,
    ehiAdvice: '',
    // Trend chart
    trendWindow: 7,
    trendBars: [],
    trendRange: '',
    selectedBar: null,
    // Weather correlation
    weatherGroups: [],
    weatherConclusion: '',
    tempRanges: [],
    warning: false,
    // 情绪预测
    prediction: null,
    predictionText: '',
    predictionBars: [],
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 2 });
    }
    this.refresh();
  },

  setTab(e) {
    // 保留以兼容旧版 — 实际已不再使用
  },

  // 点击图表空白处关闭柱子详情小方块
  closeBarPopup() {
    if (this.data.selectedBar !== null) {
      this.setData({ selectedBar: null });
    }
  },

  toggleBreakdown() {
    this.setData({ showBreakdown: !this.data.showBreakdown });
  },

  selectBar(e) {
    const idx = parseInt(e.currentTarget.dataset.idx);
    this.setData({ selectedBar: this.data.selectedBar === idx ? null : idx });
  },

  jumpToDay(e) {
    const date = e.currentTarget.dataset.date;
    if (date) {
      wx.navigateTo({ url: '/pages/day/day?date=' + date });
    }
  },

  refresh() {
    const all = getRecords();
    // 不再有 Tab 切换，EHI/走势/天气关联均基于全部记录
    const from = rangeStart('all');
    const records = all
      .filter(r => new Date(r.date) >= from)
      .sort((a, b) => a.date.localeCompare(b.date));

    if (!records.length) {
      this.setData({
        records: [],
        ehiScore: 0,
        ehiLevel: '开始记录',
        ehiLevelIcon: '',
        ehiLevelColor: '#B5A69C',
        ehiTrend: null,
        ehiBreakdown: [],
        trendBars: [],
        weatherGroups: [],
        weatherConclusion: '',
        tempRanges: [],
        warning: false,
      });
      return;
    }

    // ===== EHI computation =====
    const scores = records.map(r => byName(r.mood).score);
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    const std = Math.sqrt(scores.reduce((s, n) => s + Math.pow(n - avg, 2), 0) / scores.length);
    let low = 0;
    for (let i = scores.length - 1; i >= 0 && scores[i] <= 2; i--) low++;

    const avgContribution = Math.round(avg / 5 * 100);
    const stdDeduction = Math.round(std * 3);
    const lowDeduction = low;
    const streakDays = streak(all);
    const streakBonus = streakDays >= 7 ? 5 : streakDays >= 3 ? 2 : 0;
    const ehiScore = Math.max(0, Math.min(100,
      Math.round(avgContribution - stdDeduction - lowDeduction + streakBonus)
    ));
    const levelInfo = getEhiLevel(ehiScore);

    // Trend vs previous week (本周 EHI vs 上周 EHI)
    const prevScore = computePrevEHI(all, 'week');
    let ehiTrend = null;
    if (prevScore != null) {
      const diff = ehiScore - prevScore;
      ehiTrend = { diff: Math.abs(diff), up: diff >= 0 };
    }

    const ehiBreakdown = [
      { label: '平均分贡献', value: avgContribution, percent: avgContribution, color: '#B9E6C9', sign: '+' },
      { label: '波动扣分', value: stdDeduction, percent: Math.min(100, stdDeduction / 30 * 100), color: '#F7B7A5', sign: '-' },
      { label: '低谷扣分', value: lowDeduction, percent: Math.min(100, lowDeduction / 20 * 100), color: '#BBD4EE', sign: '-' },
      { label: '连续打卡加成', value: streakBonus, percent: streakBonus > 0 ? Math.min(100, streakBonus / 5 * 100) : 0, color: '#FFE19A', sign: '+' },
    ];

    this.setData({
      records,
      ehiScore,
      ehiLevel: levelInfo.label,
      ehiLevelIcon: levelInfo.icon,
      ehiLevelColor: levelInfo.color,
      ehiTrend,
      ehiBreakdown,
      ehiAdvice: generateAdvice(ehiScore, std, low, streakDays),
      warning: low >= 3,
    });

    this.buildTrendChart();
    this.buildWeatherCorrelation(records);
    this.buildPrediction(all);
  },

  // ===== 情绪预测 =====
  buildPrediction(allRecords) {
    try {
      var prediction = predictMood(allRecords, 3);
      var predictionText = getPredictionText(prediction);

      // 构建预测柱状图数据
      var predictionBars = [];
      if (prediction.hasData && prediction.chartData) {
        // 历史数据
        prediction.chartData.historical.forEach(function(d) {
          predictionBars.push({
            type: 'history',
            date: d.date.slice(5),
            score: d.score,
            height: Math.round(d.score / 5 * 100) + '%',
            color: byName('还好').color
          });
        });
        // 预测数据
        prediction.chartData.predictions.forEach(function(d) {
          predictionBars.push({
            type: 'prediction',
            date: d.date.slice(5),
            score: d.score,
            height: Math.round(d.score / 5 * 100) + '%',
            color: '#E8856A'
          });
        });
      }

      this.setData({
        prediction: prediction,
        predictionText: predictionText,
        predictionBars: predictionBars
      });
    } catch (err) {
      console.error('[prediction] error:', err);
    }
  },

  goBreathing() {
    wx.navigateTo({ url: '/pages/breathing/breathing' });
  },

  // ===== Trend chart =====
  buildTrendChart() {
    const records = this.data.records || [];
    // 固定展示最近 7 个日历日，无记录也占位，保证时间轴完整
    const win = 7;

    // Group all records by date, then render the last `win` calendar days
    const dayMap = {};
    records.forEach(r => {
      if (!dayMap[r.date]) dayMap[r.date] = [];
      dayMap[r.date].push(r);
    });

    // Build a continuous date window so the chart axis is always complete
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const days = [];
    for (let i = win - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      days.push(`${y}-${m}-${day}`);
    }
    const barCount = days.length;

    // 调试：若实际渲染柱数不是 7，在开发者工具 Console 中可见
    if (barCount !== win) {
      console.warn('[insights] trendBars date window mismatch:', barCount, days);
    }

    const trendRange = days.length ? `${days[0].slice(5)} ~ ${days[days.length - 1].slice(5)}` : '';

    const trendBars = days.map((date, i) => {
      const dayRecords = dayMap[date] || [];
      const hasRecords = dayRecords.length > 0;

      // Empty day placeholder — keeps the time axis rigorous
      if (!hasRecords) {
        return {
          date: date.slice(5),
          fullDate: date,
          score: null,
          height: '0%',
          moodEmoji: '',
          moodColor: 'transparent',
          dominantMoodName: '无记录',
          weatherIcon: '—',
          weatherBgColor: 'rgba(240,240,240,0.55)',
          weatherBorderColor: 'rgba(210,210,210,0.70)',
          weatherKey: '无',
          count: 0,
          isRain: false,
          isSnow: false,
          showLabel: barCount <= 14 || i % 2 === 0,
          empty: true,
        };
      }

      const dayScores = dayRecords.map(r => byName(r.mood).score);
      const avgScore = dayScores.reduce((a, b) => a + b, 0) / dayScores.length;

      // Dominant mood
      const moodCounts = {};
      dayRecords.forEach(r => { moodCounts[r.mood] = (moodCounts[r.mood] || 0) + 1; });
      const dominantMood = Object.keys(moodCounts).sort((a, b) => moodCounts[b] - moodCounts[a])[0];
      const moodInfo = byName(dominantMood);

      // Weather
      const weatherKey = classifyWeather(dayRecords[0].weather);
      const weatherMeta = WEATHER_META[weatherKey] || WEATHER_META['晴'];

      return {
        date: date.slice(5),
        fullDate: date,
        score: Math.round(avgScore * 10) / 10,
        height: Math.max(12, avgScore / 5 * 100) + '%',
        moodEmoji: moodInfo.emoji,
        moodColor: moodInfo.color,
        dominantMoodName: dominantMood,
        weatherIcon: weatherMeta.icon,
        weatherBgColor: weatherMeta.bgColor,
        weatherBorderColor: weatherMeta.borderColor,
        weatherKey,
        count: dayRecords.length,
        isRain: weatherKey === '雨' || weatherKey === '雷',
        isSnow: weatherKey === '雪',
        showLabel: barCount <= 14 || i % 2 === 0,
        empty: false,
      };
    });

    this.setData({ trendBars, trendRange, selectedBar: null });
  },

  // ===== Weather correlation =====
  buildWeatherCorrelation(records) {
    // Group by weather type
    const groups = {};
    records.forEach(r => {
      const key = classifyWeather(r.weather);
      if (!groups[key]) groups[key] = [];
      groups[key].push(r);
    });

    const weatherOrder = ['晴', '多云', '阴', '雨', '雪', '雷'];
    const weatherGroups = weatherOrder
      .filter(k => groups[k] && groups[k].length > 0)
      .map(k => {
        const groupRecords = groups[k];
        const grpScores = groupRecords.map(r => byName(r.mood).score);
        const avgScore = grpScores.reduce((a, b) => a + b, 0) / grpScores.length;
        const meta = WEATHER_META[k] || WEATHER_META['晴'];

        // Top 3 moods
        const moodCounts = {};
        groupRecords.forEach(r => { moodCounts[r.mood] = (moodCounts[r.mood] || 0) + 1; });
        const topMoods = Object.keys(moodCounts)
          .sort((a, b) => moodCounts[b] - moodCounts[a])
          .slice(0, 3)
          .map(name => {
            const info = byName(name);
            return {
              name,
              emoji: info.emoji,
              color: info.color,
              percent: Math.round(moodCounts[name] / groupRecords.length * 100)
            };
          });

        return {
          name: k,
          icon: meta.icon,
          color: meta.color,
          bgColor: meta.bgColor,
          count: groupRecords.length,
          avgScore: Math.round(avgScore * 20),
          avgScoreRaw: Math.round(avgScore * 10) / 10,
          topMoods,
        };
      });

    // Auto conclusion
    let weatherConclusion = '';
    if (weatherGroups.length >= 2) {
      const sorted = [...weatherGroups].sort((a, b) => b.avgScoreRaw - a.avgScoreRaw);
      const best = sorted[0];
      const worst = sorted[sorted.length - 1];
      const diff = best.avgScoreRaw - worst.avgScoreRaw;
      if (diff >= 1.5) {
        weatherConclusion = best.name + '天你的心情明显更好（' + best.avgScoreRaw + '分），' +
          worst.name + '天则偏低（' + worst.avgScoreRaw + '分），相差' + diff.toFixed(1) + '分';
      } else if (diff >= 0.5) {
        weatherConclusion = best.name + '天心情稍好（' + best.avgScoreRaw + '分），' +
          worst.name + '天稍低（' + worst.avgScoreRaw + '分），整体受天气影响不大';
      } else {
        weatherConclusion = '不同天气下你的心情比较稳定（均在' + worst.avgScoreRaw + '–' +
          best.avgScoreRaw + '分之间），天气对你影响较小';
      }
    } else if (weatherGroups.length === 1) {
      weatherConclusion = '近期以' + weatherGroups[0].name + '天为主，均分' +
        weatherGroups[0].avgScoreRaw + '分';
    }

    // Temperature ranges
    const tempBuckets = [
      { range: '<10°C', min: -100, max: 10, color: '#BBD4EE' },
      { range: '10-20°C', min: 10, max: 20, color: '#C8E5D1' },
      { range: '20-30°C', min: 20, max: 30, color: '#FFE19A' },
      { range: '30°C+', min: 30, max: 100, color: '#F7B7A5' },
    ];

    const tempData = records.filter(r => getTemp(r) != null);
    const tempRanges = tempBuckets.map(bucket => {
      const bucketRecords = tempData.filter(r => {
        const t = getTemp(r);
        return t >= bucket.min && t < bucket.max;
      });
      if (bucketRecords.length === 0) return null;
      const bScores = bucketRecords.map(r => byName(r.mood).score);
      const bAvg = bScores.reduce((a, b) => a + b, 0) / bScores.length;
      return {
        range: bucket.range,
        count: bucketRecords.length,
        avgScore: Math.round(bAvg * 10) / 10,
        color: bucket.color,
        barWidth: Math.round(bAvg / 5 * 100) + '%',
      };
    }).filter(Boolean);

    this.setData({ weatherGroups, weatherConclusion, tempRanges });
  },

  goRecord() {
    wx.switchTab({ url: '/pages/home/home' });
  },
});
