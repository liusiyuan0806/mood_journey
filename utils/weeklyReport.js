/**
 * 周报分析引擎
 * 基于情绪记录数据，生成本周情绪报告
 */

const { moods, byName } = require('./moods');
const { streak } = require('./store');

// ==================== 日期工具 ====================

const pad = n => String(n).padStart(2, '0');

const dateKey = (date = new Date()) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

/**
 * 获取最近 N 天的日期范围
 * @param {number} days - 天数
 * @param {Date} endDate - 结束日期（默认今天）
 * @returns {{ start: Date, end: Date }}
 */
function getRecentRange(days, endDate = new Date()) {
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);
  const start = new Date(end);
  start.setDate(start.getDate() - (days - 1));
  start.setHours(0, 0, 0, 0);
  return { start, end };
}

/**
 * 获取某天所在的周几中文
 */
const weekDayName = (date) => {
  const names = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  return names[new Date(date).getDay()];
};

/**
 * 格式化日期为 MM-DD
 */
const shortDate = (dateStr) => {
  const parts = dateStr.split('-');
  return `${parts[1]}-${parts[2]}`;
};

// ==================== 核心分析 ====================

/**
 * 计算情绪健康指数 EHI
 * 公式与 insights 页面一致：(平均分/5)×100 − 标准差×3 − 连续低谷天数×1
 */
function calcEHI(records) {
  if (!records || records.length === 0) return 0;
  const scores = records.map(r => byName(r.mood).score);
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  const std = Math.sqrt(scores.reduce((s, n) => s + Math.pow(n - avg, 2), 0) / scores.length);

  let low = 0;
  for (let i = scores.length - 1; i >= 0 && scores[i] <= 2; i--) low++;

  return Math.max(0, Math.min(100, Math.round(avg / 5 * 100 - std * 3 - low)));
}

const ehiLevel = (score) => {
  if (score >= 80) return '优秀';
  if (score >= 60) return '良好';
  if (score >= 40) return '注意';
  return '关怀';
};

const ehiLevelClass = (score) => {
  if (score >= 80) return 'excellent';
  if (score >= 60) return 'good';
  if (score >= 40) return 'attention';
  return 'care';
};

/**
 * 分析情绪分布
 */
function analyzeMoodDistribution(records) {
  const moodCount = {};
  records.forEach(r => {
    const name = r.mood || '平静';
    moodCount[name] = (moodCount[name] || 0) + 1;
  });

  const total = records.length;
  const distribution = Object.entries(moodCount)
    .map(([name, count]) => {
      const mood = byName(name);
      return {
        name,
        emoji: mood.emoji,
        color: mood.color,
        score: mood.score,
        count,
        percentage: Math.round(count / total * 100)
      };
    })
    .sort((a, b) => b.count - a.count);

  const topMoods = distribution.slice(0, 3);
  const positiveCount = records.filter(r => byName(r.mood).score >= 4).length;
  const negativeCount = records.filter(r => byName(r.mood).score <= 2).length;

  return {
    distribution,
    topMoods,
    positiveRatio: Math.round(positiveCount / total * 100),
    negativeRatio: Math.round(negativeCount / total * 100),
    neutralRatio: Math.round((total - positiveCount - negativeCount) / total * 100)
  };
}

/**
 * 分析每日情绪走势
 */
