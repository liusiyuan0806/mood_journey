/**
 * 徽章成就系统
 * 基于用户记录数据自动解锁徽章
 */

const { byName } = require('./moods');
const { streak, dateKey } = require('./store');

// 徽章定义
const BADGE_DEFS = [
  {
    id: 'first_heart',
    name: '初心',
    icon: '🌱',
    desc: '记录第一笔心情',
    color: '#52C41A',
    check: function(records) {
      return records.length >= 1;
    }
  },
  {
    id: 'three_day',
    name: '三日连心',
    icon: '🔥',
    desc: '连续记录3天',
    color: '#F5B27A',
    check: function(records) {
      return streak(records) >= 3;
    }
  },
  {
    id: 'weekly_recorder',
    name: '周记录者',
    icon: '📅',
    desc: '连续记录7天',
    color: '#E8856A',
    check: function(records) {
      return streak(records) >= 7;
    }
  },
  {
    id: 'monthly_observer',
    name: '月观察家',
    icon: '🏆',
    desc: '连续记录30天',
    color: '#FFD700',
    check: function(records) {
      return streak(records) >= 30;
    }
  },
  {
    id: 'diverse_emotions',
    name: '多元情绪',
    icon: '🎭',
    desc: '体验过10种不同心情',
    color: '#9B59B6',
    check: function(records) {
      var moods = {};
      records.forEach(function(r) {
        if (r.mood) moods[r.mood] = true;
      });
      return Object.keys(moods).length >= 10;
    }
  },
  {
    id: 'sunny_day',
    name: '阳光日',
    icon: '☀️',
    desc: '10次晴天时心情≥4分',
    color: '#FFA500',
    check: function(records) {
      var count = 0;
      records.forEach(function(r) {
        if (r.weather && r.weather.indexOf('晴') >= 0 && byName(r.mood).score >= 4) count++;
      });
      return count >= 10;
    }
  },
  {
    id: 'rainbow_after_rain',
    name: '雨后彩虹',
    icon: '🌈',
    desc: '5次雨天后第二天心情≥4分',
    color: '#7BC97D',
    check: function(records) {
      if (records.length < 2) return false;
      var sorted = records.slice().sort(function(a, b) {
        return (a.timestamp || 0) - (b.timestamp || 0);
      });
      var count = 0;
      for (var i = 1; i < sorted.length; i++) {
        var prev = sorted[i - 1];
        var curr = sorted[i];
        if (prev.weather && prev.weather.indexOf('雨') >= 0) {
          var prevDate = new Date(prev.timestamp || prev.date);
          var currDate = new Date(curr.timestamp || curr.date);
          var diffDays = Math.round((currDate - prevDate) / (1000 * 60 * 60 * 24));
          if (diffDays === 1 && byName(curr.mood).score >= 4) count++;
        }
      }
      return count >= 5;
    }
  },
  {
    id: 'self_explorer',
    name: '自我探索',
    icon: '📝',
    desc: '写满30条笔记',
    color: '#3498DB',
    check: function(records) {
      var count = 0;
      records.forEach(function(r) {
        if (r.note && r.note.length > 0) count++;
      });
      return count >= 30;
    }
  },
  {
    id: 'objective_analysis',
    name: '客观分析',
    icon: '💎',
    desc: '情绪健康指数EHI≥80',
    color: '#E84393',
    check: function(records) {
      if (!records.length) return false;
      var scores = records.map(function(r) { return byName(r.mood).score; });
      var avg = scores.reduce(function(a, b) { return a + b; }, 0) / scores.length;
      var sumSq = 0;
      for (var i = 0; i < scores.length; i++) {
        sumSq += Math.pow(scores[i] - avg, 2);
      }
      var std = Math.sqrt(sumSq / scores.length);
      var low = 0;
      for (var j = scores.length - 1; j >= 0 && scores[j] <= 2; j--) low++;
      var streakBonus = streak(records) >= 7 ? 5 : streak(records) >= 3 ? 2 : 0;
      var ehi = Math.max(0, Math.min(100, Math.round(avg / 5 * 100 - std * 3 - low + streakBonus)));
      return ehi >= 80;
    }
  },
  {
    id: 'gentle_recording',
    name: '温柔记录',
    icon: '☔',
    desc: '雨天写笔记≥50字×5次',
    color: '#74B9FF',
    check: function(records) {
      var count = 0;
      records.forEach(function(r) {
        if (r.weather && r.weather.indexOf('雨') >= 0 && r.note && r.note.length >= 50) count++;
      });
      return count >= 5;
    }
  },
  {
    id: 'early_bird',
    name: '晨间记录',
    icon: '🌅',
    desc: '在6:00-9:00记录10次',
    color: '#FDCB6E',
    check: function(records) {
      var count = 0;
      records.forEach(function(r) {
        if (r.time) {
          var hour = parseInt(r.time.split(':')[0]);
          if (hour >= 6 && hour < 9) count++;
        }
      });
      return count >= 10;
    }
  },
  {
    id: 'night_owl',
    name: '夜深记录',
    icon: '🌙',
    desc: '在22:00后记录10次',
    color: '#6C5CE7',
    check: function(records) {
      var count = 0;
      records.forEach(function(r) {
        if (r.time) {
          var hour = parseInt(r.time.split(':')[0]);
          if (hour >= 22 || hour < 2) count++;
        }
      });
      return count >= 10;
    }
  }
];

// 获取所有徽章的解锁状态
function getBadgeStatus(records) {
  var unlockedIds = wx.getStorageSync('unlocked_badges') || [];
  var newlyUnlocked = [];

  var badges = BADGE_DEFS.map(function(def) {
    var isUnlocked = def.check(records);
    var wasUnlocked = unlockedIds.indexOf(def.id) >= 0;
    var isNew = isUnlocked && !wasUnlocked;

    if (isNew) {
      newlyUnlocked.push({
        id: def.id,
        name: def.name,
        icon: def.icon,
        desc: def.desc,
        color: def.color
      });
    }

    return {
      id: def.id,
      name: def.name,
      icon: def.icon,
      desc: def.desc,
      color: def.color,
      unlocked: isUnlocked,
      isNew: isNew
    };
  });

  // 更新已解锁列表
  var allUnlocked = badges.filter(function(b) { return b.unlocked; }).map(function(b) { return b.id; });
  wx.setStorageSync('unlocked_badges', allUnlocked);

  return {
    badges: badges,
    unlockedCount: allUnlocked.length,
    totalCount: BADGE_DEFS.length,
    newlyUnlocked: newlyUnlocked
  };
}

// 获取已解锁徽章数量（不触发检查，仅读取缓存）
function getUnlockedCount() {
  var list = wx.getStorageSync('unlocked_badges') || [];
  return list.length;
}

module.exports = {
  BADGE_DEFS: BADGE_DEFS,
  getBadgeStatus: getBadgeStatus,
  getUnlockedCount: getUnlockedCount
};
