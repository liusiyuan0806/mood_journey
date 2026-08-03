/**
 * 智能提醒与节奏建议
 * 根据用户记录习惯和情绪状态生成个性化提醒
 */

var { byName } = require('./moods');
var { streak, dateKey } = require('./store');

// 提醒模板
var REMINDER_TEMPLATES = {
  // 日常提醒
  daily: [
    { time: '20:00', title: '今天记录心情了吗？', body: '花一分钟，为自己留下今天的情绪印记 🌿' },
    { time: '21:30', title: '睡前小记录', body: '今天的你过得怎么样？写下来会更好入眠 🌙' },
    { time: '12:00', title: '午间心情打卡', body: '中午了，此刻的你是什么心情？ ☀️' }
  ],
  // 连续记录中断提醒
  streak_broken: [
    { title: '我们很想念你 🌿', body: '已经3天没有记录了，回来记一笔吧？' },
    { title: '你的情绪树在等你 💚', body: '继续记录，让树茁壮成长' }
  ],
  // EHI 低分关怀
  low_ehi: [
    { title: '休息一下吧 💛', body: '最近情绪偏低，给自己一点安静的时间' },
    { title: '记得照顾自己', body: '如果觉得累，深呼吸几次，或者找信任的人聊聊' },
    { title: '温柔对待自己', body: '低落是正常的，不需要勉强开心' }
  ],
  // 连续记录成就
  streak_milestone: [
    { title: '连续3天啦！🔥', body: '你已经连续记录3天了，真棒！' },
    { title: '一周打卡完成！📅', body: '连续7天记录，你已经养成了好习惯' },
    { title: '月度观察家！🏆', body: '连续30天记录，你真的太厉害了！' }
  ],
  // 周末提醒
  weekend: [
    { title: '周末好时光', body: '这周过得怎么样？来生成你的情绪周报吧 📊' }
  ]
};

// 节奏建议
var RHYTHM_SUGGESTIONS = [
  {
    condition: function(records, stats) {
      return stats.totalRecords === 0;
    },
    icon: '🌱',
    title: '开始你的第一笔记录',
    desc: '记录此刻的心情，种下你的情绪树种子',
    action: '去记录'
  },
  {
    condition: function(records, stats) {
      return stats.totalRecords > 0 && stats.totalRecords < 5;
    },
    icon: '🌿',
    title: '试试每天记录一次',
    desc: '连续记录3天可以解锁「三日连心」徽章',
    action: '去记录'
  },
  {
    condition: function(records, stats) {
      return stats.streak >= 3 && stats.streak < 7;
    },
    icon: '🔥',
    title: '保持势头，冲击7天连续',
    // 修复：原代码 desc 在模块顶层就执行了字符串拼接 '再坚持' + (7 - stats.streak)，
    //      此时 stats 还不存在 → ReferenceError 致整个模块加载失败 → 所有引用页面白屏
    // 改为函数，condition 返回 true 时才计算
    desc: function(stats) { return '再坚持' + (7 - stats.streak) + '天就能解锁「周记录者」徽章'; },
    action: '继续记录'
  },
  {
    condition: function(records, stats) {
      return stats.avgScore && stats.avgScore < 2.5 && stats.totalRecords >= 5;
    },
    icon: '💛',
    title: '最近情绪偏低，试试呼吸练习',
    desc: '4-7-8呼吸法可以帮你快速放松，只需3分钟',
    action: '开始呼吸练习'
  },
  {
    condition: function(records, stats) {
      return stats.streak >= 7 && !stats.hasSeenWeeklyReport;
    },
    icon: '📊',
    title: '本周报告已生成',
    desc: '看看你这一周的情绪变化和温柔总结',
    action: '查看周报'
  },
  {
    condition: function(records, stats) {
      var diverseMoods = {};
      records.forEach(function(r) { if (r.mood) diverseMoods[r.mood] = true; });
      return Object.keys(diverseMoods).length < 5 && stats.totalRecords >= 10;
    },
    icon: '🎭',
    title: '探索更多情绪',
    desc: '你已经记录了很多次，试试标记不同的心情，了解自己的情绪多样性',
    action: '去记录'
  },
  {
    condition: function(records, stats) {
      var notes = records.filter(function(r) { return r.note && r.note.length > 0; });
      return notes.length < records.length * 0.3 && stats.totalRecords >= 5;
    },
    icon: '✍️',
    title: '试试写下更多',
    desc: '给心情加上文字，未来回看时会有更多感触',
    action: '去记录'
  }
];

