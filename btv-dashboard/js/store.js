(function (global) {
  'use strict';

  const KEY = 'btvDashboard.v1';
  const initial = { comments: [], insights: [], targets: {}, weights: {}, uploads: {}, memos: {} };

  function load() {
    try {
      return { ...initial, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
    } catch (e) {
      return { ...initial };
    }
  }

  let state = load();
  const listeners = [];

  // 저장된 목표를 데이터 레이어에 반영해 두 곳의 수치가 어긋나지 않게 한다
  Object.keys(state.targets).forEach((m) => {
    BTV.kpiTargets[m] = state.targets[m];
  });

  function save() {
    localStorage.setItem(KEY, JSON.stringify(state));
    listeners.forEach((fn) => fn(state));
  }

  const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  const now = () => new Date().toISOString();

  global.Store = {
    get state() {
      return state;
    },
    onChange(fn) {
      listeners.push(fn);
    },
    addComment(month, text, author) {
      state.comments.unshift({ id: uid(), month, text, author: author || '담당자', at: now() });
      save();
    },
    removeComment(id) {
      state.comments = state.comments.filter((c) => c.id !== id);
      save();
    },
    commentsOf(month) {
      return state.comments.filter((c) => c.month === month);
    },
    addInsight(text, tags, source) {
      const exists = state.insights.some((i) => i.text === text);
      if (exists) return false;
      state.insights.unshift({ id: uid(), text, tags: tags || [], source: source || 'chat', at: now() });
      save();
      return true;
    },
    removeInsight(id) {
      state.insights = state.insights.filter((i) => i.id !== id);
      save();
    },
    searchInsights(keywords) {
      if (!keywords || !keywords.length) return state.insights;
      return state.insights.filter((i) =>
        keywords.some((k) => i.text.includes(k) || i.tags.some((t) => t.includes(k)))
      );
    },
    setTarget(month, paid, coupon) {
      state.targets[month] = { paid, coupon };
      BTV.kpiTargets[month] = state.targets[month];
      save();
    },
    targetOf(month) {
      return state.targets[month] || BTV.kpiTargets[month] || { paid: 0, coupon: 0 };
    },
    setWeight(eventId, weight) {
      state.weights[eventId] = weight;
      save();
    },
    weightOf(eventId, fallback) {
      return state.weights[eventId] != null ? state.weights[eventId] : fallback;
    },
    clearWeights() {
      state.weights = {};
      save();
    },
    setMemo(eventId, text) {
      if (text) state.memos[eventId] = text;
      else delete state.memos[eventId];
      save();
    },
    memoOf(eventId) {
      return state.memos[eventId] || '';
    },
    saveUpload(kind, rows) {
      state.uploads[kind] = rows;
      save();
    },
    clearUploads() {
      state.uploads = {};
      save();
    },
  };
})(window);
