/* 전 구간 더미 데이터. 실제 실적/캠페인 정보 아님. */
(function (global) {
  'use strict';

  const START = '2024-01-01'; // 24년부터 3개년치
  const LAST_DATA_DAY = '2026-09-10';
  const TODAY = '2026-09-11';
  const PLAN_END = '2026-10-10';

  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const rand = rng(20260911);
  const between = (a, b) => a + rand() * (b - a);
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];

  const toDate = (s) => {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d);
  };
  const toKey = (dt) =>
    `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  const addDays = (s, n) => {
    const t = toDate(s);
    t.setDate(t.getDate() + n);
    return toKey(t);
  };
  const eachDay = (from, to) => {
    const out = [];
    let cur = from;
    while (cur <= to) {
      out.push(cur);
      cur = addDays(cur, 1);
    }
    return out;
  };
  const monthOf = (s) => s.slice(0, 7);
  const isWeekend = (s) => {
    const w = toDate(s).getDay();
    return w === 0 || w === 6;
  };
  const daysBetween = (a, b) => Math.round((toDate(b) - toDate(a)) / 86400000) + 1;
  const monthLabel = (m) => `${Number(m.slice(5, 7))}월`;

  const SEASON = { 1: 1.0, 2: 0.96, 3: 1.05, 4: 1.08, 5: 1.13, 6: 1.09, 7: 1.16, 8: 1.19, 9: 1.22, 10: 1.1, 11: 1.06, 12: 1.14 };
  function trendOf(monthKey) {
    const year = Number(monthKey.slice(0, 4));
    const month = Number(monthKey.slice(5, 7));
    const elapsed = (year - 2024) * 12 + (month - 1);
    return SEASON[month] * (1 + elapsed * 0.004);
  }
  const DOW_FACTOR = [1.21, 0.92, 0.97, 1.0, 1.03, 1.09, 1.31];

  const PURPOSES = ['유료 신규', '무료(쿠폰)', '유료+무료'];
  const TYPES = ['할인', '할인+전원경품', '할인+추첨경품', '할인+전원경품+추첨경품'];
  const COUPON_POLICIES = ['쿠폰 A형 (1개월 무료)', '쿠폰 B형 (3개월 할인)', '쿠폰 C형 (첫달 100%)', '쿠폰 D형 (제휴 전용)'];
  const PRIZE_FORM = { 상품권: '디지털', 티켓: '디지털', 숙박권: '실물', 생활가전: '실물', 없음: '-' };
  const WINNER_PICKS = ['랜덤 추첨', '선착순'];
  const PRIZE_KINDS = ['상품권', '티켓', '숙박권', '생활가전'];
  const UNIT_PRICES = [10000, 20000, 30000, 50000, 100000];
  const DISCOUNTS = [10, 15, 20, 25, 30, 40, 50];
  const THEMES = {
    1: ['신년 웰컴 특가', '첫달 무료 프로모션'],
    2: ['설 연휴 프로모션', '가성비 패키지'],
    3: ['봄맞이 신규 특가', '새학기 프로모션'],
    4: ['봄나들이 특가', '요금 할인전'],
    5: ['가정의 달 특가', '가족 패키지'],
    6: ['초여름 프로모션', '리프레시 특가'],
    7: ['여름 휴가 특가', '바캉스 프로모션'],
    8: ['하계 특가', '늦여름 컴백 프로모션'],
    9: ['추석 연휴 특가', '가을맞이 프로모션'],
    10: ['가을 특가', '신규 웰컴 프로모션'],
    11: ['블랙프라이데이 특가', '겨울 준비 프로모션'],
    12: ['연말 감사 특가', '해피 뉴이어 프로모션'],
  };

  function hasAll(type) {
    return type.indexOf('전원경품') >= 0;
  }
  function hasRaffle(type) {
    return type.indexOf('추첨경품') >= 0;
  }

  /* ---------- 이벤트 생성 ---------- */
  const events = [];
  let cursor = '2024-01-05';
  let idx = 1;
  while (cursor <= PLAN_END) {
    const length = Math.round(between(3, 9));
    const endDate = addDays(cursor, length - 1);
    const type = TYPES[Math.floor(between(0, 4))];
    const discountRate = pick(DISCOUNTS);
    const prizeKind = type === '할인' ? '없음' : pick(PRIZE_KINDS);
    const prizeUnitPrice = type === '할인' ? 0 : pick(UNIT_PRICES);
    const month = Number(monthOf(cursor).slice(5, 7));
    const themes = THEMES[month] || ['프로모션'];
    let name = `${monthOf(cursor).slice(2, 4)}년 ${month}월 ${themes[idx % themes.length]}`;
    const used = events.filter((e) => e.name === name || e.name.startsWith(`${name} `)).length;
    if (used) name = `${name} ${used + 1}차`;
    events.push({
      id: `EV-${monthOf(cursor).replace('-', '')}-${String(idx).padStart(2, '0')}`,
      name,
      purpose: pick(PURPOSES),
      type,
      couponPolicy: pick(COUPON_POLICIES),
      prizeMethod: hasAll(type) && hasRaffle(type) ? '전원+추첨' : hasAll(type) ? '전원 지급' : hasRaffle(type) ? '추첨' : '없음',
      prizeForm: PRIZE_FORM[prizeKind] || '-',
      winnerPick: hasRaffle(type) ? pick(WINNER_PICKS) : hasAll(type) ? '전원 지급' : '-',
      discountRate,
      prizeKind,
      prizeUnitPrice,
      allPrizeUnitPrice: hasAll(type) ? pick([5000, 10000, 20000]) : 0,
      startDate: cursor,
      endDate,
      pool: Math.round(between(60000, 180000) / 1000) * 1000,
      quality: between(0.85, 1.15),
      status: endDate <= LAST_DATA_DAY ? '종료' : cursor <= LAST_DATA_DAY ? '진행중' : '예정',
    });
    cursor = addDays(endDate, Math.round(between(2, 6)));
    idx += 1;
  }

  function liftOf(ev) {
    let lift = (ev.discountRate / 100) * 1.7;
    if (hasAll(ev.type)) lift += 0.26;
    if (hasRaffle(ev.type)) lift += 0.14;
    if (ev.prizeUnitPrice > 0) lift += Math.log10(ev.prizeUnitPrice / 10000) * 0.08;
    return Math.max(0.05, lift * ev.quality);
  }
  events.forEach((ev) => {
    ev.lift = liftOf(ev);
  });

  /* ---------- 일자별 실적 + 이벤트 기여도 배분 ---------- */
  const days = [];
  const attribution = {};
  events.forEach((ev) => {
    attribution[ev.id] = {
      total: 0,
      weekend: 0,
      weekday: 0,
      paid: 0,
      coupon: 0,
      paidWeekend: 0,
      paidWeekday: 0,
      couponWeekend: 0,
      couponWeekday: 0,
    };
  });

  eachDay(START, LAST_DATA_DAY).forEach((date) => {
    const trend = trendOf(monthOf(date));
    const dow = DOW_FACTOR[toDate(date).getDay()];
    const basePaid = 268 * trend * dow * between(0.94, 1.06);
    const baseCoupon = basePaid * between(0.4, 0.48);

    const active = events.filter((ev) => ev.startDate <= date && date <= ev.endDate);
    const liftSum = active.reduce((s, ev) => s + ev.lift, 0);
    const paid = basePaid * (1 + liftSum);
    const coupon = baseCoupon * (1 + liftSum * 1.35);

    const row = {
      date,
      month: monthOf(date),
      weekend: isWeekend(date),
      paid: Math.round(paid),
      coupon: Math.round(coupon),
      basePaid: Math.round(basePaid),
      baseCoupon: Math.round(baseCoupon),
      eventIds: active.map((ev) => ev.id),
    };
    days.push(row);

    if (liftSum > 0) {
      const paidGain = row.paid - row.basePaid;
      const couponGain = row.coupon - row.baseCoupon;
      active.forEach((ev) => {
        const share = ev.lift / liftSum;
        const gotPaid = paidGain * share;
        const gotCoupon = couponGain * share;
        const bucket = attribution[ev.id];
        bucket.total += gotPaid + gotCoupon;
        bucket.paid += gotPaid;
        bucket.coupon += gotCoupon;
        if (row.weekend) {
          bucket.weekend += gotPaid + gotCoupon;
          bucket.paidWeekend += gotPaid;
          bucket.couponWeekend += gotCoupon;
        } else {
          bucket.weekday += gotPaid + gotCoupon;
          bucket.paidWeekday += gotPaid;
          bucket.couponWeekday += gotCoupon;
        }
      });
    }
  });

  /* ---------- 이벤트 실적 확정 ---------- */
  events.forEach((ev) => {
    const bucket = attribution[ev.id];
    if (ev.status === '예정' || bucket.total < 1) {
      ev.signups = null;
      ev.weekendSignups = null;
      ev.weekdaySignups = null;
      ev.paidSignups = null;
      ev.couponSignups = null;
      ev.paidWeekend = null;
      ev.paidWeekday = null;
      ev.couponWeekend = null;
      ev.couponWeekday = null;
      ev.entrants = null;
      ev.prizeCount = hasRaffle(ev.type) ? pick([100, 200, 300, 500]) : null;
      ev.winners = null;
      ev.actualReceivers = null;
      ev.prizePurchaseCost = null;
      ev.actualBudget = null;
      return;
    }
    ev.signups = Math.round(bucket.total);
    ev.weekendSignups = Math.round(bucket.weekend);
    ev.weekdaySignups = Math.round(bucket.weekday);
    ev.paidSignups = Math.round(bucket.paid);
    ev.couponSignups = Math.round(bucket.coupon);
    ev.paidWeekend = Math.round(bucket.paidWeekend);
    ev.paidWeekday = Math.round(bucket.paidWeekday);
    ev.couponWeekend = Math.round(bucket.couponWeekend);
    ev.couponWeekday = Math.round(bucket.couponWeekday);

    if (hasRaffle(ev.type)) {
      const scarcity = ev.prizeUnitPrice >= 50000 ? [100, 200] : [200, 300, 500, 1000];
      const prizeCount = pick(scarcity);
      const entrants = Math.max(prizeCount * 3, Math.round(ev.signups * between(1.6, 2.8)));
      const receiveRate = Math.min(0.96, 0.6 + Math.log10(ev.prizeUnitPrice / 10000) * 0.13 + between(0, 0.12));
      const actualReceivers = Math.round(prizeCount * receiveRate);
      ev.prizeCount = prizeCount;
      ev.entrants = entrants;
      ev.winners = prizeCount;
      ev.actualReceivers = actualReceivers;
      ev.prizePurchaseCost = prizeCount * ev.prizeUnitPrice;
      ev.actualBudget = actualReceivers * ev.prizeUnitPrice;
    } else if (hasAll(ev.type)) {
      const receiveRate = between(0.72, 0.93);
      const receivers = Math.round(ev.signups * receiveRate);
      ev.prizeCount = ev.signups;
      ev.entrants = null;
      ev.winners = ev.signups;
      ev.actualReceivers = receivers;
      ev.prizePurchaseCost = ev.signups * ev.allPrizeUnitPrice;
      ev.actualBudget = receivers * ev.allPrizeUnitPrice;
    } else {
      ev.entrants = null;
      ev.prizeCount = null;
      ev.winners = null;
      ev.actualReceivers = null;
      ev.prizePurchaseCost = null;
      ev.actualBudget = null;
    }
  });

  /* ---------- Seg.별 실적 (UI 구분 × SEG) ---------- */
  const UI_GROUPS = ['541 이상', '540 이하'];
  const SEG_LIST = ['신규가입', 'PPM 유료', 'PPM 무료', 'PPV', 'FOD', '실시간', '기타'];
  const SEG_WEIGHT = [0.3, 0.18, 0.13, 0.12, 0.1, 0.12, 0.05];
  const SEG_ALLOC = [210000, 150000, 120000, 95000, 80000, 90000, 40000];
  const UI_SHARE = { '541 이상': 0.62, '540 이하': 0.38 };
  const months = [];
  days.forEach((d) => {
    if (!months.includes(d.month)) months.push(d.month);
  });

  const segMonthly = [];
  months.forEach((m) => {
    const rows = days.filter((d) => d.month === m);
    const totalSignups = rows.reduce((s, d) => s + d.paid + d.coupon, 0);
    UI_GROUPS.forEach((ui) => {
      SEG_LIST.forEach((seg, i) => {
        segMonthly.push({
          ui,
          segment: seg,
          month: m,
          days: rows.length,
          allocated: Math.round((SEG_ALLOC[i] * UI_SHARE[ui] * between(0.95, 1.05)) / 1000) * 1000,
          used: Math.round(totalSignups * SEG_WEIGHT[i] * UI_SHARE[ui] * between(0.88, 1.12)),
        });
      });
    });
  });
  // 사용 합계가 월 총 가입자와 일치하도록 보정
  months.forEach((m) => {
    const rows = days.filter((d) => d.month === m);
    const total = rows.reduce((s, d) => s + d.paid + d.coupon, 0);
    const segRows = segMonthly.filter((s) => s.month === m);
    const sum = segRows.reduce((s, r) => s + r.used, 0);
    segRows.forEach((r) => {
      r.used = Math.round((r.used / sum) * total);
    });
  });

  /* ---------- 월 KPI 목표 ---------- */
  const kpiTargets = {};
  months.forEach((m) => {
    const rows = days.filter((d) => d.month === m);
    const isCurrent = m === monthOf(LAST_DATA_DAY);
    const scale = isCurrent ? 30 / rows.length : 1;
    const paid = rows.reduce((s, d) => s + d.paid, 0) * scale;
    const coupon = rows.reduce((s, d) => s + d.coupon, 0) * scale;
    const factor = isCurrent ? 1.07 : between(0.93, 1.09);
    kpiTargets[m] = {
      paid: Math.round((paid * factor) / 100) * 100,
      coupon: Math.round((coupon * factor) / 100) * 100,
    };
  });

  /* ---------- 조회 · 파생 지표 ---------- */
  const state = { days, events, segMonthly };

  function dayRows(month) {
    return state.days.filter((d) => !month || d.month === month);
  }

  const BUDGET_BANDS = ['없음', '1천원 미만', '1~3천원', '3~5천원', '5천원 이상'];
  function budgetBandOf(value) {
    if (value == null) return '없음';
    if (value < 1000) return '1천원 미만';
    if (value < 3000) return '1~3천원';
    if (value < 5000) return '3~5천원';
    return '5천원 이상';
  }

  // CSV 업로드로 시계열이 늘어나면 기준일도 따라 움직여야 한다
  function lastDay() {
    return state.days.length ? state.days[state.days.length - 1].date : LAST_DATA_DAY;
  }

  function eventMetrics(ev) {
    const asOf = lastDay();
    const totalDays = daysBetween(ev.startDate, ev.endDate);
    // 진행 중인 이벤트는 계획 기간이 아니라 경과일로 나눠야 과거 이벤트와 같은 기준이 된다
    const measuredEnd = ev.endDate <= asOf ? ev.endDate : asOf;
    const measured = ev.startDate <= measuredEnd ? eachDay(ev.startDate, measuredEnd) : [];
    const elapsedDays = measured.length;
    const elapsedWeekendDays = measured.filter(isWeekend).length;
    const elapsedWeekdayDays = elapsedDays - elapsedWeekendDays;
    let weekendDays = 0;
    eachDay(ev.startDate, ev.endDate).forEach((d) => {
      if (isWeekend(d)) weekendDays += 1;
    });
    const weekdayDays = totalDays - weekendDays;
    const signups = ev.signups;
    const has = signups != null;
    const status = ev.endDate <= asOf ? '종료' : ev.startDate <= asOf ? '진행중' : '예정';
    return {
      ...ev,
      status,
      totalDays,
      weekendDays,
      weekdayDays,
      elapsedDays,
      inFlight: status === '진행중',
      rate: has ? signups / ev.pool : null,
      dailyAvg: has && elapsedDays ? signups / elapsedDays : null,
      weekendAvg: has && elapsedWeekendDays ? ev.weekendSignups / elapsedWeekendDays : null,
      weekdayAvg: has && elapsedWeekdayDays ? ev.weekdaySignups / elapsedWeekdayDays : null,
      dailyRate: has && elapsedDays ? signups / ev.pool / elapsedDays : null,
      paidDailyAvg: has && elapsedDays ? ev.paidSignups / elapsedDays : null,
      paidWeekendAvg: has && elapsedWeekendDays ? ev.paidWeekend / elapsedWeekendDays : null,
      paidWeekdayAvg: has && elapsedWeekdayDays ? ev.paidWeekday / elapsedWeekdayDays : null,
      couponRate: has ? ev.couponSignups / ev.pool : null,
      couponDailyRate: has && elapsedDays ? ev.couponSignups / ev.pool / elapsedDays : null,
      couponDailyAvg: has && elapsedDays ? ev.couponSignups / elapsedDays : null,
      couponWeekendAvg: has && elapsedWeekendDays ? ev.couponWeekend / elapsedWeekendDays : null,
      couponWeekdayAvg: has && elapsedWeekdayDays ? ev.couponWeekday / elapsedWeekdayDays : null,
      organicRatio: has && ev.paidSignups ? ev.couponSignups / ev.paidSignups : null,
      competition: ev.entrants && ev.prizeCount ? ev.entrants / ev.prizeCount : null,
      entryRate: ev.entrants ? ev.entrants / ev.pool : null,
      receiveRate: ev.actualReceivers && ev.winners ? ev.actualReceivers / ev.winners : null,
      costPerEntrant: ev.actualBudget && ev.entrants ? ev.actualBudget / ev.entrants : null,
      budgetPerHead: ev.actualBudget && signups ? ev.actualBudget / signups : null,
      budgetBand: budgetBandOf(ev.actualBudget && signups ? ev.actualBudget / signups : null),
      priceBand: ev.prizeUnitPrice ? `${ev.prizeUnitPrice / 10000}만원` : '없음',
      isRaffle: hasRaffle(ev.type),
      isAllPrize: hasAll(ev.type),
    };
  }

  function allEvents() {
    return state.events.map(eventMetrics);
  }
  function doneEvents() {
    return allEvents().filter((e) => e.signups != null);
  }
  function eventsOfMonth(month) {
    return allEvents().filter((e) => monthOf(e.startDate) === month || monthOf(e.endDate) === month);
  }

  function monthStats(month) {
    const rows = dayRows(month);
    const paid = rows.reduce((s, d) => s + d.paid, 0);
    const coupon = rows.reduce((s, d) => s + d.coupon, 0);
    const target = kpiTargets[month] || { paid: 0, coupon: 0 };
    const elapsed = rows.length;
    const totalDaysInMonth = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate();
    return {
      month,
      rows,
      paid,
      coupon,
      total: paid + coupon,
      target,
      targetTotal: target.paid + target.coupon,
      progress: target.paid + target.coupon ? (paid + coupon) / (target.paid + target.coupon) : 0,
      gap: target.paid + target.coupon - (paid + coupon),
      elapsed,
      totalDaysInMonth,
      elapsedRatio: elapsed / totalDaysInMonth,
      dailyAvg: rows.length ? (paid + coupon) / rows.length : 0,
    };
  }

  function segStats(month, ui) {
    let rows = state.segMonthly.filter((r) => !month || r.month === month);
    if (!ui || ui === '전체') {
      const merged = new Map();
      rows.forEach((r) => {
        const key = `${r.month}|${r.segment}`;
        if (!merged.has(key)) {
          merged.set(key, { ui: '전체', month: r.month, segment: r.segment, days: r.days, allocated: 0, used: 0 });
        }
        const acc = merged.get(key);
        acc.allocated += r.allocated;
        acc.used += r.used;
      });
      rows = [...merged.values()];
    } else {
      rows = rows.filter((r) => r.ui === ui);
    }
    return rows.map((r) => ({
      ...r,
      rate: r.allocated ? r.used / r.allocated : 0,
      dailyAvg: r.days ? r.used / r.days : 0,
      dailyAvgRate: r.allocated && r.days ? r.used / r.allocated / r.days : 0,
    }));
  }

  // 월초에도 직전 3주와 비교할 수 있도록 월 경계를 넘어 전체 시계열에서 구간을 잡는다
  function seriesThrough(month) {
    const rows = dayRows(month);
    if (!rows.length) return [];
    const lastDate = rows[rows.length - 1].date;
    return state.days.filter((d) => d.date <= lastDate);
  }

  function anomaly(month) {
    const series = seriesThrough(month);
    if (series.length < 10) return null;
    const recent = series.slice(-7);
    const prev = series.slice(-28, -7);
    if (!prev.length) return null;
    const avg = (list) => list.reduce((s, d) => s + d.paid + d.coupon, 0) / list.length;
    const recentAvg = avg(recent);
    const prevAvg = avg(prev);
    const dev = (recentAvg - prevAvg) / prevAvg;
    const stats = monthStats(month);
    const paceGap = stats.progress - stats.elapsedRatio;
    const signals = [];
    if (Math.abs(dev) >= 0.12) {
      signals.push({
        level: dev > 0 ? 'good' : 'warn',
        text: `최근 7일 일평균 ${Math.round(recentAvg).toLocaleString()}건으로 직전 3주 평균 대비 ${(dev * 100).toFixed(1)}% ${dev > 0 ? '상승' : '하락'}`,
      });
    }
    if (paceGap <= -0.08) {
      signals.push({
        level: 'warn',
        text: `목표 진척률 ${(stats.progress * 100).toFixed(1)}%가 기간 경과율 ${(stats.elapsedRatio * 100).toFixed(1)}%보다 ${Math.abs(paceGap * 100).toFixed(1)}%p 뒤처짐`,
      });
    } else if (paceGap >= 0.08) {
      signals.push({
        level: 'good',
        text: `목표 진척률 ${(stats.progress * 100).toFixed(1)}%가 기간 경과율 ${(stats.elapsedRatio * 100).toFixed(1)}%를 ${(paceGap * 100).toFixed(1)}%p 앞섬`,
      });
    }
    return { dev, recentAvg, prevAvg, paceGap, signals };
  }

  function replaceDays(rows) {
    const byDate = new Map(state.days.map((d) => [d.date, d]));
    rows.forEach((r) => {
      byDate.set(r.date, {
        date: r.date,
        month: monthOf(r.date),
        weekend: isWeekend(r.date),
        paid: r.paid,
        coupon: r.coupon,
        basePaid: r.paid,
        baseCoupon: r.coupon,
        eventIds: byDate.get(r.date) ? byDate.get(r.date).eventIds : [],
      });
    });
    state.days = Array.from(byDate.values()).sort((a, b) => (a.date < b.date ? -1 : 1));
    state.days.forEach((d) => {
      if (!months.includes(d.month)) months.push(d.month);
    });
    months.sort();
  }

  function replaceEvents(rows) {
    const byId = new Map(state.events.map((e) => [e.id, e]));
    rows.forEach((r) => {
      byId.set(r.id, { ...(byId.get(r.id) || {}), ...r });
    });
    state.events = Array.from(byId.values()).sort((a, b) => (a.startDate < b.startDate ? -1 : 1));
  }

  const fmt = {
    num: (v, digits = 0) =>
      v == null || Number.isNaN(v) ? '-' : Number(v).toLocaleString('ko-KR', { maximumFractionDigits: digits, minimumFractionDigits: digits }),
    pct: (v, digits = 2) => (v == null || Number.isNaN(v) ? '-' : `${(v * 100).toFixed(digits)}%`),
    won: (v) => (v == null || Number.isNaN(v) ? '-' : `${Math.round(v).toLocaleString('ko-KR')}원`),
    manwon: (v) => (v == null || Number.isNaN(v) ? '-' : `${(v / 10000).toLocaleString('ko-KR', { maximumFractionDigits: 0 })}만원`),
    date: (s) => `${Number(s.slice(5, 7))}/${Number(s.slice(8, 10))}`,
  };

  global.BTV = {
    START,
    TODAY,
    get LAST_DATA_DAY() {
      return lastDay();
    },
    UI_GROUPS,
    SEG_LIST,
    PURPOSES,
    BUDGET_BANDS,
    TYPES,
    PRIZE_KINDS,
    UNIT_PRICES,
    kpiTargets,
    months,
    get days() {
      return state.days;
    },
    get rawEvents() {
      return state.events;
    },
    dayRows,
    allEvents,
    doneEvents,
    eventsOfMonth,
    eventMetrics,
    monthStats,
    segStats,
    anomaly,
    seriesThrough,
    replaceDays,
    replaceEvents,
    util: { toDate, toKey, addDays, eachDay, monthOf, isWeekend, daysBetween, monthLabel, hasRaffle, hasAll },
    fmt,
  };
})(window);
