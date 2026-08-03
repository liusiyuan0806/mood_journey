/**
 * 呼吸练习与放松工具
 * 提供 4-7-8 呼吸法、方块呼吸、平静呼吸等多种练习
 */

// 呼吸练习配置
var EXERCISES = [
  {
    id: '478',
    name: '4-7-8 呼吸法',
    subtitle: '快速放松 · 助眠',
    icon: '🌙',
    color: '#6C5CE7',
    desc: '吸气4秒 · 屏息7秒 · 呼气8秒',
    rounds: 4,
    phases: [
      { id: 'inhale', name: '吸气', duration: 4, instruction: '缓慢吸气...', scale: 1.0, opacity: 0.9 },
      { id: 'hold', name: '屏息', duration: 7, instruction: '保持...', scale: 1.0, opacity: 0.7 },
      { id: 'exhale', name: '呼气', duration: 8, instruction: '缓慢呼气...', scale: 0.4, opacity: 0.4 }
    ]
  },
  {
    id: 'box',
    name: '方块呼吸',
    subtitle: '专注平衡 · 减压',
    icon: '⬜',
    color: '#00B894',
    desc: '吸气4秒 · 屏息4秒 · 呼气4秒 · 屏息4秒',
    rounds: 6,
    phases: [
      { id: 'inhale', name: '吸气', duration: 4, instruction: '吸气...', scale: 1.0, opacity: 0.9 },
      { id: 'hold', name: '屏息', duration: 4, instruction: '保持...', scale: 1.0, opacity: 0.7 },
      { id: 'exhale', name: '呼气', duration: 4, instruction: '呼气...', scale: 0.4, opacity: 0.4 },
      { id: 'hold', name: '屏息', duration: 4, instruction: '保持...', scale: 0.4, opacity: 0.5 }
    ]
  },
  {
    id: 'calm',
    name: '平静呼吸',
    subtitle: '日常舒缓 · 入门',
    icon: '🍃',
    color: '#55A868',
    desc: '吸气5秒 · 呼气5秒',
    rounds: 8,
    phases: [
      { id: 'inhale', name: '吸气', duration: 5, instruction: '深吸一口气...', scale: 1.0, opacity: 0.9 },
      { id: 'exhale', name: '呼气', duration: 5, instruction: '慢慢呼出来...', scale: 0.4, opacity: 0.4 }
    ]
  }
];

// 完成后的温柔文案
var COMPLETION_MESSAGES = [
  '你做得很棒，给自己一个温柔的拥抱吧',
  '呼吸是身体给自己的礼物，你已经收到了',
  '此刻的你，比刚才更平静了一些',
  '每一次呼吸，都是对自己的善待',
  '你已经完成了一次美好的自我关怀',
  '平静不是终点，而是你刚刚路过的一道风景',
  '你的身体感谢你的温柔对待',
  '深呼吸之后，世界好像慢了一点点'
];

// 放松小贴士
var RELAXATION_TIPS = [
  { icon: '🤲', title: '手掌放热', desc: '双手搓热，轻覆在眼睛上，感受温暖' },
  { icon: '💆', title: '耸肩放松', desc: '耸起肩膀到最高，保持5秒，然后突然放下' },
  { icon: '👣', title: '脚趾抓地', desc: '感受脚底与地面的接触，脚趾轻轻抓握5次' },
  { icon: '👁️', title: '远眺20秒', desc: '看向6米外的远处，让眼睛休息20秒' },
  { icon: '💧', title: '喝一口水', desc: '慢慢喝一口温水，感受水流过喉咙' },
  { icon: '📝', title: '写下感受', desc: '此刻有什么感受？用一个词写下来' }
];

// 获取随机完成文案
function getRandomCompletion() {
  return COMPLETION_MESSAGES[Math.floor(Math.random() * COMPLETION_MESSAGES.length)];
}

// 获取随机放松贴士
function getRandomTips(count) {
  var shuffled = RELAXATION_TIPS.slice().sort(function() { return Math.random() - 0.5; });
  return shuffled.slice(0, count || 3);
}

// 计算总时长
function getExerciseDuration(exercise) {
  var phaseTotal = exercise.phases.reduce(function(sum, p) { return sum + p.duration; }, 0);
  return phaseTotal * exercise.rounds;
}

// 格式化时长
function formatDuration(seconds) {
  var m = Math.floor(seconds / 60);
  var s = seconds % 60;
  if (m > 0) return m + '分' + (s > 0 ? s + '秒' : '');
  return s + '秒';
}

module.exports = {
  EXERCISES: EXERCISES,
  COMPLETION_MESSAGES: COMPLETION_MESSAGES,
  RELAXATION_TIPS: RELAXATION_TIPS,
  getRandomCompletion: getRandomCompletion,
  getRandomTips: getRandomTips,
  getExerciseDuration: getExerciseDuration,
  formatDuration: formatDuration
};