// 获取当前应该显示的提醒
function getSmartReminders(records) {
  var reminders = [];
  var today = dateKey();
  var todayRecords = records.filter(function(r) { return r.date === today; });
  var currentStreak = streak(records);

  // 1. 今日未记录提醒
  if (todayRecords.length === 0 && records.length > 0) {
    var hour = new Date().getHours();
    if (hour >= 18) {
      var template = REMINDER_TEMPLATES.daily[0];
      reminders.push({
        type: 'daily',
        icon: '📝',
        title: template.title,
        body: template.body,
        priority: 'normal'
      });
    }
  }

  // 2. 连续记录中断提醒
  if (currentStreak === 0 && records.length > 0) {
    var lastRecord = records.reduce(function(a, b) {
      return (b.timestamp || 0) > (a.timestamp || 0) ? b : a;
    });
    var lastDate = new Date(lastRecord.timestamp || lastRecord.date);
    var daysSince = Math.floor((Date.now() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
    if (daysSince >= 3) {
      var streakTemplate = REMINDER_TEMPLATES.streak_broken[0];
      reminders.push({
        type: 'streak_broken',
        icon: '🌿',
        title: streakTemplate.title,
        body: streakTemplate.body,
        priority: 'high'
      });
    }
  }

  // 3. EHI 低分关怀
  if (records.length >= 5) {
    var scores = records.map(function(r) { return byName(r.mood).score; });
    var avg = scores.reduce(function(a, b) { return a + b; }, 0) / scores.length;
    var recentScores = scores.slice(-5);
    var recentAvg = recentScores.reduce(function(a, b) { return a + b; }, 0) / recentScores.length;
    if (recentAvg < 2.5) {
      var careTemplate = REMINDER_TEMPLATES.low_ehi[Math.floor(Math.random() * REMINDER_TEMPLATES.low_ehi.length)];
      reminders.push({
        type: 'low_ehi',
        icon: '💛',
        title: careTemplate.title,
        body: careTemplate.body,
        priority: 'high',
        action: 'breathing'
      });
    }
  }

  // 4. 连续记录里程碑
  if (currentStreak === 3 || currentStreak === 7 || currentStreak === 30) {
    var milestoneTemplate = REMINDER_TEMPLATES.streak_milestone[
      currentStreak === 3 ? 0 : currentStreak === 7 ? 1 : 2
    ];
    // 检查是否已经提示过
    var notifiedKey = 'notified_streak_' + currentStreak;
    if (!wx.getStorageSync(notifiedKey)) {
      reminders.push({
        type: 'streak_milestone',
        icon: currentStreak === 3 ? '🔥' : currentStreak === 7 ? '📅' : '🏆',
        title: milestoneTemplate.title,
        body: milestoneTemplate.body,
        priority: 'normal'
      });
      wx.setStorageSync(notifiedKey, true);
    }
  }

  // 5. 周末周报提醒
  var dayOfWeek = new Date().getDay();
  if ((dayOfWeek === 0 || dayOfWeek === 6) && records.length >= 7) {
    var weekReportKey = 'notified_weekly_' + dateKey();
    if (!wx.getStorageSync(weekReportKey)) {
      var weekendTemplate = REMINDER_TEMPLATES.weekend[0];
      reminders.push({
        type: 'weekend',
        icon: '📊',
        title: weekendTemplate.title,
        body: weekendTemplate.body,
        priority: 'low',
        action: 'weekly_report'
      });
      wx.setStorageSync(weekReportKey, true);
    }
  }

  return reminders;
}

// 获取节奏建议
function getRhythmSuggestion(records) {
  var scores = records.map(function(r) { return byName(r.mood).score; });
  var avg = scores.length ? scores.reduce(function(a, b) { return a + b; }, 0) / scores.length : 0;
  var diverseMoods = {};
  records.forEach(function(r) { if (r.mood) diverseMoods[r.mood] = true; });

  var stats = {
    totalRecords: records.length,
    streak: streak(records),
    avgScore: avg,
    hasSeenWeeklyReport: !!wx.getStorageSync('seen_weekly_report')
  };

  for (var i = 0; i < RHYTHM_SUGGESTIONS.length; i++) {
    var suggestion = RHYTHM_SUGGESTIONS[i];
    try {
      if (suggestion.condition(records, stats)) {
        var descText = (typeof suggestion.desc === 'function') ? suggestion.desc(stats) : suggestion.desc;
        return {
          icon: suggestion.icon,
          title: suggestion.title,
          desc: descText,
          action: suggestion.action
        };
      }
    } catch (e) {
      // 忽略条件检查错误
    }
  }

  return null;
}

// 请求订阅消息
function requestNotification() {
  return new Promise(function(resolve, reject) {
    if (!wx.requestSubscribeMessage) {
      reject(new Error('当前版本不支持订阅消息'));
      return;
    }
    wx.requestSubscribeMessage({
      tmplIds: ['daily_reminder_template'], // 需要在小程序后台配置模板
      success: function(res) {
        resolve(res);
      },
      fail: function(err) {
        reject(err);
      }
    });
  });
}

module.exports = {
  REMINDER_TEMPLATES: REMINDER_TEMPLATES,
  RHYTHM_SUGGESTIONS: RHYTHM_SUGGESTIONS,
  getSmartReminders: getSmartReminders,
  getRhythmSuggestion: getRhythmSuggestion,
  requestNotification: requestNotification
};
