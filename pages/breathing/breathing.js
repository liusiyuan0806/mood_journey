var { EXERCISES, getRandomCompletion, getRandomTips, getExerciseDuration, formatDuration } = require('../../utils/breathing');

Page({
  data: {
    exercises: EXERCISES,
    selectedExercise: null,
    isRunning: false,
    isPaused: false,
    currentRound: 0,
    currentPhaseIndex: 0,
    currentPhase: null,
    countdown: 0,
    totalDuration: 0,
    elapsed: 0,
    showCompletion: false,
    completionMessage: '',
    tips: [],
    selectedExerciseId: ''
  },

  timer: null,

  onLoad(q) {
    // 如果从记录页跳来，默认选 4-7-8
    var defaultId = q.exercise || '478';
    var exercise = EXERCISES.find(function(e) { return e.id === defaultId; }) || EXERCISES[0];
    var duration = getExerciseDuration(exercise);
    this.setData({
      selectedExercise: exercise,
      selectedExerciseId: exercise.id,
      totalDuration: duration,
      tips: getRandomTips(3)
    });
  },

  onUnload() {
    this.stopTimer();
  },

  // 选择练习
  selectExercise(e) {
    if (this.data.isRunning) return;
    var id = e.currentTarget.dataset.id;
    var exercise = EXERCISES.find(function(e) { return e.id === id; });
    if (!exercise) return;
    var duration = getExerciseDuration(exercise);
    this.setData({
      selectedExercise: exercise,
      selectedExerciseId: id,
      totalDuration: duration,
      currentRound: 0,
      currentPhaseIndex: 0,
      currentPhase: null,
      countdown: 0,
      elapsed: 0
    });
    if (wx.vibrateShort) wx.vibrateShort({ type: 'light' });
  },

  // 开始练习
  startExercise() {
    if (!this.data.selectedExercise) return;
    this.setData({
      isRunning: true,
      isPaused: false,
      currentRound: 0,
      currentPhaseIndex: 0,
      elapsed: 0,
      showCompletion: false
    });
    this.runPhase();
  },

  // 执行当前阶段
  runPhase() {
    var exercise = this.data.selectedExercise;
    var phaseIdx = this.data.currentPhaseIndex;
    var round = this.data.currentRound;
    var phase = exercise.phases[phaseIdx];

    this.setData({
      currentPhase: phase,
      countdown: phase.duration
    });

    // 震动反馈（阶段切换）
    if (wx.vibrateShort) wx.vibrateShort({ type: 'light' });

    var self = this;
    var count = phase.duration;

    this.timer = setInterval(function() {
      if (self.data.isPaused) return;

      count--;
      self.setData({
        countdown: count,
        elapsed: self.data.elapsed + 1
      });

      if (count <= 0) {
        clearInterval(self.timer);
        self.nextPhase();
      }
    }, 1000);
  },

  // 下一阶段
  nextPhase() {
    var exercise = this.data.selectedExercise;
    var nextPhaseIdx = this.data.currentPhaseIndex + 1;
    var nextRound = this.data.currentRound;

    if (nextPhaseIdx >= exercise.phases.length) {
      nextPhaseIdx = 0;
      nextRound++;

      if (nextRound >= exercise.rounds) {
        this.completeExercise();
        return;
      }
    }

    this.setData({
      currentPhaseIndex: nextPhaseIdx,
      currentRound: nextRound
    });

    // 短暂停顿后继续
    var self = this;
    setTimeout(function() {
      self.runPhase();
    }, 500);
  },

  // 暂停/恢复
  togglePause() {
    this.setData({ isPaused: !this.data.isPaused });
  },

  // 停止练习
  stopExercise() {
    this.stopTimer();
    this.setData({
      isRunning: false,
      isPaused: false,
      currentRound: 0,
      currentPhaseIndex: 0,
      currentPhase: null,
      countdown: 0,
      elapsed: 0
    });
  },

  // 完成练习
  completeExercise() {
    this.stopTimer();
    var message = getRandomCompletion();
    this.setData({
      isRunning: false,
      showCompletion: true,
      completionMessage: message,
      tips: getRandomTips(3)
    });
    if (wx.vibrateShort) wx.vibrateShort({ type: 'medium' });
  },

  // 关闭完成弹层
  closeCompletion() {
    this.setData({ showCompletion: false });
  },

  stopTimer() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  },

  // 返回
  goBack() {
    wx.navigateBack({
      fail: function() {
        wx.switchTab({ url: '/pages/home/home' });
      }
    });
  },

  // 去记录
  goRecord() {
    wx.switchTab({ url: '/pages/home/home' });
  }
});
