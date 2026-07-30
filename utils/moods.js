const moods = [
  ['😊','开心',5,'#B9E6C9'],['🥰','满足',5,'#CDEFC7'],['😌','平静',4,'#C8E5D1'],['🤩','兴奋',5,'#FFE19A'],
  ['🙂','还好',3,'#F8E7A7'],['😐','一般',3,'#EAE4D7'],['🤔','迷茫',2,'#D7D6EB'],['😴','疲惫',2,'#CFD8E8'],
  ['😟','焦虑',2,'#F6D2AD'],['😤','烦躁',2,'#F7B7A5'],['😢','难过',1,'#BBD4EE'],['😭','委屈',1,'#C5C5E8'],
  ['😠','生气',1,'#F5AAA6'],['😨','害怕',1,'#E3C5DB'],['🥺','孤单',1,'#D6C8E9'],['😮‍💨','压力大',2,'#D4DCE9'],
  ['🙏','感恩',5,'#C5E7C6'],['💪','有力量',4,'#D0E9C2'],['😎','自在',4,'#C8E7E6'],['🌈','期待',4,'#F5D6AB']
].map(([emoji,name,score,color]) => ({ emoji,name,score,color }));
const byName = name => moods.find(item => item.name === name) || moods[4];
module.exports = { moods, byName };
