// AI 情绪洞察云函数
// 基于用户本周记录生成温柔的洞察报告
// 如果大模型 API 不可用，降级到 rule-based 生成

const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

// Rule-based 洞察生成（降级方案）
function generateRuleBasedInsight(data) {
  var insights = [];
  var { avgScore, stdScore, moodCounts, weatherMoodMap, streakDays, totalRecords, topMood, lowMoodCount, noteCount } = data;

  // 1. 整体情绪评价
  if (avgScore >= 4) {
    insights.push('这周你的情绪整体偏积极，看起来你过得不错，继续保持这份好状态。');
  } else if (avgScore >= 3) {
    insights.push('这周情绪有起有伏，这是很正常的，你在认真面对自己的感受。');
  } else if (avgScore >= 2) {
    insights.push('这周可能有些辛苦，但你坚持记录了下来，这本身就是一种自我关怀。');
  } else {
    insights.push('这周对你来说可能不太容易，如果觉得累了，记得允许自己休息。');
  }

  // 2. 情绪波动
  if (stdScore > 1.2) {
    insights.push('情绪波动比较大，也许有一些事情在影响你，试试找到规律后给自己多一些准备。');
  } else if (stdScore < 0.5 && totalRecords >= 5) {
    insights.push('情绪比较稳定，这说明你有很好的自我调节能力。');
  }

  // 3. 连续记录
  if (streakDays >= 7) {
    insights.push('你已经连续记录' + streakDays + '天了，这份坚持很了不起。');
  } else if (streakDays >= 3) {
    insights.push('连续' + streakDays + '天记录，你正在养成一个好习惯。');
  }

  // 4. 低谷关怀
  if (lowMoodCount >= 3) {
    insights.push('这周有几天情绪偏低，如果持续感到低落，可以试试和朋友聊聊，或者做一次呼吸练习。');
  }

  // 5. 天气关联
  var weatherKeys = Object.keys(weatherMoodMap);
  if (weatherKeys.length >= 2) {
    var best = null, worst = null;
    weatherKeys.forEach(function(k) {
      var w = weatherMoodMap[k];
      if (!best || w.avg > best.avg) best = w;
      if (!worst || w.avg < worst.avg) worst = w;
    });
    if (best && worst && best.avg - worst.avg >= 1) {
      insights.push('你似乎在' + best.name + '天心情更好，而在' + worst.name + '天稍低，可以试试在' + worst.name + '天给自己安排一些喜欢的事。');
    }
  }

  // 6. 笔记习惯
  if (noteCount > 0 && noteCount >= totalRecords * 0.5) {
    insights.push('你经常写笔记，文字是和自己对话的好方式，未来回看时会有更多感触。');
  }

  return insights.slice(0, 3).join('\n\n');
}

exports.main = async (event) => {
  try {
    var data = event.moodData || {};
    var insight = generateRuleBasedInsight(data);

    return {
      success: true,
      insight: insight,
      source: 'rule-based'
    };
  } catch (err) {
    console.error('[getMoodInsight] error:', err);
    return {
      success: false,
      error: err.message || '生成洞察失败',
      insight: '每一份记录都是你对自己的温柔。继续记录，你会越来越了解自己。'
    };
  }
};
