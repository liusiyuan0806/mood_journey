/**
 * 情绪树成长系统
 * 根据用户记录数据生成程序化的情绪树
 * 每次记录生成一颗"心情果实"，颜色映射情绪分值
 */

var { byName } = require('./moods');

// 画布常量（设计基准 750rpx）
var CANVAS_W = 750;
var CANVAS_H = 580;

// 背景图树冠区域（基于 image/tree-bg.png 的 480x480 透明树图，居中放置）
var BG_W = 480;
var BG_H = 480;
var BG_LEFT = (CANVAS_W - BG_W) / 2; // 135
var BG_TOP = 20; // 背景图顶部距 canvas 顶部
var BG_BOTTOM = BG_TOP + BG_H; // 500

// 树冠在背景图中的大致区域（相对背景图左上角）
// 新树冠更宽更扁：中心偏上，水平半径大，垂直半径小
var CROWN_REL_CX = BG_W / 2; // 240
var CROWN_REL_CY = 175; // 树冠中心相对背景图顶部
var CROWN_REL_RX = 220; // 树冠水平半径
var CROWN_REL_RY = 130; // 树冠垂直半径

// 转换为绝对 canvas 坐标
var CROWN_CX = BG_LEFT + CROWN_REL_CX; // 375
var CROWN_CY = BG_TOP + CROWN_REL_CY; // 195
var CROWN_RX = CROWN_REL_RX; // 220
var CROWN_RY = CROWN_REL_RY; // 130

// 树的等级配置
var TREE_LEVELS = [
  { level: 0, name: '种子', minRecords: 0, fruitScale: 0.0, color: '#D4A574' },
  { level: 1, name: '嫩芽', minRecords: 1, fruitScale: 0.82, color: '#8FBC5A' },
  { level: 2, name: '小树苗', minRecords: 5, fruitScale: 0.88, color: '#7BAB4A' },
  { level: 3, name: '小树', minRecords: 15, fruitScale: 0.94, color: '#6B9B3A' },
  { level: 4, name: '成长树', minRecords: 30, fruitScale: 1.0, color: '#5B8B2A' },
  { level: 5, name: '繁茂之树', minRecords: 50, fruitScale: 1.04, color: '#4B7B1A' },
  { level: 6, name: '智慧之树', minRecords: 100, fruitScale: 1.08, color: '#3B6B0A' }
];

// 获取树的当前等级
function getTreeLevel(records) {
  var count = records.length;
  var level = TREE_LEVELS[0];
  for (var i = 0; i < TREE_LEVELS.length; i++) {
    if (count >= TREE_LEVELS[i].minRecords) {
      level = TREE_LEVELS[i];
    }
  }
  return level;
}

// 下一等级信息
function getNextLevel(currentLevel) {
  for (var i = 0; i < TREE_LEVELS.length; i++) {
    if (TREE_LEVELS[i].level === currentLevel.level && i < TREE_LEVELS.length - 1) {
      return TREE_LEVELS[i + 1];
    }
  }
  return null;
}

// 距离下一等级需要的记录数
function getProgressToNext(records) {
  var current = getTreeLevel(records);
  var next = getNextLevel(current);
  if (!next) return { current: current, next: null, progress: 100, remaining: 0 };

  var progress = Math.round((records.length - current.minRecords) / (next.minRecords - current.minRecords) * 100);
  progress = Math.max(0, Math.min(100, progress));
  return {
    current: current,
    next: next,
    progress: progress,
    remaining: next.minRecords - records.length
  };
}

// 种子随机数（保证同一天同一记录生成的果实位置不变）
function seededRandom(seed) {
  var x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

// 生成果实数据
function generateFruits(records) {
  var level = getTreeLevel(records);
  var scale = level.fruitScale || 0.82;

  // 取最近的记录生成果实（最多50颗，避免过密）
  var maxFruits = 50;
  var recentRecords = records.slice(-maxFruits);

  return recentRecords.map(function(r, idx) {
    var moodInfo = byName(r.mood);
    var noteLen = (r.note || '').length;
    var seed = parseInt((r.id || '').replace(/[^0-9]/g, '').slice(0, 8)) || idx * 1000 + 1;

    // 果实位置：在树冠椭圆内均匀分布
    var angle = seededRandom(seed) * Math.PI * 2;
    var maxRadiusX = CROWN_RX * scale * 0.85;
    var maxRadiusY = CROWN_RY * scale * 0.85;
    var t = Math.sqrt(seededRandom(seed + 1));
    var cx = Math.round(CROWN_CX + Math.cos(angle) * maxRadiusX * t);
    var cy_ = Math.round(CROWN_CY + Math.sin(angle) * maxRadiusY * t);

    // 避免果实沉到树冠主体底部以下（树干顶部约 y=390）
    var minY = CROWN_CY - CROWN_RY * scale * 0.85;
    var maxY = CROWN_CY + CROWN_RY * scale * 0.45;
    cy_ = Math.max(minY, Math.min(maxY, cy_));

    // 果实大小：笔记字数影响（10-28rpx）
    var size = (10 + Math.min(16, noteLen / 10)) * scale;

    // 是否有笔记（决定果实是否有光泽）
    var hasNote = noteLen > 0;

    return {
      id: r.id,
      cx: cx,
      cy: cy_,
      r: Math.round(size),
      color: moodInfo.color,
      emoji: moodInfo.emoji,
      moodName: r.mood,
      score: moodInfo.score,
      date: r.date,
      time: r.time || '',
      note: r.note || '',
      weather: r.weather || '',
      hasNote: hasNote,
      delay: idx * 0.05
    };
  });
}

// 生成完整的树数据
function generateTreeData(records) {
  var level = getTreeLevel(records);
  var progress = getProgressToNext(records);
  var fruits = generateFruits(records);

  // 统计果实颜色分布
  var moodStats = {};
  fruits.forEach(function(f) {
    if (!moodStats[f.moodName]) {
      moodStats[f.moodName] = { count: 0, color: f.color, emoji: f.emoji };
    }
    moodStats[f.moodName].count++;
  });

  // 转为数组并排序
  var moodList = Object.keys(moodStats).map(function(key) {
    return { name: key, count: moodStats[key].count, color: moodStats[key].color, emoji: moodStats[key].emoji };
  }).sort(function(a, b) { return b.count - a.count; });

  return {
    level: level,
    progress: progress,
    fruits: fruits,
    moodList: moodList,
    totalRecords: records.length,
    fruitCount: fruits.length
  };
}

module.exports = {
  TREE_LEVELS: TREE_LEVELS,
  getTreeLevel: getTreeLevel,
  getNextLevel: getNextLevel,
  getProgressToNext: getProgressToNext,
  generateFruits: generateFruits,
  generateTreeData: generateTreeData
};