function analyzeDailyTrend(records, range) {
  const dailyMap = {};
  records.forEach(r => {
    if (!dailyMap[r.date]) {
      dailyMap[r.date] = { scores: [], records: [], topMoodName: '', topMoodCount: 0 };
    }
    const score = byName(r.mood).score;
    dailyMap[r.date].scores.push(score);
    dailyMap[r.date].records.push(r);

    const moodName = r.mood;
    const moodCount = dailyMap[r.date].records.filter(rec => rec.mood === moodName).length;
    if (moodCount > dailyMap[r.date].topMoodCount) {
      dailyMap[r.date].topMoodName = moodName;
      dailyMap[r.date].topMoodCount = moodCount;
    }
  });

  // 生成连续7天的趋势
  const trend = [];
  const cursor = new Date(range.start);
  for (let i = 0; i < 7; i++) {
    const dKey = dateKey(cursor);
    const dayData = dailyMap[dKey];
    if (dayData) {
      const avg = dayData.scores.reduce((a, b) => a + b, 0) / dayData.scores.length;
      const mood = byName(dayData.topMoodName);
      trend.push({
        date: dKey,
        dateLabel: shortDate(dKey),
        weekDay: weekDayName(dKey),
        avgScore: Math.round(avg * 10) / 10,
        recordCount: dayData.scores.length,
        barHeight: `${Math.round(avg / 5 * 100)}%`,
        topMoodEmoji: mood.emoji,
        topMoodName: dayData.topMoodName,
        topMoodColor: mood.color
      });
    } else {
      trend.push({
        date: dKey,
        dateLabel: shortDate(dKey),
        weekDay: weekDayName(dKey),
        avgScore: 0,
        recordCount: 0,
        barHeight: '0%',
        topMoodEmoji: '',
        topMoodName: '',
        topMoodColor: '#E8E0D8'
      });
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  // 找峰值和低谷（仅考虑有记录的天）
  const recordedDays = trend.filter(d => d.recordCount > 0);
  let peakDay = null;
  let valleyDay = null;
  if (recordedDays.length > 0) {
    peakDay = recordedDays.reduce((a, b) => a.avgScore >= b.avgScore ? a : b);
    valleyDay = recordedDays.reduce((a, b) => a.avgScore <= b.avgScore ? a : b);
  }

  return { trend, peakDay, valleyDay };
}

/**
 * 分析天气 × 心情关联
 */
function analyzeWeatherCorrelation(records) {
  const weatherMap = {};
  const weatherEmojiMap = {
    '晴': '☀️', '晴朗': '☀️', '晴天': '☀️',
    '多云': '⛅',
    '阴': '☁️', '阴天': '☁️',
    '雨': '🌧️', '雨天': '🌧️', '小雨': '🌧️',
    '雷阵雨': '⛈️', '大雨': '🌧️',
    '雪': '❄️', '雪天': '❄️',
    '雾': '🌫️', '大风': '💨'
  };

  records.forEach(r => {
    const weather = r.weather || r.weatherText || '晴';
    let key = weather;
    if (weather.includes('雨') && !weather.includes('雷')) key = '雨天';
    else if (weather.includes('雷')) key = '雷阵雨';
    else if (weather.includes('阴')) key = '阴天';
    else if (weather.includes('多云')) key = '多云';
    else if (weather.includes('雪')) key = '雪天';
    else if (weather.includes('晴')) key = '晴天';
    else if (weather.includes('雾')) key = '雾';
    else if (weather.includes('风')) key = '大风';
    else key = weather;

    if (!weatherMap[key]) {
      weatherMap[key] = { scores: [], count: 0 };
    }
    weatherMap[key].scores.push(byName(r.mood).score);
    weatherMap[key].count++;
  });

  const correlation = Object.entries(weatherMap)
    .map(([weather, data]) => ({
      weather,
      emoji: weatherEmojiMap[weather] || '🌤️',
      count: data.count,
      avgScore: Math.round(data.scores.reduce((a, b) => a + b, 0) / data.scores.length * 10) / 10,
      barWidth: `${Math.round(data.scores.reduce((a, b) => a + b, 0) / data.scores.length / 5 * 100)}%`
    }))
    .sort((a, b) => b.count - a.count);

  // 天气影响自述统计
  const impactMap = {};
  records.forEach(r => {
    const impact = r.weatherImpact || '';
    if (impact) {
      // 归一化不同来源的值
      let normalized = impact;
      if (impact === '无' || impact === '没感觉') normalized = '没感觉';
      else if (impact === '轻微' || impact === '有一点') normalized = '有一点';
      else if (impact === '明显' || impact === '很明显') normalized = '很明显';
      else if (impact === '不确定' || impact === '说不清') normalized = '说不清';
      impactMap[normalized] = (impactMap[normalized] || 0) + 1;
    }
  });

  const impactStats = [
    { label: '很明显', count: impactMap['很明显'] || 0 },
    { label: '有一点', count: impactMap['有一点'] || 0 },
    { label: '没感觉', count: impactMap['没感觉'] || 0 },
    { label: '说不清', count: impactMap['说不清'] || 0 }
  ].filter(item => item.count > 0);

  return { correlation, impactStats };
}

/**
 * 分析情绪诱因
 */
function analyzeTriggers(records) {
  const categoryCount = { positive: 0, negative: 0, neutral: 0 };
  const triggerCount = {};
  const categoryLabels = {
    positive: { label: '正面影响', icon: '🌱', color: '#52C41A' },
    negative: { label: '负面影响', icon: '💧', color: '#E8856A' },
    neutral: { label: '中性影响', icon: '🔵', color: '#8B776B' }
  };

  records.forEach(r => {
    if (r.triggerCategory && categoryCount[r.triggerCategory] !== undefined) {
      categoryCount[r.triggerCategory]++;
    }
    if (r.triggerItems && Array.isArray(r.triggerItems)) {
      r.triggerItems.forEach(item => {
        triggerCount[item] = (triggerCount[item] || 0) + 1;
      });
    }
    // 兼容旧数据 triggers 字段
    if (r.triggers && Array.isArray(r.triggers)) {
      r.triggers.forEach(item => {
        triggerCount[item] = (triggerCount[item] || 0) + 1;
      });
    }
  });

  const total = Object.values(categoryCount).reduce((a, b) => a + b, 0);
  const stats = Object.entries(categoryCount).map(([key, count]) => ({
    key,
    label: categoryLabels[key].label,
    icon: categoryLabels[key].icon,
    color: categoryLabels[key].color,
    count,
    percentage: total > 0 ? Math.round(count / total * 100) : 0
  }));

  const topTriggers = Object.entries(triggerCount)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);

  return { stats, topTriggers, hasTriggers: total > 0 || topTriggers.length > 0 };
}

/**
 * 分析身体感受
 */
function analyzeBodyFeelings(records) {
  const feelingCount = {};
  records.forEach(r => {
    if (r.bodyFeelings && Array.isArray(r.bodyFeelings)) {
      r.bodyFeelings.forEach(f => {
        feelingCount[f] = (feelingCount[f] || 0) + 1;
      });
    }
  });

  return Object.entries(feelingCount)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
}

/**
 * 分析地点分布
 */
function analyzeLocations(records) {
  const locCount = {};
  records.forEach(r => {
    const loc = r.location || '未知';
    locCount[loc] = (locCount[loc] || 0) + 1;
  });

  return Object.entries(locCount)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 4);
}

