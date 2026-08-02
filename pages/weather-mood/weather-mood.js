const { getRecords } = require('../../utils/store');
const { moods, byName } = require('../../utils/moods');

// 天气名称映射表
const WEATHER_MAP = {
  '晴': { label: '晴朗', icon: '☀️', color: '#FFB347', bg: '#FFF8E7' },
  '阴': { label: '阴天', icon: '☁️', color: '#95A5A6', bg: '#F0F3F4' },
  '雨': { label: '小雨', icon: '🌧️', color: '#6BB5D8', bg: '#EAF4FA' },
  '雪': { label: '雪天', icon: '❄️', color: '#A8D8EA', bg: '#F0F8FF' },
  '多云': { label: '多云', icon: '⛅', color: '#F0C75E', bg: '#FFF9ED' },
  '雷阵雨': { label: '雷阵雨', icon: '⛈️', color: '#7B8FB2', bg: '#EEF0F5' },
  '雾': { label: '雾天', icon: '🌫️', color: '#C5CFD8', bg: '#F5F6F8' },
  '大风': { label: '大风', icon: '💨', color: '#B0BEC5', bg: '#F8FAFB' },
  '高温': { label: '高温', icon: '🔥', color: '#E74C3C', bg: '#FFF0EE' },
  '高湿': { label: '高湿度', icon: '💧', color: '#4AA3DF', bg: '#EDF6FC' }
};

function topMoods(list, limit) {
  const count = {};
  list.forEach(m => { count[m] = (count[m] || 0) + 1; });
  return Object.entries(count)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit || 2);
}

function fmt(n) { return n == null ? '--' : n.toFixed(1); }

function feelingSummary(moodList, bodyList) {
  const parts = [];
  const top = topMoods(moodList, 2);
  top.forEach(([name, count]) => {
    parts.push(`${byName(name).emoji}${name}×${count}`);
  });
  if (bodyList && bodyList.length) {
    const bodyMap = {};
    bodyList.forEach(b => { bodyMap[b] = (bodyMap[b] || 0) + 1; });
    const topBody = Object.entries(bodyMap).sort((a, b) => b[1] - a[1]).slice(0, 2);
    parts.push(topBody.map(t => t[0]).join('、'));
  }
  return parts.length ? parts.join(' · ') : '暂无数据';
}

function noteLength(records) {
  if (!records || records.length === 0) return 0;
  return records.reduce((s, r) => s + (r.note ? r.note.length : 0), 0) / records.length;
}

// 按心情分值筛选
function filterByMood(records, type) {
  if (type === 'all') return records;
  if (type === 'high') return records.filter(r => byName(r.mood).score >= 4);
  if (type === 'low') return records.filter(r => byName(r.mood).score <= 2);
  return records;
}

