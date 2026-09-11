(function (global) {
  'use strict';

  const { fmt, util } = BTV;
  const el = (id) => document.getElementById(id);
  let month = BTV.util.monthOf(BTV.LAST_DATA_DAY);
  let summaryText = '';
  let segUi = 'all';
  let segMetric = 'all';
  const segPeriods = new Set(BTV.months.slice(-2)); // 기본값: 전월 + 당월(전일 기준)
  let showAllPeriods = false;

  function monthRange(m) {
    const last = new Date(Number(m.slice(0, 4)), Number(m.slice(5, 7)), 0).getDate();
    return util.eachDay(`${m}-01`, `${m}-${String(last).padStart(2, '0')}`);
  }

  function offerLabel(ev) {
    const parts = [`${ev.discountRate}%`];
    if (ev.prizeKind && ev.prizeKind !== '없음') parts.push(`${ev.prizeKind} ${ev.priceBand}`);
    return parts.join(' · ');
  }

  function statusTag(status) {
    const cls = status === '진행중' ? 'live' : status === '예정' ? 'plan' : 'done';
    return `<span class="tag ${cls}">${status}</span>`;
  }

  /* ---------- KPI ---------- */
  function renderKpis() {
    const s = BTV.monthStats(month);
    const target = Store.targetOf(month);
    const targetTotal = target.paid + target.coupon;
    const progress = targetTotal ? s.total / targetTotal : 0;
    const gap = targetTotal - s.total;
    const remainDays = s.totalDaysInMonth - s.elapsed;
    const needDaily = remainDays > 0 ? Math.max(0, gap) / remainDays : 0;
    const paceCls = progress >= s.elapsedRatio ? 'good' : 'warn';

    el('perfKpis').innerHTML = `
      <div class="kpi">
        <div class="label">유료 신규 (누적)</div>
        <div class="value">${fmt.num(s.paid)}</div>
        <div class="sub">목표 ${fmt.num(target.paid)} · 달성률 ${fmt.pct(target.paid ? s.paid / target.paid : 0, 1)}</div>
        <div class="bar"><span style="width:${Math.min(100, target.paid ? (s.paid / target.paid) * 100 : 0)}%"></span></div>
      </div>
      <div class="kpi">
        <div class="label">쿠폰 가입 (누적)</div>
        <div class="value">${fmt.num(s.coupon)}</div>
        <div class="sub">목표 ${fmt.num(target.coupon)} · 달성률 ${fmt.pct(target.coupon ? s.coupon / target.coupon : 0, 1)}</div>
        <div class="bar"><span style="width:${Math.min(100, target.coupon ? (s.coupon / target.coupon) * 100 : 0)}%;background:var(--coupon)"></span></div>
      </div>
      <div class="kpi">
        <div class="label">목표 대비 진척률</div>
        <div class="value">${fmt.pct(progress, 1)}</div>
        <div class="sub ${paceCls}">기간 경과율 ${fmt.pct(s.elapsedRatio, 1)} 대비 ${progress >= s.elapsedRatio ? '+' : ''}${((progress - s.elapsedRatio) * 100).toFixed(1)}%p</div>
        <div class="bar"><span style="width:${Math.min(100, progress * 100)}%"></span></div>
      </div>
      <div class="kpi">
        <div class="label">잔여 갭</div>
        <div class="value">${gap > 0 ? fmt.num(gap) : '목표 달성'}</div>
        <div class="sub">${remainDays > 0 ? `잔여 ${remainDays}일 · 필요 일평균 ${fmt.num(needDaily)}건` : '집계 완료'}</div>
      </div>
      <div class="kpi">
        <div class="label">일평균 가입자</div>
        <div class="value">${fmt.num(s.dailyAvg)}</div>
        <div class="sub">${s.elapsed}일 집계 · 유료 ${fmt.num(s.paid / s.elapsed)} / 쿠폰 ${fmt.num(s.coupon / s.elapsed)}</div>
      </div>`;
  }

  function renderSignals() {
    const a = BTV.anomaly(month);
    const box = el('perfSignals');
    if (!a || !a.signals.length) {
      box.innerHTML = '';
      return;
    }
    box.innerHTML = a.signals
      .map((s) => `<div class="signal ${s.level}">${s.level === 'warn' ? '⚠' : '✔'} ${s.text}</div>`)
      .join('');
  }

  /* ---------- AI 주간 요약 ---------- */
  function buildSummary() {
    const rows = BTV.dayRows(month);
    if (!rows.length) return { html: '<p>데이터가 없습니다.</p>', text: '' };
    // 월초에는 해당 월 데이터만으로 7일을 채울 수 없어 전체 시계열에서 동일 길이 구간을 잡는다
    const series = BTV.seriesThrough(month);
    const last7 = series.slice(-7);
    const prev7 = series.slice(-14, -7);
    const sum = (list, k) => list.reduce((s, d) => s + d[k], 0);
    const dailyAvg = (list) => (list.length ? (sum(list, 'paid') + sum(list, 'coupon')) / list.length : 0);
    const cur = sum(last7, 'paid') + sum(last7, 'coupon');
    const delta = prev7.length ? (dailyAvg(last7) - dailyAvg(prev7)) / dailyAvg(prev7) : 0;
    const s = BTV.monthStats(month);
    const target = Store.targetOf(month);
    const targetTotal = target.paid + target.coupon;
    const gap = targetTotal - s.total;
    const remainDays = s.totalDaysInMonth - s.elapsed;

    const inWeek = BTV.eventsOfMonth(month).filter(
      (e) => e.signups != null && e.endDate >= last7[0].date && e.startDate <= last7[last7.length - 1].date
    );
    const best = inWeek.slice().sort((a, b) => b.rate - a.rate)[0];
    const planned = BTV.allEvents()
      .filter((e) => e.status === '예정')
      .slice(0, 2);

    const lines = [
      `최근 7일 가입자 <b>${fmt.num(cur)}건</b> (유료 ${fmt.num(sum(last7, 'paid'))} / 쿠폰 ${fmt.num(sum(last7, 'coupon'))}), 일평균 ${fmt.num(dailyAvg(last7))}건으로 직전 7일 대비 <b>${prev7.length ? (delta * 100).toFixed(1) + '%' : '-'}</b> ${delta >= 0 ? '증가' : '감소'}`,
      `${util.monthLabel(month)} 누적 <b>${fmt.num(s.total)}건</b>, 목표 ${fmt.num(targetTotal)} 대비 진척률 <b>${fmt.pct(targetTotal ? s.total / targetTotal : 0, 1)}</b>${remainDays > 0 ? ` · 잔여 ${remainDays}일간 일평균 <b>${fmt.num(Math.max(0, gap) / remainDays)}건</b> 필요` : ''}`,
    ];
    if (best) {
      lines.push(
        `기간 내 최고 성과는 <b>${best.name}</b> (${best.type}, ${offerLabel(best)}) — 가입률 <b>${fmt.pct(best.rate)}</b>, 일평균 ${fmt.num(best.dailyAvg)}건`
      );
    }
    if (planned.length) {
      lines.push(
        `예정 이벤트: ${planned.map((p) => `<b>${p.name}</b>(${util.monthOf(p.startDate).slice(5)}/${p.startDate.slice(8)}~, ${offerLabel(p)})`).join(', ')}`
      );
    }
    const html = `<ul>${lines.map((l) => `<li>${l}</li>`).join('')}</ul>`;
    return { html, text: lines.map((l) => l.replace(/<[^>]+>/g, '')).join(' / ') };
  }

  function renderSummary() {
    const { html, text } = buildSummary();
    summaryText = text;
    el('weeklySummary').innerHTML = html;
  }

  /* ---------- 월간 그래프 ---------- */
  function renderChart() {
    const dates = monthRange(month);
    const byDate = new Map(BTV.dayRows(month).map((d) => [d.date, d]));
    const labels = dates.map((d) => fmt.date(d));
    const paid = dates.map((d) => (byDate.has(d) ? byDate.get(d).paid : null));
    const coupon = dates.map((d) => (byDate.has(d) ? byDate.get(d).coupon : null));

    const bands = BTV.eventsOfMonth(month)
      .map((ev) => {
        const from = dates.indexOf(ev.startDate < dates[0] ? dates[0] : ev.startDate);
        const to = dates.indexOf(ev.endDate > dates[dates.length - 1] ? dates[dates.length - 1] : ev.endDate);
        if (from < 0 || to < 0) return null;
        const shortName = ev.name.length > 13 ? `${ev.name.slice(0, 12)}…` : ev.name;
        return { from, to, planned: ev.status === '예정', label: `${shortName} ${offerLabel(ev)}` };
      })
      .filter(Boolean)
      .sort((a, b) => a.from - b.from);

    Charts.render(
      'monthChart',
      {
        type: 'line',
        data: {
          labels,
          datasets: [
            {
              label: '유료 신규',
              data: paid,
              borderColor: Charts.COLOR.paid,
              backgroundColor: 'rgba(13,91,209,.08)',
              tension: 0.3,
              spanGaps: false,
              pointRadius: 2.5,
              fill: true,
            },
            {
              label: '쿠폰 가입',
              data: coupon,
              borderColor: Charts.COLOR.coupon,
              backgroundColor: 'rgba(18,165,148,.08)',
              tension: 0.3,
              spanGaps: false,
              pointRadius: 2.5,
              fill: true,
            },
          ],
        },
        options: {
          layout: { padding: { top: Math.min(90, 16 + bands.length * 8) } },
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: { position: 'bottom' },
            tooltip: {
              callbacks: {
                afterBody(items) {
                  const date = dates[items[0].dataIndex];
                  const evs = BTV.eventsOfMonth(month).filter((e) => e.startDate <= date && date <= e.endDate);
                  if (!evs.length) return '';
                  return evs.map((e) => `· ${e.name} (${e.type}, ${offerLabel(e)})`);
                },
              },
            },
          },
          scales: {
            y: { beginAtZero: true, grid: { color: Charts.COLOR.grid } },
            x: { grid: { display: false } },
          },
        },
      },
      { $showLabels: el('showLabels').checked, $eventBands: bands }
    );
  }

  /* ---------- 표 ---------- */
  function renderPlanTable() {
    const list = BTV.eventsOfMonth(month);
    el('eventPlanTable').innerHTML = `
      <thead><tr>
        <th class="left">기간</th><th class="left">이벤트명</th><th class="left">타입</th>
        <th>할인율</th><th class="left">경품 종류</th><th>경품 단가</th><th>모수</th><th class="left">상태</th>
      </tr></thead>
      <tbody>${
        list.length
          ? list
              .map(
                (e) => `<tr>
        <td class="left">${fmt.date(e.startDate)} ~ ${fmt.date(e.endDate)}</td>
        <td class="left">${e.name}</td>
        <td class="left">${e.type}</td>
        <td class="num">${e.discountRate}%</td>
        <td class="left">${e.prizeKind}</td>
        <td class="num">${e.prizeUnitPrice ? fmt.manwon(e.prizeUnitPrice) : '-'}</td>
        <td class="num">${fmt.num(e.pool)}</td>
        <td class="left">${statusTag(e.status)}</td>
      </tr>`
              )
              .join('')
          : '<tr><td colspan="8" class="left">해당 월 이벤트가 없습니다.</td></tr>'
      }</tbody>`;
  }

  function renderCampaignTable() {
    const list = BTV.eventsOfMonth(month).filter((e) => e.signups != null);
    const totals = list.reduce(
      (acc, e) => {
        acc.pool += e.pool;
        acc.signups += e.signups;
        return acc;
      },
      { pool: 0, signups: 0 }
    );
    el('campaignTable').innerHTML = `
      <thead><tr>
        <th class="left">구분</th><th class="left">이벤트명</th><th class="left">일정</th>
        <th class="left">타입</th><th>할인율</th>
        <th>모수</th><th>가입자 수</th><th>가입률</th>
        <th>일평균</th><th>주말 일평균</th><th>평일 일평균</th><th class="left">비고</th>
      </tr></thead>
      <tbody>${
        list.length
          ? list
              .map(
                (e) => `<tr>
        <td class="left"><span class="tag">${e.purpose || '-'}</span></td>
        <td class="left">${e.name}${e.inFlight ? ` <span class="tag live">진행중 ${e.elapsedDays}/${e.totalDays}일</span>` : ''}</td>
        <td class="left">${fmt.date(e.startDate)} ~ ${fmt.date(e.endDate)} (${e.totalDays}일)</td>
        <td class="left">${e.type}</td>
        <td class="num">${e.discountRate}%</td>
        <td class="num">${fmt.num(e.pool)}</td>
        <td class="num">${fmt.num(e.signups)}</td>
        <td class="num">${fmt.pct(e.rate)}</td>
        <td class="num">${fmt.num(e.dailyAvg)}</td>
        <td class="num">${fmt.num(e.weekendAvg)}</td>
        <td class="num">${fmt.num(e.weekdayAvg)}</td>
        <td class="left"><input class="memo-input" data-memo="${e.id}" value="${Store.memoOf(e.id).replace(/"/g, '&quot;')}" placeholder="비고 입력"></td>
      </tr>`
              )
              .join('')
          : '<tr><td colspan="12" class="left">집계된 캠페인 실적이 없습니다.</td></tr>'
      }</tbody>
      ${
        list.length
          ? `<tfoot><tr>
        <td class="left">합계 / 평균</td><td></td><td></td><td></td><td></td>
        <td class="num">${fmt.num(totals.pool)}</td>
        <td class="num">${fmt.num(totals.signups)}</td>
        <td class="num">${fmt.pct(totals.signups / totals.pool)}</td>
        <td class="num">${fmt.num(list.reduce((s, e) => s + e.dailyAvg, 0) / list.length)}</td>
        <td class="num">${fmt.num(list.reduce((s, e) => s + (e.weekendAvg || 0), 0) / list.length)}</td>
        <td class="num">${fmt.num(list.reduce((s, e) => s + (e.weekdayAvg || 0), 0) / list.length)}</td>
        <td></td>
      </tr></tfoot>`
          : ''
      }`;
  }

  const SEG_METRICS = {
    allocated: { label: '할당', fmt: (v) => fmt.num(v) },
    used: { label: '사용', fmt: (v) => fmt.num(v) },
    rate: { label: '가입률', fmt: (v) => fmt.pct(v) },
    dailyAvg: { label: '일평균 가입자', fmt: (v) => fmt.num(v) },
    dailyAvgRate: { label: '일평균 가입률', fmt: (v) => fmt.pct(v, 3) },
  };

  const periodLabel = (m) =>
    m === util.monthOf(BTV.LAST_DATA_DAY) ? BTV.LAST_DATA_DAY : `${m.slice(2, 4)}.${m.slice(5, 7)}`;

  function segValue(rows, seg, metric) {
    if (seg !== '합계') {
      const row = rows.find((r) => r.segment === seg);
      return row ? row[metric] : null;
    }
    const allocated = rows.reduce((s, r) => s + r.allocated, 0);
    const used = rows.reduce((s, r) => s + r.used, 0);
    const days = rows.length ? rows[0].days : 1;
    if (metric === 'allocated') return allocated;
    if (metric === 'used') return used;
    if (metric === 'rate') return allocated ? used / allocated : 0;
    if (metric === 'dailyAvgRate') return allocated && days ? used / allocated / days : 0;
    return used / days;
  }

  function renderPeriodChips() {
    // 3개년치면 칩이 30개가 넘으므로 최근 12개월 + 선택한 기간만 먼저 보여준다
    const recent = BTV.months.slice(-12);
    const visible = showAllPeriods ? BTV.months : BTV.months.filter((m) => recent.includes(m) || segPeriods.has(m));
    const hidden = BTV.months.length - visible.length;
    el('segPeriods').innerHTML =
      visible
        .map(
          (m) =>
            `<button type="button" class="chip ${segPeriods.has(m) ? 'on' : ''}" data-period="${m}">${periodLabel(m)}</button>`
        )
        .join('') +
      (hidden > 0 || showAllPeriods
        ? `<button type="button" class="chip toggle" data-toggle="1">${showAllPeriods ? '최근 12개월만 보기' : `이전 기간 더 보기 (+${hidden})`}</button>`
        : '');
  }

  // 사용·가입률은 기간이 길수록 누적되므로, 경과일이 다른 기간끼리는 일 단위로 환산해 비교한다
  const isCumulative = (metric) => metric === 'used' || metric === 'rate';

  function renderSegTable() {
    renderPeriodChips();
    const periods = BTV.months.filter((m) => segPeriods.has(m));
    const uiGroups = segUi === 'all' ? ['전체', ...BTV.UI_GROUPS] : [segUi];
    const metrics = segMetric === 'all' ? Object.keys(SEG_METRICS) : [segMetric];
    const segRows = ['합계', ...BTV.SEG_LIST];
    const showDelta = periods.length >= 2;

    if (!periods.length) {
      el('segTable').innerHTML = `<tbody><tr><td class="left">비교할 기간을 1개 이상 선택하세요.</td></tr></tbody>`;
      return;
    }

    const stats = {};
    uiGroups.forEach((ui) => {
      stats[ui] = {};
      periods.forEach((m) => {
        stats[ui][m] = BTV.segStats(m, ui);
      });
    });
    const daysOf = (rows) => (rows.length ? rows[0].days : 1);

    const metricCells = (ui, period, seg) =>
      metrics
        .map((metric, i) => {
          const value = segValue(stats[ui][period], seg, metric);
          return `<td class="num${i === 0 ? ' group-start' : ''}">${SEG_METRICS[metric].fmt(value)}</td>`;
        })
        .join('');

    // SEG별 증감을 한눈에 비교할 수 있도록, 컬럼 내 최대 증감폭 대비 막대 길이를 미리 구한다
    const deltaOf = {};
    const maxAbs = {};
    if (showDelta) {
      const prevPeriod = periods[periods.length - 2];
      const curPeriod = periods[periods.length - 1];
      uiGroups.forEach((ui) => {
        const prevDays = daysOf(stats[ui][prevPeriod]);
        const curDays = daysOf(stats[ui][curPeriod]);
        segRows.forEach((seg) => {
          metrics.forEach((metric) => {
            let a = segValue(stats[ui][prevPeriod], seg, metric);
            let b = segValue(stats[ui][curPeriod], seg, metric);
            let diff = null;
            if (a != null && b != null) {
              if (isCumulative(metric)) {
                a /= prevDays;
                b /= curDays;
              }
              if (a) diff = ((b - a) / a) * 100;
            }
            deltaOf[`${ui}|${seg}|${metric}`] = diff;
            if (diff != null && seg !== '합계') {
              maxAbs[metric] = Math.max(maxAbs[metric] || 0, Math.abs(diff));
            }
          });
        });
      });
    }

    const deltaCells = (ui, seg) =>
      metrics
        .map((metric, i) => {
          const edge = i === 0 ? ' group-start' : '';
          const diff = deltaOf[`${ui}|${seg}|${metric}`];
          if (diff == null) return `<td class="num${edge}">-</td>`;
          const width = maxAbs[metric] ? Math.min(100, Math.round((Math.abs(diff) / maxAbs[metric]) * 100)) : 0;
          const dir = diff >= 0 ? 'up' : 'down';
          return `<td class="num delta-cell ${dir}${edge}" style="--bar:${width}%">
            <span class="delta-val">${diff >= 0 ? '▲' : '▼'} ${Math.abs(diff).toFixed(1)}%</span>
          </td>`;
        })
        .join('');

    const body = uiGroups
      .map((ui) =>
        segRows
          .map(
            (seg, i) => `<tr class="${seg === '합계' ? 'total-row' : ''}">
        ${i === 0 ? `<td class="left ui-cell" rowspan="${segRows.length}">${ui}</td>` : ''}
        <td class="left">${seg}</td>
        ${periods.map((m) => metricCells(ui, m, seg)).join('')}
        ${showDelta ? deltaCells(ui, seg) : ''}
      </tr>`
          )
          .join('')
      )
      .join('');

    el('segTable').innerHTML = `
      <thead>
        <tr>
          <th class="left" colspan="2">구분</th>
          ${periods
            .map((m) => {
              const isCurrent = m === util.monthOf(BTV.LAST_DATA_DAY);
              const days = daysOf(stats[uiGroups[0]][m]);
              return `<th colspan="${metrics.length}" class="group-start">${periodLabel(m)}<span class="hint"> ${isCurrent ? '전일 기준 ' : ''}${days}일</span></th>`;
            })
            .join('')}
          ${showDelta ? `<th colspan="${metrics.length}" class="group-start">직전 기간 대비<span class="hint"> 경과일 환산</span></th>` : ''}
        </tr>
        <tr>
          <th class="left">UI</th><th class="left">SEG</th>
          ${periods
            .map(() => metrics.map((m, i) => `<th class="${i === 0 ? 'group-start' : ''}">${SEG_METRICS[m].label}</th>`).join(''))
            .join('')}
          ${showDelta ? metrics.map((m, i) => `<th class="${i === 0 ? 'group-start' : ''}">${SEG_METRICS[m].label}</th>`).join('') : ''}
        </tr>
      </thead>
      <tbody>${body}</tbody>`;
  }

  function renderComments() {
    const list = Store.commentsOf(month);
    el('commentList').innerHTML = list.length
      ? list
          .map(
            (c) => `<li>
        <div class="body">
          <span class="who">${c.author}</span><span class="when">${new Date(c.at).toLocaleString('ko-KR')}</span>
          <p>${c.text.replace(/</g, '&lt;')}</p>
        </div>
        <button class="icon-btn" data-del="${c.id}" title="삭제">×</button>
      </li>`
          )
          .join('')
      : '<li class="empty">등록된 코멘트가 없습니다.</li>';
  }

  function render() {
    el('targetPaid').value = Store.targetOf(month).paid;
    el('targetCoupon').value = Store.targetOf(month).coupon;
    renderKpis();
    renderSignals();
    renderSummary();
    renderChart();
    renderPlanTable();
    renderCampaignTable();
    renderSegTable();
    renderComments();
  }

  function init() {
    const monthSel = el('perfMonth');
    BTV.months.forEach((m) => {
      monthSel.insertAdjacentHTML('beforeend', `<option value="${m}">${m.slice(0, 4)}년 ${util.monthLabel(m)}</option>`);
    });
    monthSel.value = month;
    el('segUi').insertAdjacentHTML('beforeend', '<option value="all">모두 표시 (전체 / 541 이상 / 540 이하)</option>');
    ['전체', ...BTV.UI_GROUPS].forEach((u) =>
      el('segUi').insertAdjacentHTML('beforeend', `<option value="${u}">${u}만</option>`)
    );
    el('segMetric').insertAdjacentHTML('beforeend', '<option value="all">모두 표시 (할당·사용·가입률·일평균)</option>');
    Object.entries(SEG_METRICS).forEach(([key, spec]) =>
      el('segMetric').insertAdjacentHTML('beforeend', `<option value="${key}">${spec.label}만</option>`)
    );
    el('segUi').value = segUi;
    el('segMetric').value = segMetric;

    monthSel.addEventListener('change', () => {
      month = monthSel.value;
      render();
    });
    el('showLabels').addEventListener('change', renderChart);
    el('segUi').addEventListener('change', (e) => {
      segUi = e.target.value;
      renderSegTable();
    });
    el('segMetric').addEventListener('change', (e) => {
      segMetric = e.target.value;
      renderSegTable();
    });
    el('segPeriods').addEventListener('click', (e) => {
      if (e.target.dataset.toggle) {
        showAllPeriods = !showAllPeriods;
        renderSegTable();
        return;
      }
      const period = e.target.dataset.period;
      if (!period) return;
      if (segPeriods.has(period)) segPeriods.delete(period);
      else segPeriods.add(period);
      renderSegTable();
    });
    el('campaignTable').addEventListener('change', (e) => {
      const id = e.target.dataset.memo;
      if (id) Store.setMemo(id, e.target.value.trim());
    });
    el('saveTarget').addEventListener('click', () => {
      Store.setTarget(month, Number(el('targetPaid').value) || 0, Number(el('targetCoupon').value) || 0);
      render();
    });
    el('saveSummary').addEventListener('click', () => {
      const ok = Store.addInsight(summaryText, [util.monthLabel(month), '주간요약'], 'summary');
      el('saveSummary').textContent = ok ? '저장됨' : '이미 저장됨';
      setTimeout(() => {
        el('saveSummary').textContent = '인사이트로 저장';
      }, 1500);
    });
    el('commentForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const text = el('commentText').value.trim();
      if (!text) return;
      Store.addComment(month, text);
      el('commentText').value = '';
      renderComments();
    });
    el('commentList').addEventListener('click', (e) => {
      const id = e.target.dataset.del;
      if (!id) return;
      Store.removeComment(id);
      renderComments();
    });

    render();
  }

  global.Perf = { init, render, get month() { return month; } };
})(window);