/**
 * 获取本周高光时刻
 */
function getHighlight(records) {
  if (!records || records.length === 0) return null;

  const sorted = [...records].sort((a, b) => byName(b.mood).score - byName(a.mood).score);
  const best = sorted[0];
  const mood = byName(best.mood);

  return {
    date: best.date,
    dateLabel: shortDate(best.date),
    weekDay: weekDayName(best.date),
    time: best.time || '',
    mood: best.mood,
    emoji: mood.emoji,
    color: mood.color,
    score: mood.score,
    note: best.note || '',
    weather: best.weather || best.weatherText || ''
  };
}

// ==================== 温柔总结生成 ====================

function generateSummary(data) {
  const { ehi, ehiLevelText, avgScore, positiveRatio, negativeRatio, peakDay, valleyDay,
    weatherCorrelation, triggerAnalysis, lastWeekEhi, ehiTrend, recordingDays, totalRecords } = data;

  const parts = [];

  // 1. 开场：基于 EHI 的整体基调
  if (ehi >= 80) {
    parts.push(`这一周你的情绪状态很棒（EHI ${ehi}分），${recordingDays}天里记录了${totalRecords}次心情，你对生活的感知力很敏锐。`);
  } else if (ehi >= 60) {
    parts.push(`这一周整体状态不错（EHI ${ehi}分），情绪像一条平稳的小溪，偶尔有波澜但都在健康范围内。`);
  } else if (ehi >= 40) {
    parts.push(`这一周你的情绪有些起伏（EHI ${ehi}分），没关系，允许自己有不太好的日子，你已经很用心地在记录了。`);
  } else {
    parts.push(`这一周似乎过得不太容易（EHI ${ehi}分），你已经很努力了。如果觉得累了，可以找信任的人聊聊，或者给自己放个假。`);
  }

  // 2. 与上周对比
  if (lastWeekEhi > 0) {
    if (ehiTrend === 'up' && ehi - lastWeekEhi >= 10) {
      parts.push(`相比上周，你的情绪指数提升了${ehi - lastWeekEhi}分，这是一个很棒的进步。`);
    } else if (ehiTrend === 'down' && lastWeekEhi - ehi >= 10) {
      parts.push(`这周比上周低了${lastWeekEhi - ehi}分，情绪有起有落是正常的，下周也许会好起来。`);
    } else {
      parts.push(`和上周相比，你的情绪状态比较稳定。`);
    }
  }

  // 3. 正负面比例
  if (positiveRatio >= 60) {
    parts.push(`本周有${positiveRatio}%的时间处于积极情绪中，你值得为自己鼓掌。`);
  } else if (negativeRatio >= 40) {
    parts.push(`本周有${negativeRatio}%的时间情绪偏低，这不是你的错，情绪本身就在流动。`);
  }

  // 4. 峰值与低谷
  if (peakDay && valleyDay && peakDay.date !== valleyDay.date) {
    const peakMood = byName(peakDay.topMoodName);
    const valleyMood = byName(valleyDay.topMoodName);
    parts.push(`${peakDay.dateLabel} ${peakDay.weekDay}是你状态最好的一天（${peakMood.emoji}${peakDay.topMoodName}），而${valleyDay.dateLabel} ${valleyDay.weekDay}相对低一些（${valleyMood.emoji}${valleyDay.topMoodName}）。`);
  }

  // 5. 天气关联
  if (weatherCorrelation.correlation.length >= 2) {
    const sorted = [...weatherCorrelation.correlation].sort((a, b) => b.avgScore - a.avgScore);
    const best = sorted[0];
    const worst = sorted[sorted.length - 1];
    if (best.avgScore - worst.avgScore >= 1) {
      parts.push(`${best.emoji}${best.weather}天你的心情最好（均分${best.avgScore}），${worst.emoji}${worst.weather}天则稍低（均分${worst.avgScore}），天气和心情之间似乎有一些联系。`);
    }
  }

  // 6. 诱因
  if (triggerAnalysis.hasTriggers && triggerAnalysis.topTriggers.length > 0) {
    const top = triggerAnalysis.topTriggers[0];
    const positiveStat = triggerAnalysis.stats.find(s => s.key === 'positive');
    if (positiveStat && positiveStat.percentage >= 50) {
      parts.push(`本周正面情绪诱因占${positiveStat.percentage}%，「${top.name}」是你最常遇到的积极因素。`);
    } else {
      parts.push(`「${top.name}」是你本周最频繁的情绪诱因。`);
    }
  }

  // 7. 结尾关怀
  const closings = [
    '下周也请温柔地对待自己。',
    '继续记录，让每一份感受都被看见。',
    '愿你下周的心情，像阳光一样明亮。',
    '你已经做得很好了，下周继续加油。',
    '情绪没有好坏，记录本身就是一种力量。'
  ];
  parts.push(closings[Math.floor(Math.random() * closings.length)]);

  return parts.join(' ');
}

