(function (global) {
  'use strict';

  const KEY = 'btvDashboard.v1';
  const initial = { comments: [], targets: {}, uploads: {}, memos: {} };

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

  const UPLOAD_KEYS = {
    daily: (r) => r.date,
    events: (r) => r.id,
    seg: (r) => `${r.month}|${r.ui}|${r.segment}`,
    prizes: (r) => `${r.event}|${r.rank}`,
    couponDaily: (r) => `${r.date}|${r.policyId}`,
    couponAlloc: (r) => `${r.date || ''}|${r.policyId}`,
  };

  global.Store = {
    get state() {
      return state;
    },
    onChange(fn) {
      listeners.push(fn);
    },
    addComment(month, text, kind, author) {
      const at = new Date();
      // 조회 중인 달과 작성한 달이 같을 때만 주차를 붙인다 (지난 달 소급 작성 시 오해 방지)
      const sameMonth = `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, '0')}` === month;
      state.comments.unshift({
        id: uid(),
        month,
        text,
        kind: kind || 'weekly',
        week: sameMonth ? Math.ceil(at.getDate() / 7) : null,
        author: author || '담당자',
        at: at.toISOString(),
      });
      save();
    },
    // 다른 달 코멘트는 주간·마감 모두 아카이브에 남긴다 (마감 코멘트를 먼저)
    archivedComments(excludeMonth) {
      return state.comments
        .filter((c) => c.month !== excludeMonth)
        .sort((a, b) => (a.month === b.month ? (a.kind === 'closing' ? -1 : 1) : a.month < b.month ? 1 : -1));
    },
    removeComment(id) {
      state.comments = state.comments.filter((c) => c.id !== id);
      save();
    },
    commentsOf(month) {
      return state.comments.filter((c) => c.month === month);
    },
    setTarget(month, paid, coupon) {
      state.targets[month] = { paid, coupon };
      BTV.kpiTargets[month] = state.targets[month];
      save();
    },
    targetOf(month) {
      return state.targets[month] || BTV.kpiTargets[month] || { paid: 0, coupon: 0 };
    },
    targetCac() {
      return state.targetCac != null ? state.targetCac : 5000;
    },
    setTargetCac(value) {
      state.targetCac = value;
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
    // 같은 키는 최신값으로 갱신, 새 키는 추가 — 매주 올린 분이 계속 쌓인다
    mergeUpload(kind, rows, fileName) {
      const keyOf = UPLOAD_KEYS[kind];
      const existing = state.uploads[kind] || [];
      const byKey = new Map(existing.map((r) => [keyOf(r), r]));
      let added = 0;
      let updated = 0;
      rows.forEach((r) => {
        if (byKey.has(keyOf(r))) updated += 1;
        else added += 1;
        byKey.set(keyOf(r), r);
      });
      state.uploads[kind] = [...byKey.values()];
      state.realData = true;
      state.uploadLog = [
        { kind, file: fileName, added, updated, total: state.uploads[kind].length, at: now() },
        ...(state.uploadLog || []),
      ].slice(0, 20);
      save();
      return { added, updated, total: state.uploads[kind].length };
    },
    removeUploadRow(kind, match) {
      state.uploads[kind] = (state.uploads[kind] || []).filter((r) => !match(r));
      save();
    },
    uploadsOf(kind) {
      return state.uploads[kind] || [];
    },
    get uploadLog() {
      return state.uploadLog || [];
    },
    get isRealData() {
      return !!state.realData;
    },
    clearUploads() {
      state.uploads = {};
      state.uploadLog = [];
      state.realData = false;
      save();
    },
  };
})(window);
