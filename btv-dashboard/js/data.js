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

  // 공휴일 (2024~2026). 음력 명절·대체공휴일은 실제 달력과 한 번 대조해 주세요.
  const HOLIDAYS = {
    '2024-01-01': '신정',
    '2024-02-09': '설 연휴',
    '2024-02-10': '설날',
    '2024-02-11': '설 연휴',
    '2024-02-12': '대체공휴일',
    '2024-03-01': '삼일절',
    '2024-04-10': '국회의원선거',
    '2024-05-05': '어린이날',
    '2024-05-06': '대체공휴일',
    '2024-05-15': '부처님오신날',
    '2024-06-06': '현충일',
    '2024-08-15': '광복절',
    '2024-09-16': '추석 연휴',
    '2024-09-17': '추석',
    '2024-09-18': '추석 연휴',
    '2024-10-03': '개천절',
    '2024-10-09': '한글날',
    '2024-12-25': '성탄절',
    '2025-01-01': '신정',
    '2025-01-28': '설 연휴',
    '2025-01-29': '설날',
    '2025-01-30': '설 연휴',
    '2025-03-01': '삼일절',
    '2025-03-03': '대체공휴일',
    '2025-05-05': '어린이날·부처님오신날',
    '2025-05-06': '대체공휴일',
    '2025-06-06': '현충일',
    '2025-08-15': '광복절',
    '2025-10-03': '개천절',
    '2025-10-05': '추석 연휴',
    '2025-10-06': '추석',
    '2025-10-07': '추석 연휴',
    '2025-10-08': '대체공휴일',
    '2025-10-09': '한글날',
    '2025-12-25': '성탄절',
    '2026-01-01': '신정',
    '2026-02-16': '설 연휴',
    '2026-02-17': '설날',
    '2026-02-18': '설 연휴',
    '2026-03-01': '삼일절',
    '2026-03-02': '대체공휴일',
    '2026-05-05': '어린이날',
    '2026-05-24': '부처님오신날',
    '2026-05-25': '대체공휴일',
    '2026-06-06': '현충일',
    '2026-08-15': '광복절',
    '2026-09-24': '추석 연휴',
    '2026-09-25': '추석',
    '2026-09-26': '추석 연휴',
    '2026-10-03': '개천절',
    '2026-10-09': '한글날',
    '2026-12-25': '성탄절',
  };
  const holidayOf = (date) => HOLIDAYS[date] || null;
  const isRestDay = (date) => isWeekend(date) || !!HOLIDAYS[date];
  const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];
  const dayName = (date) => DAY_NAMES[toDate(date).getDay()];

  // 이벤트는 끊어진 여러 구간을 가질 수 있다. periods가 없으면 단일 구간으로 본다.
  const periodsOf = (ev) =>
    ev.periods && ev.periods.length ? ev.periods : [{ startDate: ev.startDate, endDate: ev.endDate }];
  const covers = (ev, date) => periodsOf(ev).some((p) => p.startDate <= date && date <= p.endDate);
  // 경품은 여러 등급이 걸릴 수 있다. 예전 단일 경품 형식도 1건짜리 목록으로 취급한다.
  const prizesOf = (ev) => {
    if (ev.prizes && ev.prizes.length) return ev.prizes.slice().sort((a, b) => a.rank - b.rank);
    if (!ev.prizeKind || ev.prizeKind === '없음') return [];
    return [
      {
        rank: 1,
        kind: ev.prizeKind,
        form: ev.prizeForm || '-',
        unitPrice: ev.prizeUnitPrice || 0,
        count: ev.prizeCount || 0,
        winners: ev.winners || 0,
        receivers: ev.actualReceivers || 0,
        purchaseCost: ev.prizePurchaseCost || 0,
        actualBudget: ev.actualBudget || 0,
      },
    ];
  };
  const overlapsRange = (ev, from, to) => periodsOf(ev).some((p) => p.startDate <= to && p.endDate >= from);

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
  const dailyAttribution = {}; // 이벤트별 일자 기여도 (데이 커브 · 증분 분석용)
  events.forEach((ev) => {
    attribution[ev.id] = {
      total: 0,
      rest: 0,
      weekday: 0,
      paid: 0,
      coupon: 0,
      paidRest: 0,
      paidWeekday: 0,
      couponRest: 0,
      couponWeekday: 0,
    };
    dailyAttribution[ev.id] = [];
  });

  eachDay(START, LAST_DATA_DAY).forEach((date) => {
    const trend = trendOf(monthOf(date));
    // 공휴일은 주말 수준으로 유입이 올라간다
    const dow = holidayOf(date) ? Math.max(DOW_FACTOR[toDate(date).getDay()], 1.24) : DOW_FACTOR[toDate(date).getDay()];
    const basePaid = 268 * trend * dow * between(0.94, 1.06);
    const baseCoupon = basePaid * between(0.4, 0.48);

    const active = events.filter((ev) => covers(ev, date));
    const liftSum = active.reduce((s, ev) => s + ev.lift, 0);
    const paid = basePaid * (1 + liftSum);
    const coupon = baseCoupon * (1 + liftSum * 1.35);

    const row = {
      date,
      month: monthOf(date),
      rest: isRestDay(date),
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
        if (row.rest) {
          bucket.rest += gotPaid + gotCoupon;
          bucket.paidRest += gotPaid;
          bucket.couponRest += gotCoupon;
        } else {
          bucket.weekday += gotPaid + gotCoupon;
          bucket.paidWeekday += gotPaid;
          bucket.couponWeekday += gotCoupon;
        }
        dailyAttribution[ev.id].push({
          date,
          rest: row.rest,
          paid: gotPaid,
          coupon: gotCoupon,
          total: gotPaid + gotCoupon,
          baseline: row.basePaid + row.baseCoupon,
        });
      });
    }
  });

  /* ---------- 이벤트 실적 확정 ---------- */
  events.forEach((ev) => {
    const bucket = attribution[ev.id];
    if (ev.status === '예정' || bucket.total < 1) {
      ev.signups = null;
      ev.restSignups = null;
      ev.weekdaySignups = null;
      ev.paidSignups = null;
      ev.couponSignups = null;
      ev.paidRest = null;
      ev.paidWeekday = null;
      ev.couponRest = null;
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
    ev.restSignups = Math.round(bucket.rest);
    ev.weekdaySignups = Math.round(bucket.weekday);
    ev.paidSignups = Math.round(bucket.paid);
    ev.couponSignups = Math.round(bucket.coupon);
    ev.paidRest = Math.round(bucket.paidRest);
    ev.paidWeekday = Math.round(bucket.paidWeekday);
    ev.couponRest = Math.round(bucket.couponRest);
    ev.couponWeekday = Math.round(bucket.couponWeekday);

    // 한 이벤트에 경품이 여러 등급으로 걸릴 수 있다 (1등 고가 소량 + 하위 등급 저가 다량)
    const prizes = [];
    if (hasRaffle(ev.type)) {
      const tiers = Math.round(between(1, 3.4));
      const entrants = Math.max(300, Math.round(ev.signups * between(1.6, 2.8)));
      ev.entrants = entrants;
      for (let rank = 1; rank <= tiers; rank += 1) {
        const unitPrice = rank === 1 ? ev.prizeUnitPrice : pick(UNIT_PRICES.filter((p) => p < ev.prizeUnitPrice)) || 10000;
        const count = rank === 1 ? pick(unitPrice >= 50000 ? [50, 100] : [100, 200]) : pick([300, 500, 1000]);
        const receiveRate = Math.min(0.96, 0.6 + Math.log10(unitPrice / 10000) * 0.13 + between(0, 0.12));
        const receivers = Math.round(count * receiveRate);
        prizes.push({
          rank,
          kind: rank === 1 ? ev.prizeKind : pick(PRIZE_KINDS),
          form: '',
          unitPrice,
          count,
          winners: count,
          receivers,
          purchaseCost: count * unitPrice,
          actualBudget: receivers * unitPrice,
        });
      }
    } else if (hasAll(ev.type)) {
      const receiveRate = between(0.72, 0.93);
      const receivers = Math.round(ev.signups * receiveRate);
      ev.entrants = null;
      prizes.push({
        rank: 1,
        kind: ev.prizeKind,
        form: '',
        unitPrice: ev.allPrizeUnitPrice,
        count: ev.signups,
        winners: ev.signups,
        receivers,
        purchaseCost: ev.signups * ev.allPrizeUnitPrice,
        actualBudget: receivers * ev.allPrizeUnitPrice,
      });
    } else {
      ev.entrants = null;
    }
    prizes.forEach((p) => {
      p.form = PRIZE_FORM[p.kind] || '-';
    });
    ev.prizes = prizes;
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

  // 실데이터를 올리면 더미를 비우고 업로드분만 쓴다 (섞이면 해석이 불가능해진다)
  function clearSeed() {
    state.days = [];
    state.events = [];
    state.segMonthly = [];
    months.length = 0;
    Object.keys(kpiTargets).forEach((m) => delete kpiTargets[m]);
  }

  // 업로드 데이터에는 이벤트 진행일 표시가 없어 이벤트 목록으로 다시 채운다
  function recomputeEventDays() {
    state.days.forEach((d) => {
      d.eventIds = state.events.filter((e) => covers(e, d.date)).map((e) => e.id);
    });
  }

  // 이벤트 직전 28일 중 이벤트가 없던 날로 평상시 기준선을 추정한다
  function baselineBefore(date) {
    const prior = state.days.filter((d) => d.date < date).slice(-28);
    if (!prior.length) return null;
    const organic = prior.filter((d) => !d.eventIds || !d.eventIds.length);
    const source = organic.length >= 3 ? organic : prior;
    const avg = (list) => (list.length ? list.reduce((s, d) => s + d.paid + d.coupon, 0) / list.length : null);
    const restAvg = avg(source.filter((d) => d.rest));
    const weekdayAvg = avg(source.filter((d) => !d.rest));
    const overall = avg(source);
    return {
      rest: restAvg != null ? restAvg : overall * 1.25,
      weekday: weekdayAvg != null ? weekdayAvg : overall,
      sample: source.length,
      organicDays: organic.length,
      // 직전 데이터가 짧거나 이벤트 없는 날이 거의 없으면 기준선을 믿을 수 없다
      reliable: source.length >= 7 && organic.length >= 3,
    };
  }

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
    // 한 이벤트가 끊어진 여러 구간으로 진행될 수 있다 (예: 8/31~9/6 + 9/10~9/13 = 11일)
    const periods = periodsOf(ev);
    const allDates = periods.flatMap((p) => eachDay(p.startDate, p.endDate));
    const totalDays = allDates.length;
    // 진행 중인 이벤트는 계획 기간이 아니라 경과일로 나눠야 과거 이벤트와 같은 기준이 된다
    const measured = allDates.filter((d) => d <= asOf);
    const elapsedDays = measured.length;
    // 휴일 = 토·일·공휴일
    const elapsedRestDays = measured.filter(isRestDay).length;
    const elapsedWeekdayDays = elapsedDays - elapsedRestDays;
    const restDays = allDates.filter(isRestDay).length;
    const weekdayDays = totalDays - restDays;
    const signups = ev.signups;
    const has = signups != null;
    const lastEnd = periods[periods.length - 1].endDate;
    const firstStart = periods[0].startDate;
    const status = lastEnd <= asOf ? '종료' : firstStart <= asOf ? '진행중' : '예정';

    // 경품 합산. 예전 단일 경품 형식으로 올라온 건은 1건짜리 목록으로 맞춘다
    const prizes = prizesOf(ev);
    const sumOf = (f) => (prizes.length ? prizes.reduce((s, p) => s + (f(p) || 0), 0) : null);
    const prizeCount = sumOf((p) => p.count);
    const winners = sumOf((p) => p.winners);
    const actualReceivers = sumOf((p) => p.receivers);
    const prizePurchaseCost = sumOf((p) => p.purchaseCost);
    const actualBudget = sumOf((p) => p.actualBudget);
    const lead = prizes.slice().sort((a, b) => b.unitPrice - a.unitPrice)[0]; // 대표(최고가) 경품
    // 등급별로도 응모자 전체가 대상이므로 경쟁률은 각 등급 수량으로 나눈다
    const prizeRows = prizes.map((p) => ({
      ...p,
      competition: ev.entrants && p.count ? ev.entrants / p.count : null,
      receiveRate: p.receivers != null && p.winners ? p.receivers / p.winners : null,
      budgetPerHead: p.actualBudget && signups ? p.actualBudget / signups : null,
      priceBand: p.unitPrice ? `${p.unitPrice / 10000}만원` : '없음',
      rankLabel: `${p.rank}등`,
    }));
    return {
      ...ev,
      status,
      totalDays,
      restDays,
      weekdayDays,
      elapsedDays,
      inFlight: status === '진행중',
      rate: has ? signups / ev.pool : null,
      dailyAvg: has && elapsedDays ? signups / elapsedDays : null,
      restAvg: has && elapsedRestDays ? ev.restSignups / elapsedRestDays : null,
      weekdayAvg: has && elapsedWeekdayDays ? ev.weekdaySignups / elapsedWeekdayDays : null,
      dailyRate: has && elapsedDays ? signups / ev.pool / elapsedDays : null,
      paidDailyAvg: has && elapsedDays ? ev.paidSignups / elapsedDays : null,
      paidRestAvg: has && elapsedRestDays ? ev.paidRest / elapsedRestDays : null,
      paidWeekdayAvg: has && elapsedWeekdayDays ? ev.paidWeekday / elapsedWeekdayDays : null,
      couponRate: has ? ev.couponSignups / ev.pool : null,
      couponDailyRate: has && elapsedDays ? ev.couponSignups / ev.pool / elapsedDays : null,
      couponDailyAvg: has && elapsedDays ? ev.couponSignups / elapsedDays : null,
      couponRestAvg: has && elapsedRestDays ? ev.couponRest / elapsedRestDays : null,
      couponWeekdayAvg: has && elapsedWeekdayDays ? ev.couponWeekday / elapsedWeekdayDays : null,
      organicRatio: has && ev.paidSignups ? ev.couponSignups / ev.paidSignups : null,
      prizes: prizeRows,
      prizeTiers: prizes.length,
      prizeMix: prizes.length > 1 ? `복합 ${prizes.length}종` : prizes.length === 1 ? '단일' : '없음',
      prizeKind: lead ? lead.kind : ev.prizeKind,
      prizeUnitPrice: lead ? lead.unitPrice : ev.prizeUnitPrice,
      prizeCount,
      winners,
      actualReceivers,
      prizePurchaseCost,
      actualBudget,
      competition: ev.entrants && prizeCount ? ev.entrants / prizeCount : null,
      entryRate: ev.entrants ? ev.entrants / ev.pool : null,
      receiveRate: actualReceivers != null && winners ? actualReceivers / winners : null,
      costPerEntrant: actualBudget && ev.entrants ? actualBudget / ev.entrants : null,
      budgetPerHead: actualBudget && signups ? actualBudget / signups : null,
      budgetBand: budgetBandOf(actualBudget && signups ? actualBudget / signups : null),
      priceBand: lead && lead.unitPrice ? `${lead.unitPrice / 10000}만원` : '없음',
      isRaffle: hasRaffle(ev.type),
      isAllPrize: hasAll(ev.type),
    };
  }

  // 이벤트별 일자 실적은 따로 받지 않는다.
  // 더미에는 생성 시 계산해 둔 기여도가 있고, 실데이터는 일자별 총합에서 추정 기준선을 빼 근사한다.
  function eventDailyRows(ev) {
    const attributed = dailyAttribution[ev.id];
    if (attributed && attributed.length) {
      return attributed.map((r) => ({ ...r, incremental: r.total, approx: false }));
    }
    const base = baselineBefore(ev.startDate);
    return state.days
      .filter((d) => covers(ev, d.date))
      .map((d) => {
        const baseline = base ? (d.rest ? base.rest : base.weekday) : 0;
        const total = d.paid + d.coupon;
        return {
          date: d.date,
          rest: d.rest,
          paid: d.paid,
          coupon: d.coupon,
          total,
          baseline,
          incremental: total - baseline,
          approx: true,
        };
      });
  }

  // 이벤트 기간을 1일차·2일차로 정규화한 곡선
  function dayCurve(eventId) {
    const ev = state.events.find((e) => e.id === eventId);
    if (!ev) return [];
    return eventDailyRows(ev).map((row, i) => ({ day: i + 1, ...row }));
  }

  // 이벤트 기간의 순증분과, 종료 직후 기준선이 꺼지는 폭(수요 당겨쓰기)
  function incrementality(ev, tailDays = 7) {
    const rows = eventDailyRows(ev);
    if (!rows.length) return null;
    const approx = rows[0].approx;
    const base = approx ? baselineBefore(ev.startDate) : null;
    const incremental = rows.reduce((s, r) => s + r.incremental, 0);
    const baseline = rows.reduce((s, r) => s + r.baseline, 0);

    const tail = state.days.filter((d) => d.date > ev.endDate && d.date <= addDays(ev.endDate, tailDays));
    const tailBase = approx ? base : null;
    const tailActual = tail.reduce((s, d) => s + d.paid + d.coupon, 0);
    const tailBaseline = tail.reduce(
      (s, d) => s + (tailBase ? (d.rest ? tailBase.rest : tailBase.weekday) : d.basePaid + d.baseCoupon),
      0
    );
    const otherEventDays = tail.filter((d) => d.eventIds && d.eventIds.length).length;
    const overlapping = state.events.filter(
      (e) => e.id !== ev.id && overlapsRange(e, ev.startDate, ev.endDate)
    ).length;

    return {
      incremental,
      baseline,
      liftRatio: baseline ? incremental / baseline : null,
      tailDays: tail.length,
      tailActual,
      tailBaseline,
      payback: tailBaseline ? (tailActual - tailBaseline) / tailBaseline : null,
      tailPolluted: otherEventDays > 0, // 직후 기간에 다른 이벤트가 겹치면 해석 주의
      overlapping, // 기간이 겹친 다른 이벤트 수 — 근사 계산에서는 분리가 불가능
      approx,
      baselineReliable: !approx || (base ? base.reliable : false),
      baselineSample: base ? base.sample : null,
    };
  }

  // 전년(및 재작년) 같은 시기 이벤트. 명절이 낀 이벤트는 같은 명절 기준으로 맞춘다
  function sameSeasonEvents(ev) {
    const holidayNear = (event) => {
      const span = eachDay(addDays(event.startDate, -7), addDays(event.endDate, 7));
      const names = span.map(holidayOf).filter(Boolean);
      const major = names.find((n) => n.includes('추석') || n.includes('설'));
      return major ? major.replace(' 연휴', '') : null;
    };
    const baseHoliday = holidayNear(ev);
    const baseMonth = Number(ev.startDate.slice(5, 7));
    const baseYear = Number(ev.startDate.slice(0, 4));

    return allEvents()
      .filter((e) => e.signups != null && e.id !== ev.id && Number(e.startDate.slice(0, 4)) !== baseYear)
      .map((e) => {
        const holiday = holidayNear(e);
        if (baseHoliday && holiday === baseHoliday) return { event: e, basis: `${baseHoliday} 기준` };
        if (!baseHoliday && Number(e.startDate.slice(5, 7)) === baseMonth) return { event: e, basis: `${baseMonth}월 기준` };
        return null;
      })
      .filter(Boolean)
      .sort((a, b) => (a.event.startDate < b.event.startDate ? 1 : -1));
  }

  // 교차분석용 — 이벤트 × 경품 등급으로 한 행씩 펼친다
  function prizeRows() {
    return doneEvents().flatMap((e) =>
      e.prizes.map((p) => ({
        ...e,
        prizeKind: p.kind,
        prizeForm: p.form,
        prizeUnitPrice: p.unitPrice,
        priceBand: p.priceBand,
        rank: p.rank,
        rankLabel: p.rankLabel,
        prizeCount: p.count,
        winners: p.winners,
        actualReceivers: p.receivers,
        prizePurchaseCost: p.purchaseCost,
        actualBudget: p.actualBudget,
        competition: p.competition,
        receiveRate: p.receiveRate,
        budgetPerHead: p.budgetPerHead,
        eventId: e.id,
        id: `${e.id}#${p.rank}`,
      }))
    );
  }

  function replacePrizes(rows) {
    const byEvent = new Map();
    rows.forEach((r) => {
      const list = byEvent.get(r.event) || [];
      list.push(r);
      byEvent.set(r.event, list);
    });
    byEvent.forEach((list, key) => {
      const ev = state.events.find((e) => e.id === key || e.name === key);
      if (!ev) return;
      ev.prizes = list
        .map((r) => ({
          rank: r.rank,
          kind: r.kind,
          form: r.form,
          unitPrice: r.unitPrice,
          count: r.count,
          winners: r.winners != null ? r.winners : r.count,
          receivers: r.receivers,
          purchaseCost: r.purchaseCost != null ? r.purchaseCost : r.count * r.unitPrice,
          actualBudget: r.actualBudget != null ? r.actualBudget : r.receivers * r.unitPrice,
        }))
        .sort((a, b) => a.rank - b.rank);
    });
  }

  function allEvents() {
    return state.events.map(eventMetrics);
  }
  function doneEvents() {
    return allEvents().filter((e) => e.signups != null);
  }
  function eventsOfMonth(month) {
    const last = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate();
    return allEvents().filter((e) => overlapsRange(e, `${month}-01`, `${month}-${String(last).padStart(2, '0')}`));
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
        rest: isRestDay(r.date),
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
    recomputeEventDays();
  }

  function replaceSegments(rows) {
    const key = (r) => `${r.month}|${r.ui}|${r.segment}`;
    const byKey = new Map(state.segMonthly.map((r) => [key(r), r]));
    rows.forEach((r) => byKey.set(key(r), r));
    state.segMonthly = Array.from(byKey.values());
    // 일자별 실적이 없는 달이 Seg에만 있어도 비교 기간에서 고를 수 있게 한다
    state.segMonthly.forEach((r) => {
      if (!months.includes(r.month)) months.push(r.month);
    });
    months.sort();
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
    periodsOf,
    prizesOf,
    prizeRows,
    replacePrizes,
    covers,
    monthStats,
    segStats,
    anomaly,
    dayCurve,
    incrementality,
    sameSeasonEvents,
    seriesThrough,
    clearSeed,
    replaceSegments,
    recomputeEventDays,
    replaceDays,
    replaceEvents,
    util: {
      toDate,
      toKey,
      addDays,
      eachDay,
      monthOf,
      isWeekend,
      isRestDay,
      holidayOf,
      dayName,
      daysBetween,
      monthLabel,
      hasRaffle,
      hasAll,
    },
    fmt,
  };
})(window);
