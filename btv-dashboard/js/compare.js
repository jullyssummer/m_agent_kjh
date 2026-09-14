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
    restAvg: { label: '휴일 일평균 가입자 수', agg: 'avg', get: (e) => e.restAvg, fmt: (v) => fmt.num(v), better: 'high' },
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
    'restAvg',
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
    { g: 1, label: '휴일 일수', get: (e) => e.restDays, raw: (e) => e.restDays },
    { g: 1, label: '모수', get: (e) => fmt.num(e.pool), raw: (e) => e.pool },
    { g: 2, label: '쿠폰 가입자 수', get: (e) => fmt.num(e.couponSignups), raw: (e) => e.couponSignups },
    { g: 2, label: '쿠폰 반응률', heat: true, get: (e) => fmt.pct(e.couponRate), raw: (e) => e.couponRate },
    { g: 2, label: '쿠폰 일평균 반응률', get: (e) => fmt.pct(e.couponDailyRate, 3), raw: (e) => e.couponDailyRate },
    { g: 2, label: '쿠폰 일평균 가입자 수', heat: true, get: (e) => fmt.num(e.couponDailyAvg), raw: (e) => e.couponDailyAvg },
    { g: 2, label: '쿠폰 휴일 일평균 가입자 수', get: (e) => fmt.num(e.couponRestAvg), raw: (e) => e.couponRestAvg },
    { g: 2, label: '쿠폰 평일 일평균 가입자 수', get: (e) => fmt.num(e.couponWeekdayAvg), raw: (e) => e.couponWeekdayAvg },
    { g: 3, label: '유료 가입자 수', get: (e) => fmt.num(e.paidSignups), raw: (e) => e.paidSignups },
    { g: 3, label: '일평균 유료 가입자 수', heat: true, get: (e) => fmt.num(e.paidDailyAvg), raw: (e) => e.paidDailyAvg },
    { g: 3, label: '일평균 평일 유료 가입자 수', get: (e) => fmt.num(e.paidWeekdayAvg), raw: (e) => e.paidWeekdayAvg },
    { g: 3, label: '일평균 휴일 유료 가입자 수', get: (e) => fmt.num(e.paidRestAvg), raw: (e) => e.paidRestAvg },
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

    const cards = ['rate', 'dailyAvg', 'restAvg', 'weekdayAvg', 'paidSignups', 'paidDailyAvg'];
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
        <th>휴일 일평균 가입자</th><th>평일 일평균 가입자</th>
        <th>유료 가입자 수</th><th>일평균 유료</th><th>일평균 휴일 유료</th><th>일평균 평일 유료</th>
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
        <td class="num">${fmt.num(e.restAvg)}</td>
        <td class="num">${fmt.num(e.weekdayAvg)}</td>
        <td class="num">${fmt.num(e.paidSignups)}</td>
        <td class="num">${fmt.num(e.paidDailyAvg)}</td>
        <td class="num">${fmt.num(e.paidRestAvg)}</td>
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
    const refWeekend = aggregate(others, 'restAvg');
    const refWeekday = aggregate(others, 'weekdayAvg');
    const pct = (cur, ref) => (ref ? ((cur - ref) / ref) * 100 : null);
    const mark = (v) => (v == null ? '-' : `<b>${v >= 0 ? '+' : ''}${v.toFixed(1)}%</b>`);
    const rateDiff = pct(base.rate, refRate);
    const paidDiff = pct(base.paidDailyAvg, refPaidDaily);
    const restGap = base.restAvg && base.weekdayAvg ? base.restAvg / base.weekdayAvg : null;
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
        k: '휴일/평일',
        v:
          restGap && refGap
            ? `휴일이 평일의 <b>${restGap.toFixed(2)}배</b> (비교군 ${refGap.toFixed(2)}배) — ${restGap >= refGap ? '휴일 집중도가 더 큽니다' : '평일에도 고르게 유입됐습니다'}`
            : '휴일 또는 평일 경과일이 없어 비교에서 제외했습니다',
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
        const raw = subset.map(spec.get).filter((v) => v != null && !Number.isNaN(v));
        cells[r][c] = {
          value,
          n: subset.length,
          min: raw.length > 1 ? Math.min(...raw) : null,
          max: raw.length > 1 ? Math.max(...raw) : null,
        };
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
              if (cell.value == null) return '<td class="num">-</td>';
              // n이 1~2건인 칸은 흐리게 해서 눈으로 걸러지게 한다
              const thin = cell.n <= 2 ? ' thin' : '';
              const range =
                cell.min != null && spec.agg === 'avg' ? `<br><span class="range">${spec.fmt(cell.min)} ~ ${spec.fmt(cell.max)}</span>` : '';
              return `<td class="num drillable${thin}" style="${shade(cell.value)}" data-row="${r}" data-col="${c}" title="클릭하면 해당 이벤트 ${cell.n}건을 볼 수 있습니다">${spec.fmt(
                cell.value
              )}<br><span class="hint">n=${cell.n}</span>${range}</td>`;
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
    el('pivotDrill').hidden = true;
  }

  // 교차분석 셀을 누르면 그 조합에 들어간 이벤트를 바로 펼쳐 본다
  function renderDrill(rowValue, colValue) {
    const rowDim = el('pivotRow').value;
    const colDim = el('pivotCol').value;
    const metric = el('pivotMetric').value;
    let list = BTV.doneEvents();
    if (RAFFLE_ONLY.includes(metric)) list = list.filter((e) => e.isRaffle && e.entrants);
    const subset = list.filter((e) => DIMS[rowDim].get(e) === rowValue && DIMS[colDim].get(e) === colValue);

    el('pivotDrill').hidden = false;
    el('pivotDrill').innerHTML = `
      <header class="drill-head">
        <strong>${DIMS[rowDim].label} ${rowValue} × ${DIMS[colDim].label} ${colValue}</strong>
        <span class="hint">${subset.length}건 · ${METRICS[metric].label} ${METRICS[metric].fmt(aggregate(subset, metric))}</span>
        <button class="icon-btn" id="drillClose" title="닫기">×</button>
      </header>
      <div class="table-wrap"><table>
        <thead><tr>
          <th class="left">이벤트명</th><th class="left">기간</th><th>모수</th><th>가입자 수</th>
          <th>가입률</th><th>일평균</th><th>인당 예산</th><th class="left">기준 이벤트로</th>
        </tr></thead>
        <tbody>${subset
          .map(
            (e) => `<tr>
          <td class="left">${e.name}</td>
          <td class="left">${fmt.date(e.startDate)} ~ ${fmt.date(e.endDate)}</td>
          <td class="num">${fmt.num(e.pool)}</td>
          <td class="num">${fmt.num(e.signups)}</td>
          <td class="num">${fmt.pct(e.rate)}</td>
          <td class="num">${fmt.num(e.dailyAvg)}</td>
          <td class="num">${e.budgetPerHead ? fmt.won(e.budgetPerHead) : '-'}</td>
          <td class="left"><button class="btn small ghost" data-pick="${e.id}">선택</button></td>
        </tr>`
          )
          .join('')}</tbody>
      </table></div>`;
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

  const currentBase = () => BTV.doneEvents().find((e) => e.id === el('baseEvent').value) || BTV.doneEvents().slice(-1)[0];

  /* ---------- 증분 효과 · 되돌림 ---------- */
  function renderIncremental() {
    const base = currentBase();
    const inc = base && BTV.incrementality(base);
    if (!inc) {
      el('incrementalCards').innerHTML = '';
      paintComment('incrementalComment', [
        { k: '계산 불가', v: '업로드한 이벤트는 일자별 기준선이 없어 증분을 계산할 수 없습니다.', warn: true },
      ]);
      return;
    }
    const paybackPct = inc.payback != null ? inc.payback * 100 : null;
    el('incrementalCards').innerHTML = `
      <div class="kpi">
        <div class="label">순증분 가입자</div>
        <div class="value">${fmt.num(inc.incremental)}</div>
        <div class="sub">기간 중 평상시 기준선 ${fmt.num(inc.baseline)} 대비</div>
      </div>
      <div class="kpi">
        <div class="label">기준선 대비 상승폭</div>
        <div class="value">${fmt.pct(inc.liftRatio, 1)}</div>
        <div class="sub">이벤트가 없었다면 들어왔을 양 대비 추가 유입</div>
      </div>
      <div class="kpi">
        <div class="label">종료 후 ${inc.tailDays}일</div>
        <div class="value ${paybackPct != null && paybackPct < 0 ? 'warn' : ''}">${paybackPct == null ? '-' : `${paybackPct >= 0 ? '+' : ''}${paybackPct.toFixed(1)}%`}</div>
        <div class="sub">${paybackPct == null ? '집계 구간 없음' : paybackPct < 0 ? '수요 당겨쓰기 발생' : '종료 후에도 기준선 이상 유지'}</div>
      </div>
      <div class="kpi">
        <div class="label">실질 순증분</div>
        <div class="value">${fmt.num(inc.incremental + (inc.tailActual - inc.tailBaseline))}</div>
        <div class="sub">순증분에서 종료 후 감소분을 뺀 값</div>
      </div>`;

    paintComment('incrementalComment', [
      {
        k: '순증분',
        v: `<b>${base.name}</b> 기간의 가입자 중 <b>${fmt.num(inc.incremental)}건</b>이 이벤트 기여분입니다 (기준선 대비 +${fmt.pct(inc.liftRatio, 1)}).`,
      },
      {
        k: '되돌림',
        v:
          paybackPct == null
            ? '종료 직후 집계 구간이 없어 판단할 수 없습니다.'
            : paybackPct < -5
              ? `종료 후 ${inc.tailDays}일간 기준선 대비 <b>${paybackPct.toFixed(1)}%</b> 낮았습니다. 이벤트로 수요를 앞당겨 쓴 것으로 보입니다.`
              : `종료 후 ${inc.tailDays}일간 기준선 대비 ${paybackPct.toFixed(1)}%로, 눈에 띄는 수요 당겨쓰기는 없었습니다.`,
      },
      inc.approx && {
        k: '계산 방식',
        v: `이벤트별 일자 데이터가 없어 <b>직전 ${inc.baselineSample || 0}일의 평상시 평균</b>을 기준선으로 잡아 근사 계산했습니다.`,
      },
      inc.overlapping > 0 && {
        k: '유의사항',
        v: `기간이 겹친 다른 이벤트가 ${inc.overlapping}건 있어, 위 순증분은 겹친 이벤트들의 합입니다.`,
        warn: true,
      },
      !inc.baselineReliable && {
        k: '유의사항',
        v: '이벤트 직전에 이벤트 없는 날이 부족해 기준선이 불안정합니다. 증분 수치를 그대로 보고하지 마세요.',
        warn: true,
      },
      inc.tailPolluted && {
        k: '유의사항',
        v: '종료 직후 기간에 다른 이벤트가 겹쳐 있어 되돌림 수치는 참고용으로만 보세요.',
        warn: true,
      },
    ]);
  }

  /* ---------- 전년 동기 비교 ---------- */
  function renderSeason() {
    const base = currentBase();
    const matches = base ? BTV.sameSeasonEvents(base) : [];
    el('seasonBasis').textContent = matches.length ? matches[0].basis : '';
    const list = [{ event: base, basis: '기준' }, ...matches.slice(0, 5)];

    el('seasonTable').innerHTML = `
      <thead><tr>
        <th class="left">구분</th><th class="left">이벤트명</th><th class="left">기간</th><th class="left">타입</th>
        <th>할인율</th><th>모수</th><th>가입자 수</th><th>가입률</th><th>일평균</th><th>인당 예산</th>
      </tr></thead>
      <tbody>${
        list.length > 1
          ? list
              .map(
                ({ event: e, basis }, i) => `<tr${i === 0 ? ' style="background:#eef4ff"' : ''}>
        <td class="left">${i === 0 ? '<span class="tag">기준</span>' : `<span class="hint">${basis}</span>`}</td>
        <td class="left">${e.name}</td>
        <td class="left">${e.startDate} ~ ${e.endDate}</td>
        <td class="left">${e.type}</td>
        <td class="num">${e.discountRate}%</td>
        <td class="num">${fmt.num(e.pool)}</td>
        <td class="num">${fmt.num(e.signups)}</td>
        <td class="num">${fmt.pct(e.rate)}</td>
        <td class="num">${fmt.num(e.dailyAvg)}</td>
        <td class="num">${e.budgetPerHead ? fmt.won(e.budgetPerHead) : '-'}</td>
      </tr>`
              )
              .join('')
          : '<tr><td colspan="10" class="left">이전 연도에 같은 시기 이벤트가 없습니다.</td></tr>'
      }</tbody>`;

    if (!matches.length) {
      paintComment('seasonComment', [
        { k: '비교 불가', v: '이전 연도에 같은 달·같은 명절 시기 이벤트가 없습니다.', warn: true },
      ]);
      return;
    }
    const refRate = matches.reduce((s, m) => s + m.event.rate, 0) / matches.length;
    const diff = refRate ? ((base.rate - refRate) / refRate) * 100 : 0;
    const holidayBased = matches[0].basis.includes('추석') || matches[0].basis.includes('설');
    paintComment('seasonComment', [
      { k: '매칭 기준', v: `${matches[0].basis}으로 이전 연도 <b>${matches.length}건</b>을 찾았습니다.` },
      {
        k: '가입률',
        v: `${fmt.pct(base.rate)} → 전년 동기 평균 ${fmt.pct(refRate)} 대비 <b>${diff >= 0 ? '+' : ''}${diff.toFixed(1)}%</b>`,
      },
      holidayBased && {
        k: '보정',
        v: '명절은 해마다 날짜가 달라 달(月) 대신 명절 기준으로 맞췄습니다.',
      },
    ]);
  }

  /* ---------- 이벤트 데이 커브 ---------- */
  function renderCurve() {
    const base = currentBase();
    const scope = el('curveScope').value;
    const series = el('curveSeries').value;
    const pool =
      scope === 'similar'
        ? comparisonSet(base).slice(0, 4)
        : BTV.doneEvents().filter((e) => e.type === base.type && e.id !== base.id).slice(-4);
    const list = [base, ...pool].filter((e) => BTV.dayCurve(e.id).length);

    if (!list.length) {
      if (Charts.registry.curveChart) Charts.registry.curveChart.destroy();
      delete Charts.registry.curveChart;
      paintComment('curveComment', [{ k: '계산 불가', v: '일자별 기여도가 있는 이벤트가 없습니다.', warn: true }]);
      return;
    }

    const maxDay = Math.max(...list.map((e) => BTV.dayCurve(e.id).length));
    const labels = Array.from({ length: maxDay }, (_, i) => `${i + 1}일차`);
    const datasets = list.map((e, i) => {
      const color = Charts.EVENT_COLORS[i % Charts.EVENT_COLORS.length];
      const curve = BTV.dayCurve(e.id);
      return {
        label: e.name.replace(/^\d+년 /, ''),
        data: labels.map((_, idx) => (curve[idx] ? Math.round(curve[idx][series]) : null)),
        borderColor: color,
        backgroundColor: `${color}1a`,
        borderWidth: i === 0 ? 2.5 : 1.5,
        borderDash: i === 0 ? [] : [5, 3],
        tension: 0.3,
        pointRadius: i === 0 ? 3 : 2,
        fill: i === 0,
        hideLabels: true,
      };
    });

    Charts.render('curveChart', {
      type: 'line',
      data: { labels, datasets },
      options: {
        interaction: { mode: 'index', intersect: false },
        plugins: { legend: { position: 'bottom' } },
        scales: {
          y: { beginAtZero: true, title: { display: true, text: '일 기여 가입자' }, grid: { color: Charts.COLOR.grid } },
          x: { grid: { display: false } },
        },
      },
    });

    // 초반 집중형인지 끝까지 유지형인지 앞/뒤 절반 비중으로 판정
    const curve = BTV.dayCurve(base.id);
    const approx = curve.length && curve[0].approx;
    const half = Math.ceil(curve.length / 2);
    const front = curve.slice(0, half).reduce((s, r) => s + r[series], 0);
    const back = curve.slice(half).reduce((s, r) => s + r[series], 0);
    const frontShare = front + back ? front / (front + back) : 0;
    const peakDay = curve.reduce((best, r, i) => (r[series] > curve[best][series] ? i : best), 0) + 1;

    paintComment('curveComment', [
      { k: '기준 이벤트', v: `<b>${base.name}</b> · ${curve.length}일 진행` },
      { k: '피크', v: `<b>${peakDay}일차</b>에 가장 많이 유입됐습니다.` },
      {
        k: '유입 형태',
        v:
          frontShare >= 0.62
            ? `앞 절반에 <b>${fmt.pct(frontShare, 1)}</b>가 몰린 <b>초반 집중형</b>입니다. 기간을 늘려도 추가 성과는 제한적일 수 있습니다.`
            : frontShare <= 0.45
              ? `뒤 절반에 <b>${fmt.pct(1 - frontShare, 1)}</b>가 발생한 <b>후반 상승형</b>입니다. 기간을 늘리면 더 받을 여지가 있습니다.`
              : `앞뒤가 <b>${fmt.pct(frontShare, 1)} / ${fmt.pct(1 - frontShare, 1)}</b>로 고르게 유지되는 형태입니다.`,
      },
      approx && {
        k: '계산 방식',
        v: '이벤트 기간의 일자별 실적을 그대로 그린 값입니다. 기간이 겹친 이벤트가 있으면 서로 분리되지 않습니다.',
      },
    ]);
  }

  /* ---------- 예산 효율 · CAC ---------- */
  function renderCac() {
    const base = currentBase();
    const list = BTV.doneEvents().filter((e) => e.budgetPerHead);
    const targetCac = Store.targetCac();
    el('targetCac').value = targetCac;

    const avgCac = list.length ? list.reduce((s, e) => s + e.budgetPerHead, 0) / list.length : null;
    const per10m = (e) => (e.actualBudget ? e.signups / (e.actualBudget / 10000000) : null);
    const baseCac = base.budgetPerHead;
    const overCac = baseCac && targetCac ? ((baseCac - targetCac) / targetCac) * 100 : null;

    el('cacCards').innerHTML = `
      <div class="kpi">
        <div class="label">기준 이벤트 CAC</div>
        <div class="value">${baseCac ? fmt.won(baseCac) : '-'}</div>
        <div class="sub ${overCac == null ? '' : overCac <= 0 ? 'good' : 'warn'}">${
          overCac == null ? '예산 없음' : `목표 ${fmt.won(targetCac)} 대비 ${overCac >= 0 ? '+' : ''}${overCac.toFixed(1)}%`
        }</div>
      </div>
      <div class="kpi">
        <div class="label">전체 평균 CAC</div>
        <div class="value">${avgCac ? fmt.won(avgCac) : '-'}</div>
        <div class="sub">예산 집행 이벤트 ${list.length}건 기준</div>
      </div>
      <div class="kpi">
        <div class="label">예산 1천만원당 가입자</div>
        <div class="value">${per10m(base) ? fmt.num(per10m(base)) : '-'}</div>
        <div class="sub">전체 평균 ${fmt.num(list.length ? list.reduce((s, e) => s + per10m(e), 0) / list.length : 0)}명</div>
      </div>
      <div class="kpi">
        <div class="label">목표 CAC 이내 비율</div>
        <div class="value">${fmt.pct(list.length ? list.filter((e) => e.budgetPerHead <= targetCac).length / list.length : 0, 0)}</div>
        <div class="sub">${list.filter((e) => e.budgetPerHead <= targetCac).length} / ${list.length}건</div>
      </div>`;

    // 할인율 구간별 CAC와 가입률을 같이 봐야 "몇 %부터 남는 게 없는지"가 보인다
    const byDiscount = [...new Set(list.map((e) => e.discountRate))]
      .sort((a, b) => a - b)
      .map((rate) => {
        const subset = list.filter((e) => e.discountRate === rate);
        return {
          rate,
          n: subset.length,
          cac: subset.reduce((s, e) => s + e.budgetPerHead, 0) / subset.length,
          signupRate: subset.reduce((s, e) => s + e.rate, 0) / subset.length,
          per10m: subset.reduce((s, e) => s + per10m(e), 0) / subset.length,
        };
      });

    Charts.render('cacChart', {
      type: 'line',
      data: {
        labels: byDiscount.map((r) => `${r.rate}%`),
        datasets: [
          {
            label: '평균 CAC (원)',
            data: byDiscount.map((r) => Math.round(r.cac)),
            borderColor: '#d94f3d',
            backgroundColor: 'rgba(217,79,61,.1)',
            tension: 0.3,
            fill: true,
            yAxisID: 'y',
            hideLabels: true,
          },
          {
            label: '평균 가입률 (%)',
            data: byDiscount.map((r) => +(r.signupRate * 100).toFixed(2)),
            borderColor: '#0d5bd1',
            tension: 0.3,
            yAxisID: 'y1',
            hideLabels: true,
          },
          {
            label: `목표 CAC ${fmt.won(targetCac)}`,
            data: byDiscount.map(() => targetCac),
            borderColor: '#6b7688',
            borderDash: [4, 4],
            pointRadius: 0,
            borderWidth: 1.5,
            yAxisID: 'y',
            hideLabels: true,
          },
        ],
      },
      options: {
        plugins: { legend: { position: 'bottom' } },
        scales: {
          y: { beginAtZero: true, title: { display: true, text: 'CAC (원)' }, grid: { color: Charts.COLOR.grid } },
          y1: { beginAtZero: true, position: 'right', grid: { drawOnChartArea: false }, title: { display: true, text: '가입률 (%)' } },
          x: { grid: { display: false } },
        },
      },
    });

    el('cacTable').innerHTML = `
      <thead><tr>
        <th class="left">할인율</th><th>건수</th><th>평균 CAC</th><th>목표 대비</th>
        <th>평균 가입률</th><th>예산 1천만원당 가입자</th>
      </tr></thead>
      <tbody>${byDiscount
        .map((r) => {
          const over = ((r.cac - targetCac) / targetCac) * 100;
          return `<tr>
        <td class="left">${r.rate}%</td>
        <td class="num">${r.n}</td>
        <td class="num">${fmt.won(r.cac)}</td>
        <td class="num"><span class="delta ${over <= 0 ? 'up' : 'down'}">${over >= 0 ? '+' : ''}${over.toFixed(1)}%</span></td>
        <td class="num">${fmt.pct(r.signupRate)}</td>
        <td class="num">${fmt.num(r.per10m)}</td>
      </tr>`;
        })
        .join('')}</tbody>`;

    // 할인율이 오른다고 CAC가 단조 증가하진 않으므로, 임계점 대신 구간을 나눠 보여준다
    const within = byDiscount.filter((r) => r.cac <= targetCac);
    const over = byDiscount.filter((r) => r.cac > targetCac);
    const bestEff = byDiscount.slice().sort((a, b) => b.per10m - a.per10m)[0];
    paintComment('cacComment', [
      { k: '목표 CAC', v: `<b>${fmt.won(targetCac)}</b> 기준 · 전체 평균 ${avgCac ? fmt.won(avgCac) : '-'}` },
      bestEff && {
        k: '예산 효율 최고',
        v: `할인 <b>${bestEff.rate}%</b> 구간 — 예산 1천만원당 ${fmt.num(bestEff.per10m)}명, 평균 CAC ${fmt.won(bestEff.cac)}`,
      },
      {
        k: '목표 이내 구간',
        v: within.length
          ? `할인 <b>${within.map((r) => `${r.rate}%`).join(', ')}</b> (평균 CAC ${fmt.won(within.reduce((s, r) => s + r.cac, 0) / within.length)})`
          : '없음 — 모든 할인율 구간의 평균 CAC가 목표를 넘습니다.',
        warn: !within.length,
      },
      over.length && {
        k: '목표 초과 구간',
        v: `할인 ${over.map((r) => `${r.rate}%(${fmt.won(over.find((x) => x.rate === r.rate).cac)})`).join(', ')}`,
        warn: true,
      },
    ]);
  }

  /* ---------- 오퍼 시뮬레이터 ---------- */
  function runSimulator() {
    const spec = {
      id: '__sim__',
      type: el('simType').value,
      discountRate: Number(el('simDiscount').value),
      prizeKind: el('simKind').value,
      priceBand: el('simPrice').value,
    };
    const days = Math.max(1, Number(el('simDays').value) || 7);
    const pool = Math.max(1, Number(el('simPool').value) || 100000);

    let similar = BTV.doneEvents()
      .map((e) => ({ e, score: similarity(spec, e) }))
      .filter((x) => x.score >= 5);
    let loose = false;
    if (similar.length < 3) {
      loose = true;
      similar = BTV.doneEvents()
        .map((e) => ({ e, score: similarity(spec, e) }))
        .filter((x) => x.score >= 3);
    }
    similar = similar.sort((a, b) => b.score - a.score).slice(0, 8).map((x) => x.e);

    if (!similar.length) {
      el('simCards').innerHTML = '';
      paintComment('simComment', [{ k: '추정 불가', v: '조건에 맞는 과거 이벤트가 없습니다.', warn: true }]);
      return;
    }

    const mean = (f) => {
      const vals = similar.map(f).filter((v) => v != null);
      return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null;
    };
    const avgDaily = mean((e) => e.dailyAvg);
    const avgRate = mean((e) => e.rate);
    const avgCac = mean((e) => e.budgetPerHead);
    const poolScale = mean((e) => e.pool) ? pool / mean((e) => e.pool) : 1;

    const expected = Math.round(avgDaily * days * poolScale);
    const expectedRate = expected / pool;
    const expectedBudget = avgCac ? avgCac * expected : null;
    const targetCac = Store.targetCac();

    el('simCards').innerHTML = `
      <div class="kpi">
        <div class="label">예상 가입자</div>
        <div class="value">${fmt.num(expected)}</div>
        <div class="sub">유사 ${similar.length}건 일평균 ${fmt.num(avgDaily)}명 × ${days}일 × 모수 보정</div>
      </div>
      <div class="kpi">
        <div class="label">예상 가입률</div>
        <div class="value">${fmt.pct(expectedRate)}</div>
        <div class="sub">유사 이벤트 평균 ${fmt.pct(avgRate)}</div>
      </div>
      <div class="kpi">
        <div class="label">예상 실예산</div>
        <div class="value">${expectedBudget ? fmt.manwon(expectedBudget) : '-'}</div>
        <div class="sub">${avgCac ? `인당 ${fmt.won(avgCac)} 기준` : '경품 없는 조합'}</div>
      </div>
      <div class="kpi">
        <div class="label">예상 CAC</div>
        <div class="value">${avgCac ? fmt.won(avgCac) : '-'}</div>
        <div class="sub ${avgCac && avgCac <= targetCac ? 'good' : 'warn'}">${
          avgCac ? `목표 ${fmt.won(targetCac)} 대비 ${avgCac <= targetCac ? '이내' : '초과'}` : '예산 미발생'
        }</div>
      </div>`;

    paintComment('simComment', [
      {
        k: '추정 근거',
        v: `${spec.type} · 할인 ${spec.discountRate}%${spec.prizeKind !== '없음' ? ` · ${spec.prizeKind} ${spec.priceBand}` : ''} 조건과 비슷한 과거 <b>${similar.length}건</b> 평균입니다.`,
      },
      { k: '참고 이벤트', v: similar.slice(0, 4).map((e) => e.name.replace(/^\d+년 /, '')).join(', ') },
      loose && { k: '유의사항', v: '완전히 일치하는 조합이 적어 유사 조건까지 넓혀 추정했습니다.', warn: true },
      similar.length < 3 && { k: '유의사항', v: '표본이 3건 미만이라 오차가 클 수 있습니다.', warn: true },
    ]);
  }

  /* ---------- 이벤트 원페이저 ---------- */
  function renderOnePager() {
    const base = currentBase();
    const others = comparisonSet(base);
    const refRate = aggregate(others, 'rate');
    const inc = BTV.incrementality(base);
    const memo = Store.memoOf(base.id);
    const row = (k, v) => `<tr><th class="left">${k}</th><td class="left">${v}</td></tr>`;

    el('onePagerBody').innerHTML = `
      <h3>${base.name}</h3>
      <p class="onepager-sub">${base.startDate} ~ ${base.endDate} (${base.totalDays}일 · 휴일 ${base.restDays}일) · ${base.type}</p>
      <table class="onepager-table">
        ${row('오퍼', `할인 ${base.discountRate}%${base.prizeKind !== '없음' ? ` + ${base.prizeKind} ${base.priceBand} (${base.prizeMethod})` : ''}`)}
        ${row('쿠폰 정책', base.couponPolicy || '-')}
        ${row('모수 / 가입자', `${fmt.num(base.pool)} → <b>${fmt.num(base.signups)}건</b> (가입률 ${fmt.pct(base.rate)})`)}
        ${row('유료 / 쿠폰', `${fmt.num(base.paidSignups)} / ${fmt.num(base.couponSignups)} (오가닉 비율 ${fmt.pct(base.organicRatio, 1)})`)}
        ${row('일평균', `전체 ${fmt.num(base.dailyAvg)} · 휴일 ${fmt.num(base.restAvg)} · 평일 ${fmt.num(base.weekdayAvg)}`)}
        ${base.isRaffle ? row('응모 / 수령', `응모 ${fmt.num(base.entrants)}명 (응모율 ${fmt.pct(base.entryRate)}) · 경쟁률 ${base.competition ? base.competition.toFixed(1) : '-'}:1 · 수령률 ${fmt.pct(base.receiveRate, 1)}`) : ''}
        ${row('예산', `실예산 ${base.actualBudget ? fmt.manwon(base.actualBudget) : '-'} · 인당 ${base.budgetPerHead ? fmt.won(base.budgetPerHead) : '-'}`)}
        ${row('유사 이벤트 대비', refRate ? `가입률 ${fmt.pct(base.rate)} vs ${fmt.pct(refRate)} (${((base.rate - refRate) / refRate * 100).toFixed(1)}%)` : '-')}
        ${inc ? row('증분 효과', `순증분 ${fmt.num(inc.incremental)}건 · 기준선 대비 +${fmt.pct(inc.liftRatio, 1)}${inc.payback != null ? ` · 종료 후 ${inc.tailDays}일 ${(inc.payback * 100).toFixed(1)}%` : ''}`) : ''}
        ${memo ? row('담당자 비고', memo) : ''}
      </table>
      <p class="onepager-foot">B tv+ 성과 분석 대시보드 · 데이터 기준일 ${BTV.LAST_DATA_DAY} · 수치는 더미 데이터</p>`;
    el('onePagerModal').hidden = false;
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
    baseSel.addEventListener('change', renderBaseViews);
    el('compareCount').addEventListener('change', renderBaseViews);
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

    el('pivotTable').addEventListener('click', (e) => {
      const cell = e.target.closest('td.drillable');
      if (!cell) return;
      renderDrill(cell.dataset.row, cell.dataset.col);
    });
    el('pivotDrill').addEventListener('click', (e) => {
      if (e.target.id === 'drillClose') {
        el('pivotDrill').hidden = true;
        return;
      }
      const pick = e.target.dataset.pick;
      if (!pick) return;
      el('baseEvent').value = pick;
      renderBaseViews();
      document.getElementById('compareCards').scrollIntoView({ behavior: 'smooth', block: 'center' });
    });

    BTV.TYPES.forEach((t) => el('simType').insertAdjacentHTML('beforeend', `<option value="${t}">${t}</option>`));
    [...new Set(BTV.doneEvents().map((e) => e.discountRate))]
      .sort((a, b) => a - b)
      .forEach((d) => el('simDiscount').insertAdjacentHTML('beforeend', `<option value="${d}">${d}%</option>`));
    ['없음', ...BTV.PRIZE_KINDS].forEach((k) =>
      el('simKind').insertAdjacentHTML('beforeend', `<option value="${k}">${k}</option>`)
    );
    ['없음', ...BTV.UNIT_PRICES.map((p) => `${p / 10000}만원`)].forEach((p) =>
      el('simPrice').insertAdjacentHTML('beforeend', `<option value="${p}">${p}</option>`)
    );
    el('simType').value = '할인+전원경품';
    el('simDiscount').value = '30';
    el('simKind').value = '상품권';
    el('simPrice').value = '1만원';
    ['simType', 'simDiscount', 'simKind', 'simPrice', 'simDays', 'simPool'].forEach((id) =>
      el(id).addEventListener('change', runSimulator)
    );

    ['curveScope', 'curveSeries'].forEach((id) => el(id).addEventListener('change', renderCurve));
    el('saveCac').addEventListener('click', () => {
      Store.setTargetCac(Math.max(0, Number(el('targetCac').value) || 0));
      renderCac();
      runSimulator();
    });

    el('onePagerOpen').addEventListener('click', renderOnePager);
    el('onePagerClose').addEventListener('click', () => {
      el('onePagerModal').hidden = true;
    });
    el('onePagerModal').addEventListener('click', (e) => {
      if (e.target.id === 'onePagerModal') el('onePagerModal').hidden = true;
    });
    el('onePagerPrint').addEventListener('click', () => window.print());
    el('onePagerCopy').addEventListener('click', async () => {
      const text = el('onePagerBody').innerText;
      try {
        await navigator.clipboard.writeText(text);
        el('onePagerCopy').textContent = '복사됨';
      } catch (err) {
        el('onePagerCopy').textContent = '복사 실패';
      }
      setTimeout(() => {
        el('onePagerCopy').textContent = '복사';
      }, 1500);
    });

    render();
  }

  // 기준 이벤트에 딸린 화면들은 같이 움직인다
  function renderBaseViews() {
    if (!currentBase()) {
      ['compareCards', 'incrementalCards', 'cacCards'].forEach((id) => {
        el(id).innerHTML = '';
      });
      ['compareComment', 'incrementalComment', 'seasonComment', 'curveComment', 'cacComment'].forEach((id) =>
        paintComment(id, [{ k: '데이터 없음', v: '캠페인 CSV를 올리면 분석이 시작됩니다.', warn: true }])
      );
      ['compareTable', 'seasonTable', 'cacTable'].forEach((id) => {
        el(id).innerHTML = '';
      });
      return;
    }
    renderCompare();
    renderIncremental();
    renderSeason();
    renderCurve();
    renderCac();
  }

  function render() {
    renderAllEvents();
    renderBaseViews();
    renderPivot();
    runSimulator();
  }

  global.Compare = { init, render, DIMS, METRICS, aggregate, similarity, comparisonSet };
})(window);