// ==================== 主函数 ====================

/**
 * 生成本周情绪报告
 * @param {Array} allRecords - 所有记录
 * @returns {Object} 报告数据
 */
function generateWeeklyReport(allRecords) {
  if (!allRecords || allRecords.length === 0) {
    return { empty: true };
  }

  const records = Array.isArray(allRecords) ? allRecords : Object.values(allRecords);

  // 本周（最近7天）和上周（8-14天前）
  const thisWeekRange = getRecentRange(7);
  const lastWeekRange = getRecentRange(7, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));

  const thisWeekRecords = records.filter(r => {
    const d = new Date(r.date);
    return d >= thisWeekRange.start && d <= thisWeekRange.end;
  });

  const lastWeekRecords = records.filter(r => {
    const d = new Date(r.date);
    return d >= lastWeekRange.start && d <= lastWeekRange.end;
  });

  if (thisWeekRecords.length === 0) {
    return { empty: true };
  }

  // 基础数据
  const totalRecords = thisWeekRecords.length;
  const uniqueDates = [...new Set(thisWeekRecords.map(r => r.date))];
  const recordingDays = uniqueDates.length;
  const streakDays = streak(records);

  // EHI
  const ehi = calcEHI(thisWeekRecords);
  const lastWeekEhi = lastWeekRecords.length > 0 ? calcEHI(lastWeekRecords) : 0;
  const ehiTrend = lastWeekEhi === 0 ? 'flat' : (ehi > lastWeekEhi + 3 ? 'up' : ehi < lastWeekEhi - 3 ? 'down' : 'flat');
  const ehiChange = Math.abs(ehi - lastWeekEhi);
  const ehiLevelText = ehiLevel(ehi);
  const ehiLevelCls = ehiLevelClass(ehi);

  // 平均分
  const scores = thisWeekRecords.map(r => byName(r.mood).score);
  const avgScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length * 10) / 10;
  const lastWeekAvgScore = lastWeekRecords.length > 0
    ? Math.round(lastWeekRecords.map(r => byName(r.mood).score).reduce((a, b) => a + b, 0) / lastWeekRecords.length * 10) / 10
    : 0;

  // 各模块分析
  const moodDist = analyzeMoodDistribution(thisWeekRecords);
  const dailyTrend = analyzeDailyTrend(thisWeekRecords, thisWeekRange);
  const weatherCorrelation = analyzeWeatherCorrelation(thisWeekRecords);
  const triggerAnalysis = analyzeTriggers(thisWeekRecords);
  const bodyFeelings = analyzeBodyFeelings(thisWeekRecords);
  const locations = analyzeLocations(thisWeekRecords);
  const highlight = getHighlight(thisWeekRecords);

  // 日期范围标签
  const startDate = dateKey(thisWeekRange.start);
  const endDate = dateKey(thisWeekRange.end);

  // 汇总数据用于生成总结
  const summaryData = {
    ehi, ehiLevelText, avgScore,
    positiveRatio: moodDist.positiveRatio,
    negativeRatio: moodDist.negativeRatio,
    peakDay: dailyTrend.peakDay,
    valleyDay: dailyTrend.valleyDay,
    weatherCorrelation,
    triggerAnalysis,
    lastWeekEhi,
    ehiTrend,
    recordingDays,
    totalRecords
  };

  const summary = generateSummary(summaryData);

  return {
    empty: false,
    dateRange: {
      start: shortDate(startDate),
      end: shortDate(endDate),
      startFull: startDate,
      endFull: endDate
    },
    totalRecords,
    recordingDays,
    totalDays: 7,
    streakDays,

    ehi,
    ehiLevelText,
    ehiLevelClass: ehiLevelCls,
    lastWeekEhi,
    ehiTrend,
    ehiChange,

    avgScore,
    lastWeekAvgScore,

    moodDistribution: moodDist.distribution,
    topMoods: moodDist.topMoods,
    positiveRatio: moodDist.positiveRatio,
    negativeRatio: moodDist.negativeRatio,
    neutralRatio: moodDist.neutralRatio,

    dailyTrend: dailyTrend.trend,
    peakDay: dailyTrend.peakDay,
    valleyDay: dailyTrend.valleyDay,

    weatherCorrelation: weatherCorrelation.correlation,
    weatherImpactStats: weatherCorrelation.impactStats,

    triggerStats: triggerAnalysis.stats,
    topTriggers: triggerAnalysis.topTriggers,
    hasTriggers: triggerAnalysis.hasTriggers,

    topBodyFeelings: bodyFeelings,
    topLocations: locations,

    highlight,

    summary
  };
}

module.exports = {
  generateWeeklyReport,
  calcEHI,
  ehiLevel,
  ehiLevelClass
};
