/**
 * 共情墙数据管理
 * 匿名分享情绪，互相温暖
 */

var STORAGE_KEY = 'empathy_wall_posts';
var HUG_KEY = 'empathy_wall_hugs';
var MY_POSTS_KEY = 'empathy_wall_my_posts';

// 种子数据 — 让共情墙一开始就有温度
var SEED_POSTS = [
  {
    id: 'seed_1',
    mood: '焦虑',
    emoji: '😟',
    color: '#F6D2AD',
    content: '明天有个重要的面试，紧张到睡不着。但看到大家都在一起努力，觉得没那么孤单了。',
    author: '匿名·星星',
    timeText: '2小时前',
    hugs: 128,
    isSeed: true
  },
  {
    id: 'seed_2',
    mood: '满足',
    emoji: '🥰',
    color: '#CDEFC7',
    content: '今天给自己做了一顿饭，虽然很简单，但吃的时候觉得很幸福。原来快乐可以这么简单。',
    author: '匿名·云朵',
    timeText: '5小时前',
    hugs: 256,
    isSeed: true
  },
  {
    id: 'seed_3',
    mood: '疲惫',
    emoji: '😴',
    color: '#CFD8E8',
    content: '连续加班一周了，今天终于可以早点休息。大家也要注意身体呀，别太拼了。',
    author: '匿名·月亮',
    timeText: '昨天',
    hugs: 89,
    isSeed: true
  },
  {
    id: 'seed_4',
    mood: '开心',
    emoji: '😊',
    color: '#B9E6C9',
    content: '今天路上遇到一只小猫，它居然主动过来蹭我的腿！一整天心情都超级好！',
    author: '匿名·阳光',
    timeText: '昨天',
    hugs: 312,
    isSeed: true
  },
  {
    id: 'seed_5',
    mood: '迷茫',
    emoji: '🤔',
    color: '#D7D6EB',
    content: '不知道自己选的路对不对，但想起一句话：不是所有路都要有答案，走着的本身就是答案。',
    author: '匿名·风',
    timeText: '2天前',
    hugs: 167,
    isSeed: true
  },
  {
    id: 'seed_6',
    mood: '难过',
    emoji: '😢',
    color: '#BBD4EE',
    content: '今天和朋友吵架了。其实不是什么大事，但就是很难过。希望明天能鼓起勇气去道歉。',
    author: '匿名·雨',
    timeText: '2天前',
    hugs: 203,
    isSeed: true
  },
  {
    id: 'seed_7',
    mood: '感恩',
    emoji: '🙏',
    color: '#C5E7C6',
    content: '感谢妈妈今天打来的电话，虽然只是聊了几句家常，但挂掉之后心里暖暖的。',
    author: '匿名·暖阳',
    timeText: '3天前',
    hugs: 198,
    isSeed: true
  },
  {
    id: 'seed_8',
    mood: '平静',
    emoji: '😌',
    color: '#C8E5D1',
    content: '坐在窗边看了一下午的书，外面下着小雨。有些日子不需要做什么特别的事，就已经很好了。',
    author: '匿名·茶',
    timeText: '3天前',
    hugs: 145,
    isSeed: true
  }
];

// 匿名昵称池
var AUTHOR_NAMES = [
  '匿名·星星', '匿名·云朵', '匿名·月亮', '匿名·阳光',
  '匿名·风', '匿名·雨', '匿名·暖阳', '匿名·茶',
  '匿名·树', '匿名·海', '匿名·光', '匿名·影',
  '匿名·花', '匿名·雪', '匿名·叶', '匿名·梦'
];

// 获取所有帖子（种子 + 用户发布的）
function getAllPosts() {
  var myPosts = wx.getStorageSync(MY_POSTS_KEY) || [];
  return SEED_POSTS.concat(myPosts);
}

// 获取已抱抱的帖子ID
function getHuggedIds() {
  return wx.getStorageSync(HUG_KEY) || [];
}

// 发布帖子
function addPost(mood, emoji, color, content) {
  var myPosts = wx.getStorageSync(MY_POSTS_KEY) || [];
  var author = AUTHOR_NAMES[Math.floor(Math.random() * AUTHOR_NAMES.length)];
  var post = {
    id: 'my_' + Date.now(),
    mood: mood,
    emoji: emoji,
    color: color,
    content: content,
    author: author,
    timeText: '刚刚',
    hugs: 0,
    isSeed: false,
    timestamp: Date.now()
  };
  myPosts.unshift(post);
  wx.setStorageSync(MY_POSTS_KEY, myPosts);
  return post;
}

// 抱抱帖子
function toggleHug(postId) {
  var hugged = getHuggedIds();
  var idx = hugged.indexOf(postId);
  var isHugged;
  if (idx >= 0) {
    hugged.splice(idx, 1);
    isHugged = false;
  } else {
    hugged.push(postId);
    isHugged = true;
  }
  wx.setStorageSync(HUG_KEY, hugged);
  return isHugged;
}

// 更新用户帖子的抱抱数和时间文本
function enrichPosts(posts) {
  var hugged = getHuggedIds();
  var now = Date.now();
  return posts.map(function(p) {
    var result = Object.assign({}, p);
    result.hugged = hugged.indexOf(p.id) >= 0;

    // 更新时间文本
    if (!p.isSeed && p.timestamp) {
      var diff = now - p.timestamp;
      if (diff < 60000) result.timeText = '刚刚';
      else if (diff < 3600000) result.timeText = Math.floor(diff / 60000) + '分钟前';
      else if (diff < 86400000) result.timeText = Math.floor(diff / 3600000) + '小时前';
      else result.timeText = Math.floor(diff / 86400000) + '天前';
    }

    return result;
  });
}

module.exports = {
  SEED_POSTS: SEED_POSTS,
  getAllPosts: getAllPosts,
  getHuggedIds: getHuggedIds,
  addPost: addPost,
  toggleHug: toggleHug,
  enrichPosts: enrichPosts
};
