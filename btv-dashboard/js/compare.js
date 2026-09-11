(function (global) {
  'use strict';

  const { fmt } = BTV;
  const el = (id) => document.getElementById(id);

  const DIMS = {
    type: { label: '이벤트 타입', get: (e) => e.type, sort: (a, b) => BTV.TYPES.indexOf(a) - BTV.TYPES.indexOf(b) },
    discountRate: { label: '할인율', get: (e) => `${e.discountRate}%`, sort: (a, b) => parseFloat(a) - parseFloat(b) },
    prizeKind: { label: '경품 종류', get: (e) => e.prizeKind, sort: (a, b) => a.localeCompare(b, 'ko') },
    priceBand: {
      label: '경품 단가',
      get: (e) => e.priceBand,
      sort: (a, b) => (a === '없음' ? -1 : b === '없음' ? 1 : parseFloat(a) - parseFloat(b)),
    },
    budgetBand: {
      label: '인당 예산',
      get: (e) => e.budgetBand,
      sort: (a, b) => BTV.BUDGET_BANDS.indexOf(a) - BTV.BUDGET_BANDS.indexOf(b),
    },
  };

  const METRICS = {
    signups: { label: '가입자 수 (합계)', agg: 'sum', get: (e) => e.signups, fmt: (v) => fmt.num(v), better: 'high' },
    rate: { label: '가입률 (평균)', agg: 'avg', get: (e) => e.rate, fmt: (v) => fmt.pct(v), better: 'high' },
    dailyRate: { label: '일평균 가입률 (평균)', agg: 'avg', get: (e) => e.dailyRate, fmt: (v) => fmt.pct(v, 3), better: 'high' },
    weekendAvg: { label: '주말 일평균 가입자 수', agg: 'avg', get: (e) => e.weekendAvg, fmt: (v) => fmt.num(v), better: 'high' },
    weekdayAvg: { label: '평일 일평균 가입자 수', agg: 'avg', get: (e) => e.weekdayAvg, fmt: (v) => fmt.num(v), better: 'high' },
    count: { label: '이벤트 수', agg: 'count', get: () => 1, fmt: (v) => fmt.num(v), better: 'high' },
    entrants: { label: '응모자 수 (합계)', agg: 'sum', get: (e) => e.entrants, fmt: (v) => fmt.num(v), better: 'high' },
    entryRate: { label: '응모율 (평균)', agg: 'avg', get: (e) => e.entryRate, fmt: (v) => fmt.pct(v), better: 'high' },
    actualReceivers: { label: '실수령자 수 (합계)', agg: 'sum', get: (e) => e.actualReceivers, fmt: (v) => fmt.num(v), better: 'high' },
    receiveRate: { label: '실수령률 (평균)', agg: 'avg', get: (e) => e.receiveRate, fmt: (v) => fmt.pct(v, 1), better: 'high' },
    competition: {
      label: '경쟁률 (평균)',
      agg: 'avg',
      get: (e) => e.competition,
      fmt: (v) => (v == null ? '-' : `${v.toFixed(1)} : 1`),
      better: 'high',
    },
    // 비교 카드 전용
    dailyAvg: { label: '일평균 가입자 수', agg: 'avg', get: (e) => e.dailyAvg, fmt: (v) => fmt.num(v), better: 'high' },
    paidSignups: { label: '유료 가입자 수', agg: 'avg', get: (e) => e.paidSignups, fmt: (v) => fmt.num(v), better: 'high' },
    paidDailyAvg: { label: '일평균 유료 가입자 수', agg: 'avg', get: (e) => e.paidDailyAvg, fmt: (v) => fmt.num(v), better: 'high' },
  };

  const PIVOT_METRICS = [
    'signups',
    'rate',
    'dailyRate',
    'weekendAvg',
    'weekdayAvg',
    'count',
    'entrants',
    'entryRate',
    'actualReceivers',
    'receiveRate',
    'competition',
  ];
  const RAFFLE_ONLY = ['entrants', 'entryRate', 'actualReceivers', 'receiveRate', 'competition'];

  function aggregate(list, metric) {
    const spec = METRICS[metric];
    const vals = list.map(spec.get).filter((v) => v != null && !Number.isNaN(v));
    if (spec.agg === 'count') return list.length || null;
    if (!vals.length) return null;
    if (spec.agg === 'sum') return vals.reduce((s, v) => s + v, 0);
    return vals.reduce((s, v) => s + v, 0) / vals.length;
  }

  function similarity(base, ev) {
    let score = 0;
    if (ev.type === base.type) score += 3;
    if (ev.prizeKind === base.prizeKind) score += 2;
    if (Math.abs(ev.discountRate - base.discountRate) <= 10) score += 2;
    if (ev.priceBand === base.priceBand) score += 1;
    return score;
  }

  function comparisonSet(base) {
    const mode = el('compareCount').value;
    const pool = BTV.doneEvents().filter((e) => e.id !== base.id);
    if (mode === 'all') return pool;
    const n = Number(mode);
    return pool
      .map((e) => ({ e, score: similarity(base, e) }))
      .sort((a, b) => b.score - a.score || (a.e.startDate < b.e.startDate ? 1 : -1))
      .slice(0, n)
      .map((x) => x.e);
  }

  function deltaHtml(cur, ref, better) {
    if (cur == null || ref == null || !ref) return '';
    const diff = (cur - ref) / ref;
    const good = better === 'low' ? diff < 0 : diff > 0;
    return `<span class="delta ${good ? 'up' : 'down'}">${diff >= 0 ? '+' : ''}${(diff * 100).toFixed(1)}%</span>`;
  }

  /* ---------- 전체 이벤트 실적 ---------- */
  const COLUMN_GROUPS = ['기본 정보', '기간 · 모수', '쿠폰 실적', '유료 실적', '경품 · 예산', '추첨 성과'];
  const ALL_COLUMNS = [
    { g: 0, label: '이벤트 종류', left: true, get: (e) => e.type, raw: (e) => e.type },
    { g: 0, label: '할인율', get: (e) => `${e.discountRate}%`, raw: (e) => e.discountRate },
    { g: 0, label: '쿠폰 정책명', left: true, get: (e) => e.couponPolicy || '-', raw: (e) => e.couponPolicy },
    { g: 0, label: '경품 방식', left: true, get: (e) => e.prizeMethod || '-', raw: (e) => e.prizeMethod },
    { g: 0, label: '경품 유형', left: true, get: (e) => e.prizeForm || '-', raw: (e) => e.prizeForm },
    { g: 0, label: '경품 종류', left: true, get: (e) => e.prizeKind, raw: (e) => e.prizeKind },
    { g: 0, label: '이벤트명', left: true, get: (e) => e.name, raw: (e) => e.name },
    { g: 1, label: '진행 월', get: (e) => `${Number(e.startDate.slice(5, 7))}월`, raw: (e) => e.startDate },
    { g: 1, label: '일시', left: true, get: (e) => `${fmt.date(e.startDate)} ~ ${fmt.date(e.endDate)}`, raw: (e) => e.startDate },
    { g: 1, label: '전체 일수', get: (e) => e.totalDays, raw: (e) => e.totalDays },
    { g: 1, label: '평일 일수', get: (e) => e.weekdayDays, raw: (e) => e.weekdayDays },
    { g: 1, label: '주말 일수', get: (e) => e.weekendDays, raw: (e) => e.weekendDays },
    { g: 1, label: '모수', get: (e) => fmt.num(e.pool), raw: (e) => e.pool },
    { g: 2, label: '쿠폰 가입자 수', get: (e) => fmt.num(e.couponSignups), raw: (e) => e.couponSignups },
    { g: 2, label: '쿠폰 반응률', heat: true, get: (e) => fmt.pct(e.couponRate), raw: (e) => e.couponRate },
    { g: 2, label: '쿠폰 일평균 반응률', get: (e) => fmt.pct(e.couponDailyRate, 3), raw: (e) => e.couponDailyRate },
    { g: 2, label: '쿠폰 일평균 가입자 수', heat: true, get: (e) => fmt.num(e.couponDailyAvg), raw: (e) => e.couponDailyAvg },
    { g: 2, label: '쿠폰 주말 일평균 가입자 수', get: (e) => fmt.num(e.couponWeekendAvg), raw: (e) => e.couponWeekendAvg },
    { g: 2, label: '쿠폰 평일 일평균 가입자 수', get: (e) => fmt.num(e.couponWeekdayAvg), raw: (e) => e.couponWeekdayAvg },
    { g: 3, label: '유료 가입자 수', get: (e) => fmt.num(e.paidSignups), raw: (e) => e.paidSignups },
    { g: 3, label: '일평균 유료 가입자 수', heat: true, get: (e) => fmt.num(e.paidDailyAvg), raw: (e) => e.paidDailyAvg },
    { g: 3, label: '일평균 평일 유료 가입자 수', get: (e) => fmt.num(e.paidWeekdayAvg), raw: (e) => e.paidWeekdayAvg },
    { g: 3, label: '일평균 주말 유료 가입자 수', get: (e) => fmt.num(e.paidWeekendAvg), raw: (e) => e.paidWeekendAvg },
    { g: 3, label: '오가닉 비율', heat: true, get: (e) => fmt.pct(e.organicRatio, 1), raw: (e) => e.organicRatio },
    { g: 4, label: '경품 단가', get: (e) => (e.prizeUnitPrice ? fmt.manwon(e.prizeUnitPrice) : '-'), raw: (e) => e.prizeUnitPrice },
    { g: 4, label: '경품 개수', get: (e) => fmt.num(e.prizeCount), raw: (e) => e.prizeCount },
    { g: 4, label: '당첨자 선정 방식', left: true, get: (e) => e.winnerPick || '-', raw: (e) => e.winnerPick },
    { g: 4, label: '경품 구매비', get: (e) => (e.prizePurchaseCost ? fmt.manwon(e.prizePurchaseCost) : '-'), raw: (e) => e.prizePurchaseCost },
    { g: 4, label: '실예산', get: (e) => (e.actualBudget ? fmt.manwon(e.actualBudget) : '-'), raw: (e) => e.actualBudget },
    { g: 5, label: '응모자 수', get: (e) => fmt.num(e.entrants), raw: (e) => e.entrants },
    { g: 5, label: '응모율', heat: true, get: (e) => fmt.pct(e.entryRate), raw: (e) => e.entryRate },
    { g: 5, label: '수령자 수', get: (e) => fmt.num(e.actualReceivers), raw: (e) => e.actualReceivers },
    { g: 5, label: '수령률', heat: true, get: (e) => fmt.pct(e.receiveRate, 1), raw: (e) => e.receiveRate },
    { g: 5, label: '경쟁률', heat: true, get: (e) => (e.competition ? `${e.competition.toFixed(1)} : 1` : '-'), raw: (e) => e.competition },
    { g: 5, label: '인당 예산', heat: true, heatLow: true, get: (e) => (e.budgetPerHead ? fmt.won(e.budgetPerHead) : '-'), raw: (e) => e.budgetPerHead },
  ];

  let sortIndex = ALL_COLUMNS.findIndex((c) => c.label === '일시');
  let sortDir = -1;

  const ALL_FILTERS = [
    { id: 'f-year', get: (e) => e.startDate.slice(0, 4), label: (v) => `${v}년`, sort: (a, b) => a - b },
    { id: 'f-month', get: (e) => e.startDate.slice(5, 7), label: (v) => `${Number(v)}월`, sort: (a, b) => a - b },
    { id: 'f-type', get: (e) => e.type, sort: (a, b) => BTV.TYPES.indexOf(a) - BTV.TYPES.indexOf(b) },
    { id: 'f-discount', get: (e) => String(e.discountRate), label: (v) => `${v}%`, sort: (a, b) => a - b },
    { id: 'f-name', get: (e) => e.name, sort: (a, b) => a.localeCompare(b, 'ko') },
    { id: 'f-method', get: (e) => e.prizeMethod, sort: (a, b) => a.localeCompare(b, 'ko') },
    { id: 'f-form', get: (e) => e.prizeForm, sort: (a, b) => a.localeCompare(b, 'ko') },
    { id: 'f-kind', get: (e) => e.prizeKind, sort: (a, b) => a.localeCompare(b, 'ko') },
  ];

  function allEventRows() {
    return BTV.doneEvents().filter((e) =>
      ALL_FILTERS.every((f) => {
        const picked = el(f.id).value;
        return !picked || f.get(e) === picked;
      })
    );
  }

  function populateFilters() {
    const events = BTV.doneEvents();
    ALL_FILTERS.filter((f) => f.id !== 'f-name').forEach((f) => {
      const values = [...new Set(events.map(f.get))].sort(f.sort);
      el(f.id).insertAdjacentHTML(
        'beforeend',
        values.map((v) => `<option value="${v}">${f.label ? f.label(v) : v}</option>`).join('')
      );
    });
    // 3개년치가 한 번에 쏟아지지 않도록 진입 시에는 당해 당월만 보여준다
    el('f-year').value = BTV.LAST_DATA_DAY.slice(0, 4);
    el('f-month').value = BTV.LAST_DATA_DAY.slice(5, 7);
  }

  // 이벤트명은 3개년이면 수백 개가 되므로 다른 필터 결과에 맞춰 목록을 좁힌다
  function refreshNameOptions() {
    const sel = el('f-name');
    const spec = ALL_FILTERS.find((f) => f.id === 'f-name');
    const others = ALL_FILTERS.filter((f) => f.id !== 'f-name');
    const names = [
      ...new Set(
        BTV.doneEvents()
          .filter((e) => others.every((f) => !el(f.id).value || f.get(e) === el(f.id).value))
          .map(spec.get)
      ),
    ].sort(spec.sort);
    const current = sel.value;
    sel.innerHTML = `<option value="">전체</option>${names.map((v) => `<option value="${v}">${v}</option>`).join('')}`;
    sel.value = names.includes(current) ? current : '';
  }

  function paintComment(id, lines) {
    el(id).innerHTML = `<ul>${lines
      .filter(Boolean)
      .map((line) => `<li class="${line.warn ? 'warn' : ''}"><span class="k">${line.k}</span><span>${line.v}</span></li>`)
      .join('')}</ul>`;
  }

  function sortRows(list) {
    const col = ALL_COLUMNS[sortIndex];
    if (!col) return list;
    return list.slice().sort((a, b) => {
      const va = col.raw(a);
      const vb = col.raw(b);
      if (va == null && vb == null) return 0;
      if (va == null) return 1; // 값 없는 행은 방향과 무관하게 뒤로
      if (vb == null) return -1;
      const diff = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb), 'ko');
      return diff * sortDir;
    });
  }

  // 숫자가 많은 표라 핵심 컬럼만 값의 크기를 배경 농도로 보여준다
  function heatScales(list) {
    const scales = {};
    ALL_COLUMNS.forEach((col, i) => {
      if (!col.heat) return;
      const values = list.map(col.raw).filter((v) => v != null && !Number.isNaN(v));
      if (values.length > 1) scales[i] = { min: Math.min(...values), max: Math.max(...values) };
    });
    return scales;
  }

  function renderAllEvents() {
    refreshNameOptions();
    const list = sortRows(allEventRows());
    const scales = heatScales(list);

    const groupHeader = COLUMN_GROUPS.map((name, gi) => {
      const span = ALL_COLUMNS.filter((c) => c.g === gi).length;
      return `<th colspan="${span}" class="grp grp-${gi % 2} group-start">${name}</th>`;
    }).join('');

    const columnHeader = ALL_COLUMNS.map((c, i) => {
      const first = ALL_COLUMNS.findIndex((x) => x.g === c.g) === i;
      const arrow = i === sortIndex ? (sortDir === 1 ? ' ▲' : ' ▼') : '';
      return `<th class="sortable ${c.left ? 'left' : ''} ${first ? 'group-start' : ''} ${i === sortIndex ? 'sorted' : ''}" data-sort="${i}">${c.label}${arrow}</th>`;
    }).join('');

    const body = list
      .map(
        (e) =>
          `<tr>${ALL_COLUMNS.map((c, i) => {
            const first = ALL_COLUMNS.findIndex((x) => x.g === c.g) === i;
            const scale = scales[i];
            let style = '';
            if (scale) {
              const v = c.raw(e);
              if (v != null && scale.max !== scale.min) {
                const norm = (v - scale.min) / (scale.max - scale.min);
                const strength = c.heatLow ? 1 - norm : norm;
                style = ` style="background: rgba(13,91,209,${(0.05 + strength * 0.3).toFixed(3)})"`;
              }
            }
            return `<td class="${c.left ? 'left' : 'num'}${first ? ' group-start' : ''}"${style}>${c.get(e)}</td>`;
          }).join('')}</tr>`
      )
      .join('');

    el('allEventsTable').innerHTML = `
      <thead>
        <tr>${groupHeader}</tr>
        <tr>${columnHeader}</tr>
      </thead>
      <tbody>${
        list.length ? body : `<tr><td class="left" colspan="${ALL_COLUMNS.length}">조건에 맞는 이벤트가 없습니다.</td></tr>`
      }</tbody>`;
    el('allCount').textContent = `${list.length}건 표시 (전체 ${BTV.doneEvents().length}건) · 헤더를 클릭하면 정렬됩니다`;
    commentAll(list);
  }

  function commentAll(list) {
    if (!list.length) {
      paintComment('allComment', [{ k: '결과 없음', v: '조건에 맞는 이벤트가 없습니다. 필터를 완화해보세요.', warn: true }]);
      return;
    }
    const byRate = list.slice().sort((a, b) => b.rate - a.rate);
    const best = byRate[0];
    const worst = byRate[byRate.length - 1];
    const avgRate = list.reduce((s, e) => s + e.rate, 0) / list.length;
    const budgetRows = list.filter((e) => e.budgetPerHead).sort((a, b) => a.budgetPerHead - b.budgetPerHead);
    const organic = list.filter((e) => e.organicRatio != null);
    const avgOrganic = organic.length ? organic.reduce((s, e) => s + e.organicRatio, 0) / organic.length : null;
    const inFlight = list.filter((e) => e.inFlight);
    const avgBudget = budgetRows.length
      ? budgetRows.reduce((s, e) => s + e.budgetPerHead, 0) / budgetRows.length
      : null;

    paintComment('allComment', [
      {
        k: '요약',
        v: `선택 <b>${list.length}건</b> · 평균 가입률 <b>${fmt.pct(avgRate)}</b>${avgBudget ? ` · 평균 인당 예산 <b>${fmt.won(avgBudget)}</b>` : ''}`,
      },
      {
        k: '최고 성과',
        v: `<b>${best.name}</b> — 가입률 ${fmt.pct(best.rate)} (${best.type}, 할인 ${best.discountRate}%${best.prizeKind !== '없음' ? `, ${best.prizeKind} ${best.priceBand}` : ''})`,
      },
      list.length > 1 && {
        k: '최저 성과',
        v: `<b>${worst.name}</b> — 가입률 ${fmt.pct(worst.rate)} · 최고 대비 <b>${(best.rate / worst.rate).toFixed(1)}배</b> 차이`,
      },
      budgetRows.length && {
        k: '예산 효율',
        v: `인당 예산 최저 <b>${budgetRows[0].name}</b> ${fmt.won(budgetRows[0].budgetPerHead)}${budgetRows.length > 1 ? ` / 최고 ${budgetRows[budgetRows.length - 1].name} ${fmt.won(budgetRows[budgetRows.length - 1].budgetPerHead)}` : ''}`,
      },
      avgOrganic != null && {
        k: '오가닉 비율',
        v: `평균 <b>${fmt.pct(avgOrganic, 1)}</b> (쿠폰 가입자 ÷ 유료 가입자)`,
      },
      inFlight.length && {
        k: '유의사항',
        v: `진행 중 ${inFlight.length}건 포함 — 누적 수치라 종료된 이벤트와 직접 비교 시 주의가 필요합니다.`,
        warn: true,
      },
    ]);
  }

  /* ---------- 현재 ↔ 과거 비교 ---------- */
  function renderCompare() {
    const base = BTV.doneEvents().find((e) => e.id === el('baseEvent').value);
    if (!base) return;
    const others = comparisonSet(base);
    const modeLabel = el('compareCount').value === 'all' ? '전체 평균' : `유사 ${others.length}건 평균`;

    const cards = ['rate', 'dailyAvg', 'weekendAvg', 'weekdayAvg', 'paidSignups', 'paidDailyAvg'];
    el('compareCards').innerHTML = cards
      .map((key) => {
        const spec = METRICS[key];
        const cur = spec.get(base);
        const ref = aggregate(others, key);
        return `<div class="kpi">
          <div class="label">${spec.label}</div>
          <div class="value">${spec.fmt(cur)}</div>
          <div class="sub">${modeLabel} ${spec.fmt(ref)} ${deltaHtml(cur, ref, spec.better)}</div>
        </div>`;
      })
      .join('');

    el('compareHint').textContent = base.inFlight
      ? `${base.name}은(는) 진행 중(${base.elapsedDays}/${base.totalDays}일)입니다. 일평균은 경과일 기준이지만 가입률·가입자 수는 현재까지 누적이라 종료된 이벤트보다 낮게 보입니다.`
      : '';
    commentCompare(base, others, modeLabel);

    const list = [base, ...others].slice(0, 8);
    Charts.render('compareChart', {
      type: 'bar',
      data: {
        labels: list.map((e) => (e.name.length > 12 ? `${e.name.slice(0, 11)}…` : e.name)),
        datasets: [
          {
            label: '가입률 (%)',
            data: list.map((e) => +(e.rate * 100).toFixed(2)),
            backgroundColor: list.map((e) => (e.id === base.id ? '#0d5bd1' : 'rgba(13,91,209,.35)')),
            yAxisID: 'y',
            hideLabels: true,
          },
          {
            label: '일평균 유료 가입자',
            type: 'line',
            data: list.map((e) => Math.round(e.paidDailyAvg || 0)),
            borderColor: '#d94f3d',
            backgroundColor: '#d94f3d',
            yAxisID: 'y1',
            tension: 0.3,
            hideLabels: true,
          },
        ],
      },
      options: {
        plugins: { legend: { position: 'bottom' } },
        scales: {
          y: { beginAtZero: true, title: { display: true, text: '가입률 (%)' } },
          y1: {
            beginAtZero: true,
            position: 'right',
            grid: { drawOnChartArea: false },
            title: { display: true, text: '일평균 유료' },
          },
        },
      },
    });

    el('compareTable').innerHTML = `
      <thead><tr>
        <th class="left">구분</th><th class="left">이벤트명</th><th class="left">타입</th><th>할인율</th>
        <th class="left">경품</th><th>모수</th><th>가입자 수</th><th>가입률</th><th>일평균 가입자</th>
        <th>주말 일평균 가입자</th><th>평일 일평균 가입자</th>
        <th>유료 가입자 수</th><th>일평균 유료</th><th>일평균 주말 유료</th><th>일평균 평일 유료</th>
      </tr></thead>
      <tbody>${[base, ...others]
        .map(
          (e) => `<tr${e.id === base.id ? ' style="background:#eef4ff"' : ''}>
        <td class="left">${e.id === base.id ? '<span class="tag">기준</span>' : '비교'}</td>
        <td class="left">${e.name}${e.inFlight ? ` <span class="tag live">진행중 ${e.elapsedDays}/${e.totalDays}일</span>` : ''}</td>
        <td class="left">${e.type}</td>
        <td class="num">${e.discountRate}%</td>
        <td class="left">${e.prizeKind === '없음' ? '-' : `${e.prizeKind} ${e.priceBand}`}</td>
        <td class="num">${fmt.num(e.pool)}</td>
        <td class="num">${fmt.num(e.signups)}</td>
        <td class="num">${fmt.pct(e.rate)}</td>
        <td class="num">${fmt.num(e.dailyAvg)}</td>
        <td class="num">${fmt.num(e.weekendAvg)}</td>
        <td class="num">${fmt.num(e.weekdayAvg)}</td>
        <td class="num">${fmt.num(e.paidSignups)}</td>
        <td class="num">${fmt.num(e.paidDailyAvg)}</td>
        <td class="num">${fmt.num(e.paidWeekendAvg)}</td>
        <td class="num">${fmt.num(e.paidWeekdayAvg)}</td>
      </tr>`
        )
        .join('')}</tbody>`;
  }

  function commentCompare(base, others, modeLabel) {
    if (!others.length) {
      paintComment('compareComment', [{ k: '비교 불가', v: `${base.name}과 비교할 이벤트가 없습니다.`, warn: true }]);
      return;
    }
    const refRate = aggregate(others, 'rate');
    const refPaidDaily = aggregate(others, 'paidDailyAvg');
    const refWeekend = aggregate(others, 'weekendAvg');
    const refWeekday = aggregate(others, 'weekdayAvg');
    const pct = (cur, ref) => (ref ? ((cur - ref) / ref) * 100 : null);
    const mark = (v) => (v == null ? '-' : `<b>${v >= 0 ? '+' : ''}${v.toFixed(1)}%</b>`);
    const rateDiff = pct(base.rate, refRate);
    const paidDiff = pct(base.paidDailyAvg, refPaidDaily);
    const weekendGap = base.weekendAvg && base.weekdayAvg ? base.weekendAvg / base.weekdayAvg : null;
    const refGap = refWeekend && refWeekday ? refWeekend / refWeekday : null;

    paintComment('compareComment', [
      {
        k: '기준 이벤트',
        v: `<b>${base.name}</b> — ${base.type}, 할인 ${base.discountRate}%${base.prizeKind !== '없음' ? `, ${base.prizeKind} ${base.priceBand}` : ''}`,
      },
      { k: '비교 대상', v: `${modeLabel} (${others.length}건)` },
      { k: '가입률', v: `${fmt.pct(base.rate)} → 비교군 ${fmt.pct(refRate)} 대비 ${mark(rateDiff)}` },
      {
        k: '일평균 유료',
        v: `${fmt.num(base.paidDailyAvg)}명 → 비교군 ${fmt.num(refPaidDaily)}명 대비 ${mark(paidDiff)}`,
      },
      {
        k: '주말/평일',
        v:
          weekendGap && refGap
            ? `주말이 평일의 <b>${weekendGap.toFixed(2)}배</b> (비교군 ${refGap.toFixed(2)}배) — ${weekendGap >= refGap ? '주말 집중도가 더 큽니다' : '평일에도 고르게 유입됐습니다'}`
            : '주말 또는 평일 경과일이 없어 비교에서 제외했습니다',
      },
      base.inFlight && {
        k: '유의사항',
        v: `기준 이벤트가 진행 중(${base.elapsedDays}/${base.totalDays}일)이라 가입률·가입자 수는 계속 올라갑니다.`,
        warn: true,
      },
    ]);
  }

  /* ---------- 교차분석 ---------- */
  function renderPivot() {
    const rowDim = el('pivotRow').value;
    const colDim = el('pivotCol').value;
    const metric = el('pivotMetric').value;
    const spec = METRICS[metric];
    let list = BTV.doneEvents();
    if (RAFFLE_ONLY.includes(metric)) list = list.filter((e) => e.isRaffle && e.entrants);

    const rowVals = [...new Set(list.map(DIMS[rowDim].get))].sort(DIMS[rowDim].sort);
    const colVals = [...new Set(list.map(DIMS[colDim].get))].sort(DIMS[colDim].sort);

    const cells = {};
    let min = Infinity;
    let max = -Infinity;
    rowVals.forEach((r) => {
      cells[r] = {};
      colVals.forEach((c) => {
        const subset = list.filter((e) => DIMS[rowDim].get(e) === r && DIMS[colDim].get(e) === c);
        const value = subset.length ? aggregate(subset, metric) : null;
        cells[r][c] = { value, n: subset.length };
        if (value != null) {
          min = Math.min(min, value);
          max = Math.max(max, value);
        }
      });
    });

    const shade = (v) => {
      if (v == null || max === min) return '';
      const norm = (v - min) / (max - min);
      const strength = spec.better === 'low' ? 1 - norm : norm;
      return `background: rgba(13,91,209,${(0.04 + strength * 0.32).toFixed(3)})`;
    };

    el('pivotTable').innerHTML = `
      <thead><tr>
        <th class="left">${DIMS[rowDim].label} \\ ${DIMS[colDim].label}</th>
        ${colVals.map((c) => `<th>${c}</th>`).join('')}
        <th>행 합계/평균</th>
      </tr></thead>
      <tbody>${rowVals
        .map((r) => {
          const rowSubset = list.filter((e) => DIMS[rowDim].get(e) === r);
          return `<tr>
          <td class="left">${r}</td>
          ${colVals
            .map((c) => {
              const cell = cells[r][c];
              return `<td class="num" style="${shade(cell.value)}" title="이벤트 ${cell.n}건">${
                cell.value == null ? '-' : spec.fmt(cell.value)
              }${cell.n ? `<br><span class="hint">n=${cell.n}</span>` : ''}</td>`;
            })
            .join('')}
          <td class="num"><b>${spec.fmt(aggregate(rowSubset, metric))}</b></td>
        </tr>`;
        })
        .join('')}</tbody>
      <tfoot><tr>
        <td class="left">열 합계/평균</td>
        ${colVals
          .map((c) => {
            const colSubset = list.filter((e) => DIMS[colDim].get(e) === c);
            return `<td class="num">${spec.fmt(aggregate(colSubset, metric))}</td>`;
          })
          .join('')}
        <td class="num">${spec.fmt(aggregate(list, metric))}</td>
      </tr></tfoot>`;

    const ranked = [];
    rowVals.forEach((r) =>
      colVals.forEach((c) => {
        const cell = cells[r][c];
        if (cell.value != null && cell.n > 0) ranked.push({ r, c, ...cell });
      })
    );
    ranked.sort((a, b) => (spec.better === 'low' ? a.value - b.value : b.value - a.value));
    el('pivotHint').textContent = ranked.length
      ? `분석 대상 ${list.length}건 · 가장 ${spec.better === 'low' ? '낮은' : '높은'} 조합: ${ranked[0].r} × ${ranked[0].c} (${spec.fmt(ranked[0].value)}, n=${ranked[0].n})`
      : '분석 가능한 데이터가 없습니다.';
    commentPivot(rowDim, colDim, metric, list, ranked, rowVals, colVals);
  }

  function commentPivot(rowDim, colDim, metric, list, ranked, rowVals, colVals) {
    const spec = METRICS[metric];
    if (!ranked.length) {
      paintComment('pivotComment', [
        { k: '결과 없음', v: '선택한 조합에 해당하는 데이터가 없습니다. 다른 지표나 기준을 선택해보세요.', warn: true },
      ]);
      return;
    }
    const top = ranked[0];
    const bottom = ranked[ranked.length - 1];
    const thin = ranked.filter((c) => c.n === 1).length;
    const rankOf = (dim, values) =>
      values
        .map((v) => ({ v, value: aggregate(list.filter((e) => DIMS[dim].get(e) === v), metric) }))
        .filter((x) => x.value != null)
        .sort((a, b) => (spec.better === 'low' ? a.value - b.value : b.value - a.value));
    const rowRank = rankOf(rowDim, rowVals);
    const colRank = rankOf(colDim, colVals);
    const high = spec.better === 'low' ? '낮은' : '높은';
    const low = spec.better === 'low' ? '높은' : '낮은';

    paintComment('pivotComment', [
      {
        k: '분석 조건',
        v: `${DIMS[rowDim].label} × ${DIMS[colDim].label} · 지표 <b>${spec.label}</b> · 대상 ${list.length}건`,
      },
      { k: `가장 ${high} 조합`, v: `<b>${top.r} × ${top.c}</b> — ${spec.fmt(top.value)} (n=${top.n})` },
      { k: `가장 ${low} 조합`, v: `${bottom.r} × ${bottom.c} — ${spec.fmt(bottom.value)} (n=${bottom.n})` },
      rowRank.length > 1 && {
        k: DIMS[rowDim].label,
        v: `<b>${rowRank[0].v}</b> ${spec.fmt(rowRank[0].value)} 최상 / ${rowRank[rowRank.length - 1].v} ${spec.fmt(rowRank[rowRank.length - 1].value)} 최하`,
      },
      colRank.length > 1 && {
        k: DIMS[colDim].label,
        v: `<b>${colRank[0].v}</b> ${spec.fmt(colRank[0].value)} 최상 / ${colRank[colRank.length - 1].v} ${spec.fmt(colRank[colRank.length - 1].value)} 최하`,
      },
      thin && {
        k: '유의사항',
        v: `${thin}개 조합은 이벤트 1건뿐이라 일반화에 주의가 필요합니다.`,
        warn: true,
      },
    ]);
  }

  function init() {
    const baseSel = el('baseEvent');
    BTV.doneEvents()
      .slice()
      .reverse()
      .forEach((e) => {
        baseSel.insertAdjacentHTML(
          'beforeend',
          `<option value="${e.id}">${e.name} (${fmt.date(e.startDate)}~${fmt.date(e.endDate)})</option>`
        );
      });

    populateFilters();

    Object.entries(DIMS).forEach(([key, dim]) => {
      el('pivotRow').insertAdjacentHTML('beforeend', `<option value="${key}">${dim.label}</option>`);
      el('pivotCol').insertAdjacentHTML('beforeend', `<option value="${key}">${dim.label}</option>`);
    });
    PIVOT_METRICS.forEach((key) => {
      el('pivotMetric').insertAdjacentHTML('beforeend', `<option value="${key}">${METRICS[key].label}</option>`);
    });
    el('pivotRow').value = 'type';
    el('pivotCol').value = 'discountRate';
    el('pivotMetric').value = 'rate';

    ALL_FILTERS.forEach((f) => el(f.id).addEventListener('change', renderAllEvents));
    el('allEventsTable').addEventListener('click', (e) => {
      const index = e.target.dataset.sort;
      if (index == null) return;
      const next = Number(index);
      sortDir = sortIndex === next ? -sortDir : -1;
      sortIndex = next;
      renderAllEvents();
    });
    el('allReset').addEventListener('click', () => {
      ALL_FILTERS.forEach((f) => {
        el(f.id).value = '';
      });
      el('f-year').value = BTV.LAST_DATA_DAY.slice(0, 4);
      el('f-month').value = BTV.LAST_DATA_DAY.slice(5, 7);
      renderAllEvents();
    });
    baseSel.addEventListener('change', renderCompare);
    el('compareCount').addEventListener('change', renderCompare);
    ['pivotRow', 'pivotCol'].forEach((id) =>
      el(id).addEventListener('change', (e) => {
        const other = id === 'pivotRow' ? el('pivotCol') : el('pivotRow');
        if (other.value === e.target.value) {
          other.value = Object.keys(DIMS).find((k) => k !== e.target.value);
        }
        renderPivot();
      })
    );
    el('pivotMetric').addEventListener('change', renderPivot);

    render();
  }

  function render() {
    renderAllEvents();
    renderCompare();
    renderPivot();
  }

  global.Compare = { init, render, DIMS, METRICS, aggregate, similarity, comparisonSet };
})(window);