Page({
  data: {
    weatherCards: [],
    insights: [],
    hasInsight: false,
    sampleAll: 0,
    filter: 'all',
    filters: [
      { key: 'all', label: '全部', icon: '🌤️' },
      { key: 'high', label: '开心时刻', icon: '😊' },
      { key: 'low', label: '低落时刻', icon: '😢' }
    ]
  },

  onShow() { this.refresh(); },

  switchFilter(e) {
    const filter = e.currentTarget.dataset.key;
    this.setData({ filter });
    this.refresh();
  },

  refresh() {
    const records = getRecords();
    if (!records || records.length === 0) {
      this.showEmpty();
      return;
    }
    const filtered = filterByMood(records, this.data.filter);
    if (filtered.length === 0) {
      this.showEmpty();
      return;
    }
    this.analyze(filtered, records);
  },

  showEmpty() {
    this.setData({
      weatherCards: [],
      insights: [],
      hasInsight: false,
      sampleAll: 0
    });
  },

  analyze(records, allRecords) {
    const rawAll = allRecords || records;

    // 按天气类型分组
    const groups = {};
    records.forEach(r => {
      const key = r.weather || '晴';
      if (!groups[key]) groups[key] = [];
      groups[key].push(r);
    });

    // 衍生分类
    records.forEach(r => {
      const snap = r.weatherSnapshot || {};
      if (snap.currentTemp >= 35) {
        if (!groups['高温']) groups['高温'] = [];
        groups['高温'].push(r);
      }
      if (snap.humidity >= 75) {
        if (!groups['高湿']) groups['高湿'] = [];
        groups['高湿'].push(r);
      }
    });

    // 构建卡片（按记录数排序）
    const types = Object.keys(groups).sort((a, b) => groups[b].length - groups[a].length);
    const weatherCards = types.map(key => {
      const list = groups[key];
      const meta = WEATHER_MAP[key] || { label: key, icon: '🌤️', color: '#888', bg: '#F5F5F5' };
      const moodNames = list.map(r => r.mood);
      const scores = list.map(r => byName(r.mood).score);
      const avg = scores.reduce((s, v) => s + v, 0) / scores.length;
      const bodyList = list.reduce((arr, r) => {
        if (r.bodyFeelings) arr.push(...r.bodyFeelings);
        return arr;
      }, []);

      // 心情分布（每类心情的百分比）
      const distMap = {};
      moodNames.forEach(m => { distMap[m] = (distMap[m] || 0) + 1; });
      const distEntries = Object.entries(distMap).sort((a, b) => b[1] - a[1]);
      const moodDist = distEntries.map(([name, cnt]) => ({
        emoji: byName(name).emoji,
        name,
        count: cnt,
        pct: Math.round(cnt / list.length * 100),
        color: byName(name).color
      }));

      const enoughData = list.length >= 3;

      return {
        key,
        label: meta.label,
        icon: meta.icon,
        color: meta.color,
        bg: meta.bg,
        count: list.length,
        enoughData,
        moodDist,
        avgScore: avg,
        avgScoreText: fmt(avg),
        feeling: enoughData ? feelingSummary(moodNames, bodyList) : '',
        noteLen: noteLength(list)
      };
    });

    // 全局平均
    const allScores = rawAll.map(r => byName(r.mood).score);
    const globalAvg = allScores.reduce((s, v) => s + v, 0) / allScores.length;

    // 生成洞察 — 基于过滤后的数据
    const insights = this.generateInsights(weatherCards, groups, rawAll, globalAvg);
    const hasInsight = insights.some(i => i.level === 'notable');

    this.setData({
      weatherCards,
      insights,
      hasInsight,
      sampleAll: records.length
    });
  },

  generateInsights(cards, groups, allRecords, globalAvg) {
    const insights = [];
    const now = Date.now();
    const DAY_30 = 30 * 24 * 60 * 60 * 1000;

    // 1. 高湿度 vs 整体
    const hh = cards.find(c => c.key === '高湿' && c.count >= 5);
    if (hh) {
      const diff = globalAvg - hh.avgScore;
      if (Math.abs(diff) >= 0.5) {
        const dir = diff > 0 ? '低' : '高';
        insights.push({ text: `过去记录中，你在高湿度天气的平均心情比其他天气${dir} ${Math.abs(diff).toFixed(1)} 分。`, level: 'notable' });
      }
    }

    // 2. 雨/雷阵雨字数
    const rain = cards.find(c => (c.key === '雨' || c.key === '雷阵雨') && c.count >= 5);
    if (rain) {
      const others = cards.filter(c => c.key !== '雨' && c.key !== '雷阵雨' && c.count >= 3);
      if (others.length) {
        const oLen = others.reduce((s, c) => s + c.noteLen, 0) / others.length;
        if (rain.noteLen > oLen * 1.2) {
          insights.push({ text: '雨天时你更常写下较长的记录，可能更愿意整理感受。', level: 'notable' });
        }
      }
    }

    // 3. 晴天 — 自在频率高
    const sunny = cards.find(c => c.key === '晴' && c.count >= 5);
    if (sunny && sunny.moodDist.some(d => d.name === '自在')) {
      insights.push({ text: '晴天时你的「自在」出现频率更高，好天气确实能点亮心情。', level: 'notable' });
    }

    // 4. 高温
    const ht = cards.find(c => c.key === '高温' && c.count >= 5);
    if (ht) {
      const diff = globalAvg - ht.avgScore;
      if (diff >= 0.6) {
        insights.push({ text: `高温天气时情绪得分偏低（${fmt(ht.avgScore)} vs 整体${fmt(globalAvg)}），高温容易降低耐心。`, level: 'notable' });
      }
    }

    // 5. 30天趋势
    const recent30 = allRecords.filter(r => r.createdAt && r.createdAt >= now - DAY_30);
    if (recent30.length >= 10) {
      const rAvg = recent30.reduce((s, r) => s + byName(r.mood).score, 0) / recent30.length;
      const older = allRecords.filter(r => r.createdAt && r.createdAt < now - DAY_30);
      if (older.length >= 5) {
        const oAvg = older.reduce((s, r) => s + byName(r.mood).score, 0) / older.length;
        const trend = rAvg - oAvg;
        if (Math.abs(trend) >= 0.4) {
          insights.push({ text: `相比更早的时期，最近 30 天的情绪得分整体${trend > 0 ? '上升' : '下降'}了 ${Math.abs(trend).toFixed(1)} 分。`, level: 'notable' });
        }
      }
    }

    // 6. 不足样本
    const lowCards = cards.filter(c => c.count > 0 && c.count < 5);
    if (lowCards.length) {
      insights.push({ text: `「${lowCards.map(c => c.label).join('、')}」的样本还不够（不足5次），继续记录后规律会更清晰。`, level: 'low' });
    }
    if (!insights.length) {
      insights.push({ text: '当前样本还不够，继续记录几次后，我们会看到更清晰的规律。', level: 'low' });
    }
    return insights;
  }
});
