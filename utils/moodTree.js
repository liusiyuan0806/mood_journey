/**
 * 情绪树成长系统
 * 根据用户记录数据生成程序化的情绪树
 * 每次记录生成一颗"心情果实"，颜色映射情绪分值
 */

var { byName } = require('./moods');
var { dateKey } = require('./store');

// 树的等级配置
var TREE_LEVELS = [
  { level: 0, name: '种子', minRecords: 0, trunkHeight: 40, branchCount: 0, leafCount: 0, color: '#D4A574' },
  { level: 1, name: '嫩芽', minRecords: 1, trunkHeight: 60, branchCount: 2, leafCount: 3, color: '#8FBC5A' },
  { level: 2, name: '小树苗', minRecords: 5, trunkHeight: 90, branchCount: 4, leafCount: 8, color: '#7BAB4A' },
  { level: 3, name: '小树', minRecords: 15, trunkHeight: 120, branchCount: 6, leafCount: 15, color: '#6B9B3A' },
  { level: 4, name: '成长树', minRecords: 30, trunkHeight: 150, branchCount: 8, leafCount: 25, color: '#5B8B2A' },
  { level: 5, name: '繁茂之树', minRecords: 50, trunkHeight: 170, branchCount: 10, leafCount: 35, color: '#4B7B1A' },
  { level: 6, name: '智慧之树', minRecords: 100, trunkHeight: 180, branchCount: 12, leafCount: 50, color: '#3B6B0A' }
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
  // 取最近的记录生成果实（最多50颗，避免过密）
  var maxFruits = 50;
  var recentRecords = records.slice(-maxFruits);

  return recentRecords.map(function(r, idx) {
    var moodInfo = byName(r.mood);
    var noteLen = (r.note || '').length;
    var seed = parseInt((r.id || '').replace(/[^0-9]/g, '').slice(0, 8)) || idx * 1000 + 1;

    // 果实位置：基于种子在树冠区域随机分布
    var angle = seededRandom(seed) * Math.PI * 2;
    var radius = 30 + seededRandom(seed + 1) * 60;
    var cx = 150 + Math.cos(angle) * radius;
    var cy = 100 + Math.sin(angle) * radius * 0.7;

    // 果实大小：笔记字数影响（10-26rpx）
    var size = 10 + Math.min(16, noteLen / 10);

    // 果实颜色：情绪分值映射
    var color = moodInfo.color;

    // 是否有笔记（决定果实是否有光泽）
    hasNote = noteLen > 0;

    return {
      id: r.id,
      cx: Math.round(cx),
      cy: Math.round(cy),
      r: Math.round(size),
      color: color,
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

// 生成树枝路径（SVG path）
function generateBranches(level) {
  var branches = [];
  var trunkH = level.trunkHeight;
  var cx = 150; // 树干中心 x
  var baseY = 300; // 树干底部 y

  // 主干
  branches.push({
    type: 'trunk',
    d: 'M ' + cx + ' ' + baseY + ' Q ' + (cx - 3) + ' ' + (baseY - trunkH / 2) + ' ' + cx + ' ' + (baseY - trunkH),
    width: Math.max(4, trunkH / 20)
  });

  // 侧枝
  var branchCount = level.branchCount;
  for (var i = 0; i < branchCount; i++) {
    var t = (i + 1) / (branchCount + 1);
    var by = baseY - trunkH * t;
    var side = i % 2 === 0 ? -1 : 1;
    var spread = 30 + seededRandom(i * 100 + 7) * 40;
    var len = 30 + seededRandom(i * 100 + 3) * 30;
    var endX = cx + side * spread;
    var endY = by - len;
    var ctrlX = cx + side * spread * 0.5;
    var ctrlY = by - len * 0.3;

    branches.push({
      type: 'branch',
      d: 'M ' + cx + ' ' + by + ' Q ' + ctrlX + ' ' + ctrlY + ' ' + endX + ' ' + endY,
      width: Math.max(2, trunkH / 30)
    });
  }

  return branches;
}

// 生成树叶位置
function generateLeaves(level) {
  var leaves = [];
  var count = level.leafCount;
  for (var i = 0; i < count; i++) {
    var angle = seededRandom(i * 50 + 11) * Math.PI * 2;
    var radius = 20 + seededRandom(i * 50 + 22) * 70;
    var x = 150 + Math.cos(angle) * radius;
    var y = 200 + Math.sin(angle) * radius * 0.6;
    var size = 6 + seededRandom(i * 50 + 33) * 6;
    var rotation = seededRandom(i * 50 + 44) * 360;

    leaves.push({
      x: Math.round(x),
      y: Math.round(y),
      size: Math.round(size),
      rotation: Math.round(rotation),
      delay: i * 0.03
    });
  }
  return leaves;
}

// 生成完整的树数据
function generateTreeData(records) {
  var level = getTreeLevel(records);
  var progress = getProgressToNext(records);
  var branches = generateBranches(level);
  var leaves = generateLeaves(level);
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
    branches: branches,
    leaves: leaves,
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
  generateBranches: generateBranches,
  generateLeaves: generateLeaves,
  generateTreeData: generateTreeData
};
