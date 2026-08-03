var empathyWall = require('../../utils/empathyWall');
var { moods, byName } = require('../../utils/moods');

// 情绪筛选分类
var FILTER_CATEGORIES = [
  { key: 'all', label: '全部', emoji: '🌈' },
  { key: '开心', label: '开心', emoji: '😊' },
  { key: '难过', label: '难过', emoji: '😢' },
  { key: '焦虑', label: '焦虑', emoji: '😟' },
  { key: '平静', label: '平静', emoji: '😌' },
  { key: '疲惫', label: '疲惫', emoji: '😴' },
  { key: '感恩', label: '感恩', emoji: '🙏' },
  { key: '迷茫', label: '迷茫', emoji: '🤔' }
];

Page({
  data: {
    posts: [],
    filterCategories: FILTER_CATEGORIES,
    activeFilter: 'all',
    showPostModal: false,
    selectedMood: '',
    selectedMoodEmoji: '',
    selectedMoodColor: '',
    postContent: '',
    postContentCount: 0,
    availableMoods: [],
    totalCount: 0,
    totalHugs: 0
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 3 });
    }
    this.loadPosts();
  },

  loadPosts() {
    var allPosts = empathyWall.getAllPosts();
    var enriched = empathyWall.enrichPosts(allPosts);

    // 按时间排序（用户帖子在前，种子帖子按原顺序）
    enriched.sort(function(a, b) {
      if (!a.isSeed && b.isSeed) return -1;
      if (a.isSeed && !b.isSeed) return 1;
      return 0;
    });

    // 计算统计
    var totalHugs = enriched.reduce(function(sum, p) {
      return sum + (p.hugs || 0);
    }, 0);

    this.setData({
      posts: enriched,
      totalCount: enriched.length,
      totalHugs: totalHugs
    });
  },

  // 筛选
  tapFilter(e) {
    var key = e.currentTarget.dataset.key;
    this.setData({ activeFilter: key });

    var allPosts = empathyWall.getAllPosts();
    var enriched = empathyWall.enrichPosts(allPosts);

    if (key !== 'all') {
      enriched = enriched.filter(function(p) {
        return p.mood === key;
      });
    }

    enriched.sort(function(a, b) {
      if (!a.isSeed && b.isSeed) return -1;
      if (a.isSeed && !b.isSeed) return 1;
      return 0;
    });

    this.setData({ posts: enriched });
  },

  // 抱抱
  tapHug(e) {
    var postId = e.currentTarget.dataset.id;
    var isHugged = empathyWall.toggleHug(postId);

    // 更新列表中的抱抱数
    var posts = this.data.posts.map(function(p) {
      if (p.id === postId) {
        var newHugs = (p.hugs || 0) + (isHugged ? 1 : -1);
        return Object.assign({}, p, { hugs: newHugs, hugged: isHugged });
      }
      return p;
    });

    this.setData({ posts: posts });

    if (wx.vibrateShort) wx.vibrateShort({ type: 'light' });

    if (isHugged) {
      wx.showToast({ title: '给了一个拥抱', icon: 'none', duration: 1200 });
    }
  },

  // 打开发布弹窗
  openPostModal() {
    // 只取常用情绪作为可选项
    var availableMoods = moods.filter(function(m) {
      return ['开心', '满足', '平静', '还好', '迷茫', '疲惫', '焦虑', '烦躁', '难过', '委屈', '感恩', '期待'].indexOf(m.name) >= 0;
    });

    this.setData({
      showPostModal: true,
      availableMoods: availableMoods,
      selectedMood: '',
      selectedMoodEmoji: '',
      selectedMoodColor: '',
      postContent: '',
      postContentCount: 0
    });
  },

  // 关闭发布弹窗
  closePostModal() {
    this.setData({ showPostModal: false });
  },

  // 阻止冒泡
  stopPropagation() {},

  // 选择情绪
  selectPostMood(e) {
    var name = e.currentTarget.dataset.name;
    var mood = byName(name);
    if (!mood) return;
    this.setData({
      selectedMood: mood.name,
      selectedMoodEmoji: mood.emoji,
      selectedMoodColor: mood.color
    });
    if (wx.vibrateShort) wx.vibrateShort({ type: 'light' });
  },

  // 输入内容
  inputContent(e) {
    var value = e.detail.value;
    this.setData({
      postContent: value,
      postContentCount: value.length
    });
  },

  // 发布
  submitPost() {
    if (!this.data.selectedMood) {
      wx.showToast({ title: '请选择一种心情', icon: 'none' });
      return;
    }
    if (!this.data.postContent.trim()) {
      wx.showToast({ title: '写点什么吧', icon: 'none' });
      return;
    }
    if (this.data.postContent.length > 200) {
      wx.showToast({ title: '内容不能超过200字', icon: 'none' });
      return;
    }

    empathyWall.addPost(
      this.data.selectedMood,
      this.data.selectedMoodEmoji,
      this.data.selectedMoodColor,
      this.data.postContent.trim()
    );

    this.setData({ showPostModal: false });
    wx.showToast({ title: '发布成功', icon: 'success', duration: 1500 });

    var self = this;
    setTimeout(function() {
      self.loadPosts();
      self.setData({ activeFilter: 'all' });
    }, 500);
  }
});
