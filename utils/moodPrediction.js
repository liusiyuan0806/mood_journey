/**
 * 情绪预测与预警
 * 基于历史数据的简单滑动平均 + 趋势外推
 */

var { byName } = require('./moods');
var { dateKey } = require('./store');

// 计算滑动平均
function movingAverage(scores, window) {
  if (scores.length < window) return scores.slice();
  var result = [];
  for (var i = 0; i < scores.length; i++) {
    var start = Math.max(0, i - window + 1);
    var slice = scores.slice(start, i + 1);
    var avg = slice.reduce(function(a, b) { return a + b; }, 0) / slice.length;
    result.push(Math.round(avg * 100) / 100);
  }
  return result;
}

// 线性回归（最小二乘法）
function linearRegression(points) {
  var n = points.length;
  if (n < 2) return { slope: 0, intercept: points.length ? points[0].y : 3 };

  var sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
  for (var i = 0; i < n; i++) {
    sumX += points[i].x;
    sumY += points[i].y;
    sumXY += points[i].x * points[i].y;
    sumXX += points[i].x * points[i].x;
  }

  var denominator = n * sumXX - sumX * sumX;
  if (Math.abs(denominator) < 0.0001) return { slope: 0, intercept: sumY / n };

  var slope = (n * sumXY - sumX * sumY) / denominator;
  var intercept = (sumY - slope * sumX) / n;

  return { slope: slope, intercept: intercept };
}

// 预测未来N天情绪趋势
function predictMood(records, predictDays) {
  predictDays = predictDays || 3;
  if (records.length < 3) {
    return {
      hasData: false,
      message: '再记录几天，就能为你预测情绪趋势了'
    };
  }

  // 按日期分组，计算每天的平均分
  var dayMap = {};
  records.forEach(function(r) {
    if (!dayMap[r.date]) dayMap[r.date] = [];
    dayMap[r.date].push(byName(r.mood).score);
  });

  // 取最近14天的数据
  var today = new Date();
  today.setHours(0, 0, 0, 0);
  var historicalDays = [];

  for (var i = 13; i >= 0; i--) {
    var d = new Date(today);
    d.setDate(d.getDate() - i);
    var dKey = dateKey(d);
    if (dayMap[dKey]) {
      var scores = dayMap[dKey];
      var avg = scores.reduce(function(a, b) { return a + b; }, 0) / scores.length;
      historicalDays.push({
        date: dKey,
        score: Math.round(avg * 100) / 100,
        dayOffset: 13 - i,
        hasRecord: true
      });
    } else {
      historicalDays.push({
        date: dKey,
        score: null,
        dayOffset: 13 - i,
        hasRecord: false
      });
    }
  }

  // 只用有记录的天做回归
  var validPoints = historicalDays
    .filter(function(d) { return d.hasRecord; })
    .map(function(d) { return { x: d.dayOffset, y: d.score }; });

  if (validPoints.length < 3) {
    return {
      hasData: false,
      message: '再记录几天，就能为你预测情绪趋势了'
    };
  }

  // 线性回归
  var regression = linearRegression(validPoints);

  // 滑动平均
  var validScores = validPoints.map(function(p) { return p.y; });
  var ma = movingAverage(validScores, Math.min(3, validScores.length));

  // 预测未来N天
  var predictions = [];
  for (var j = 0; j < predictDays; j++) {
    var futureOffset = 13 + j + 1;
    var predictedScore = regression.slope * futureOffset + regression.intercept;
    predictedScore = Math.max(1, Math.min(5, predictedScore));
    predictedScore = Math.round(predictedScore * 100) / 100;

    var futureDate = new Date(today);
    futureDate.setDate(futureDate.getDate() + j + 1);

    predictions.push({
      date: dateKey(futureDate),
      score: predictedScore,
      dayOffset: futureOffset,
      isPrediction: true
    });
  }

  // 趋势判断
  var trend = 'stable';
  if (regression.slope > 0.05) trend = 'up';
  else if (regression.slope < -0.05) trend = 'down';

  // 预警判断
  var warning = null;
  var avgPrediction = predictions.reduce(function(a, b) { return a + b.score; }, 0) / predictions.length;
  if (avgPrediction < 2.5) {
    warning = {
      level: 'care',
      title: '情绪可能偏低',
      desc: '根据近期趋势，未来几天情绪可能偏低。记得照顾自己，试试呼吸练习或找朋友聊聊。',
      icon: '💛'
    };
  } else if (trend === 'down' && regression.slope < -0.1) {
    warning = {
      level: 'attention',
      title: '情绪有下降趋势',
      desc: '最近几天的情绪有所下降，注意给自己一些休息时间。',
      icon: '🌸'
    };
  }

  // 合并历史和预测数据用于图表
  var chartData = {
    historical: historicalDays.filter(function(d) { return d.hasRecord; }),
    predictions: predictions,
    movingAverage: ma,
    trend: trend,
    slope: regression.slope,
    warning: warning
  };

  return {
    hasData: true,
    chartData: chartData,
    warning: warning,
    trend: trend,
    trendText: trend === 'up' ? '上升趋势' : trend === 'down' ? '下降趋势' : '平稳',
    nextDays: predictions
  };
}

// 预测文本描述
function getPredictionText(prediction) {
  if (!prediction.hasData) return prediction.message;

  var text = '';
  if (prediction.trend === 'up') {
    text = '近期情绪呈上升趋势，继续保持 📈';
  } else if (prediction.trend === 'down') {
    text = '近期情绪略有下降，给自己多一点关爱 🌸';
  } else {
    text = '情绪整体平稳，状态不错 🌿';
  }

  if (prediction.warning) {
    text += '\n' + prediction.warning.desc;
  }

  return text;
}

module.exports = {
  movingAverage: movingAverage,
  linearRegression: linearRegression,
  predictMood: predictMood,
  getPredictionText: getPredictionText
};
