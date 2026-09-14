(function (global) {
  'use strict';

  const { fmt, util } = BTV;
  const el = (id) => document.getElementById(id);
  let month = BTV.util.monthOf(BTV.LAST_DATA_DAY);
  let segUi = 'all';
  let segMetric = 'all';
  const segPeriods = new Set(BTV.months.slice(-2)); // 기본값: 전월 + 당월(전일 기준)
  let showAllPeriods = false;
  const chartMonths = new Set([BTV.util.monthOf(BTV.LAST_DATA_DAY)]);
  let showAllChartMonths = false;
  let chartMode = 'timeline';

  function monthRange(m) {
    const last = new Date(Number(m.slice(0, 4)), Number(m.slice(5, 7)), 0).getDate();
    return util.eachDay(`${m}-01`, `${m}-${String(last).padStart(2, '0')}`);
  }

  function offerLabel(ev) {
    const parts = [`${ev.discountRate}%`];
    if (ev.prizeKind && ev.prizeKind !== '없음') parts.push(`${ev.prizeKind} ${ev.priceBand}`);
    return parts.join(' · ');
  }

  const eventColor = (i) => Charts.EVENT_COLORS[i % Charts.EVENT_COLORS.length];

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

    // 목표를 입력하지 않은 달(주로 과거 월)은 달성률·갭을 계산하지 않는다
    const hasTarget = targetTotal > 0;
    el('perfKpis').innerHTML = `
      <div class="kpi">
        <div class="label">유료 신규 (누적)</div>
        <div class="value">${fmt.num(s.paid)}</div>
        <div class="sub">${hasTarget ? `목표 ${fmt.num(target.paid)} · 달성률 ${fmt.pct(target.paid ? s.paid / target.paid : 0, 1)}` : '목표 미입력'}</div>
        <div class="bar"><span style="width:${Math.min(100, target.paid ? (s.paid / target.paid) * 100 : 0)}%"></span></div>
      </div>
      <div class="kpi">
        <div class="label">쿠폰 가입 (누적)</div>
        <div class="value">${fmt.num(s.coupon)}</div>
        <div class="sub">${hasTarget ? `목표 ${fmt.num(target.coupon)} · 달성률 ${fmt.pct(target.coupon ? s.coupon / target.coupon : 0, 1)}` : '목표 미입력'}</div>
        <div class="bar"><span style="width:${Math.min(100, target.coupon ? (s.coupon / target.coupon) * 100 : 0)}%;background:var(--coupon)"></span></div>
      </div>
      <div class="kpi">
        <div class="label">목표 대비 진척률</div>
        <div class="value">${hasTarget ? fmt.pct(progress, 1) : '-'}</div>
        <div class="sub ${hasTarget ? paceCls : ''}">${
          hasTarget
            ? `기간 경과율 ${fmt.pct(s.elapsedRatio, 1)} 대비 ${progress >= s.elapsedRatio ? '+' : ''}${((progress - s.elapsedRatio) * 100).toFixed(1)}%p`
            : '위에서 월 목표를 입력하면 계산됩니다'
        }</div>
        <div class="bar"><span style="width:${hasTarget ? Math.min(100, progress * 100) : 0}%"></span></div>
      </div>
      <div class="kpi">
        <div class="label">잔여 갭</div>
        <div class="value">${!hasTarget ? '-' : gap > 0 ? fmt.num(gap) : '목표 달성'}</div>
        <div class="sub">${!hasTarget ? '목표 미입력' : remainDays > 0 ? `잔여 ${remainDays}일 · 필요 일평균 ${fmt.num(needDaily)}건` : '집계 완료'}</div>
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
    el('weeklySummary').innerHTML = buildSummary().html;
  }

  /* ---------- 월간 그래프 ---------- */
  function renderChart() {
    el('chartMonths').innerHTML = chipMarkup(chartMonths, showAllChartMonths);
    el('overlaySeriesWrap').hidden = chartMode !== 'overlay';
    const months = BTV.months.filter((m) => chartMonths.has(m));

    if (!months.length) {
      el('chartHint').textContent = '비교할 월을 1개 이상 선택하세요.';
      if (Charts.registry.monthChart) Charts.registry.monthChart.destroy();
      delete Charts.registry.monthChart;
      return;
    }
    if (chartMode === 'overlay' && months.length > 1) renderOverlayChart(months);
    else renderTimelineChart(months);
  }

  // 여러 달을 이어 붙여 하나의 연속된 추이로 본다 (월초에 전월 흐름까지 같이 보는 용도)
  function renderTimelineChart(months) {
    const dates = months.flatMap((m) => monthRange(m));
    const byDate = new Map(BTV.days.map((d) => [d.date, d]));
    // 날짜 아래 요일을 같이 찍고, 휴일은 축 글자색으로도 구분한다
    const dayTypes = dates.map((d) => (util.holidayOf(d) ? 'holiday' : util.isWeekend(d) ? 'weekend' : 'weekday'));
    const labels = dates.map((d) => [fmt.date(d), util.dayName(d)]);
    const tickColor = (ctx) => {
      const type = dayTypes[ctx.index];
      if (type === 'holiday') return '#d94f3d';
      return util.dayName(dates[ctx.index]) === '토' ? '#0d5bd1' : type === 'weekend' ? '#d94f3d' : '#6b7688';
    };
    const paid = dates.map((d) => (byDate.has(d) ? byDate.get(d).paid : null));
    const coupon = dates.map((d) => (byDate.has(d) ? byDate.get(d).coupon : null));

    const bands = months
      .flatMap((m) => BTV.eventsOfMonth(m))
      .filter((ev, i, arr) => arr.findIndex((x) => x.id === ev.id) === i)
      // 끊어진 구간은 리본도 따로 그린다 (같은 번호·같은 색)
      .flatMap((ev, i) => {
        const color = eventColor(i);
        return BTV.periodsOf(ev).map((p) => {
          const from = dates.indexOf(p.startDate < dates[0] ? dates[0] : p.startDate);
          const to = dates.indexOf(p.endDate > dates[dates.length - 1] ? dates[dates.length - 1] : p.endDate);
          if (from < 0 || to < 0) return null;
          return {
            from,
            to,
            no: i + 1,
            color,
            tint: `${color}12`,
            planned: ev.status === '예정',
            label: `${ev.name.replace(/^\d+년 \d+월 /, '')} · ${offerLabel(ev)}`,
          };
        });
      })
      .filter(Boolean);

    // 기간이 겹치는 이벤트는 위로 쌓아 리본이 서로 가리지 않게 한다
    const lanes = [];
    bands
      .slice()
      .sort((a, b) => a.from - b.from)
      .forEach((b) => {
        let lane = 0;
        while (lanes[lane] != null && lanes[lane] >= b.from) lane += 1;
        lanes[lane] = b.to;
        b.level = lane;
      });

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
          layout: { padding: { top: 18 + lanes.length * Charts.RIBBON_GAP } },
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: { position: 'bottom' },
            tooltip: {
              callbacks: {
                title(items) {
                  const date = dates[items[0].dataIndex];
                  const holiday = util.holidayOf(date);
                  return `${date} (${util.dayName(date)})${holiday ? ` · ${holiday}` : ''}`;
                },
                afterBody(items) {
                  const date = dates[items[0].dataIndex];
                  const evs = BTV.allEvents().filter((e) => e.startDate <= date && date <= e.endDate);
                  if (!evs.length) return '';
                  return evs.map((e) => `· ${e.name} (${e.type}, ${offerLabel(e)})`);
                },
              },
            },
          },
          scales: {
            y: { beginAtZero: true, grid: { color: Charts.COLOR.grid } },
            x: { grid: { display: false }, ticks: { color: tickColor, font: { size: 10 } } },
          },
        },
      },
      {
        $showLabels: el('showLabels').checked,
        $eventBands: bands,
        $dayTypes: dayTypes,
        $labelStep: dates.length > 70 ? 3 : dates.length > 40 ? 2 : 1,
      }
    );

    const holidays = dates.filter((d) => util.holidayOf(d));
    el('chartHint').innerHTML =
      `<span class="day-key"><i class="weekend"></i>주말</span> <span class="day-key"><i class="holiday"></i>공휴일</span> ` +
      (holidays.length ? `· ${holidays.map((d) => `${fmt.date(d)} ${util.holidayOf(d)}`).join(', ')} ` : '') +
      (months.length > 1
        ? `· ${months.map(periodLabel).join(' → ')} 를 이어서 표시합니다.`
        : '· 이벤트 진행 구간은 상단 리본으로 표기됩니다. 여러 월을 선택하면 이어서 볼 수 있습니다.');
  }

  // 같은 일자끼리 겹쳐 월별 추이 모양을 비교한다 (월말에 전월 전체와 견주는 용도)
  function renderOverlayChart(months) {
    const series = el('overlaySeries').value;
    const seriesLabel = { paid: '유료 신규', coupon: '쿠폰 가입', total: '유료+쿠폰 합계' }[series];
    const maxDay = Math.max(...months.map((m) => monthRange(m).length));
    const labels = Array.from({ length: maxDay }, (_, i) => `${i + 1}일`);

    const datasets = months.map((m, i) => {
      const byDay = new Map(BTV.dayRows(m).map((d) => [Number(d.date.slice(8, 10)), d]));
      const color = Charts.EVENT_COLORS[i % Charts.EVENT_COLORS.length];
      const isLatest = i === months.length - 1;
      const short = `${m.slice(2, 4)}.${m.slice(5, 7)}`;
      return {
        label: m === util.monthOf(BTV.LAST_DATA_DAY) ? `${short} (${fmt.date(BTV.LAST_DATA_DAY)}까지)` : short,
        data: labels.map((_, idx) => {
          const row = byDay.get(idx + 1);
          if (!row) return null;
          return series === 'total' ? row.paid + row.coupon : row[series];
        }),
        borderColor: color,
        backgroundColor: `${color}1a`,
        borderWidth: isLatest ? 2.5 : 1.5,
        borderDash: isLatest ? [] : [5, 3],
        tension: 0.3,
        pointRadius: isLatest ? 2.5 : 1.5,
        fill: isLatest,
        spanGaps: false,
      };
    });

    Charts.render(
      'monthChart',
      {
        type: 'line',
        data: { labels, datasets },
        options: {
          layout: { padding: { top: 12 } },
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: { position: 'bottom' },
            title: { display: true, text: `${seriesLabel} · 월별 일자 추이 비교`, color: '#6b7688' },
          },
          scales: {
            y: { beginAtZero: true, grid: { color: Charts.COLOR.grid } },
            x: { grid: { display: false } },
          },
        },
      },
      { $showLabels: el('showLabels').checked && months.length <= 2, $eventBands: [], $labelStep: 2 }
    );

    el('chartHint').textContent = `${months.map(periodLabel).join(' vs ')} 를 같은 일자 기준으로 겹쳐 비교합니다. 가장 최근 월이 실선, 나머지는 점선입니다. (겹쳐 보기에서는 이벤트 리본을 표시하지 않습니다)`;
  }

  /* ---------- 표 ---------- */
  function renderPlanTable() {
    const list = BTV.eventsOfMonth(month);
    el('eventPlanTable').innerHTML = `
      <thead><tr>
        <th class="left">#</th><th class="left">기간</th><th class="left">이벤트명</th><th class="left">타입</th>
        <th>할인율</th><th class="left">경품 종류</th><th>경품 단가</th><th>모수</th><th class="left">상태</th>
      </tr></thead>
      <tbody>${
        list.length
          ? list
              .map((e, i) => {
                const periods = BTV.periodsOf(e);
                const multi = periods.length > 1;
                // 구간이 끊어진 이벤트는 합산 행을 위에 두고, 펼치면 구간별로 보여준다
                const head = `<tr${multi ? ` class="expandable" data-expand="${e.id}"` : ''}>
        <td class="left"><span class="event-no" style="background:${eventColor(i)}">${i + 1}</span></td>
        <td class="left">${
          multi
            ? `<span class="caret">▸</span> ${periods.length}개 구간 합산 <span class="hint">(총 ${e.totalDays}일)</span>`
            : `${fmt.date(e.startDate)} ~ ${fmt.date(e.endDate)} <span class="hint">(${e.totalDays}일)</span>`
        }</td>
        <td class="left">${e.name}</td>
        <td class="left">${e.type}</td>
        <td class="num">${e.discountRate}%</td>
        <td class="left">${e.prizeKind}</td>
        <td class="num">${e.prizeUnitPrice ? fmt.manwon(e.prizeUnitPrice) : '-'}</td>
        <td class="num">${fmt.num(e.pool)}</td>
        <td class="left">${statusTag(e.status)}</td>
      </tr>`;
                if (!multi) return head;
                const children = periods
                  .map((p, pi) => {
                    const days = util.eachDay(p.startDate, p.endDate);
                    const restDays = days.filter(util.isRestDay).length;
                    return `<tr class="period-row" data-child="${e.id}" hidden>
          <td class="left"></td>
          <td class="left"><span class="period-no">${pi + 1}차</span> ${fmt.date(p.startDate)} ~ ${fmt.date(p.endDate)} <span class="hint">(${days.length}일 · 휴일 ${restDays}일)</span></td>
          <td class="left hint" colspan="7">${e.name} ${pi + 1}차 구간</td>
        </tr>`;
                  })
                  .join('');
                return head + children;
              })
              .join('')
          : '<tr><td colspan="9" class="left">해당 월 이벤트가 없습니다.</td></tr>'
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
        <th>일평균</th><th>휴일 일평균</th><th>평일 일평균</th><th class="left">비고</th>
      </tr></thead>
      <tbody>${
        list.length
          ? list
              .map(
                (e) => `<tr>
        <td class="left"><span class="tag">${e.purpose || '-'}</span></td>
        <td class="left">${e.name}${e.inFlight ? ` <span class="tag live">진행중 ${e.elapsedDays}/${e.totalDays}일</span>` : ''}</td>
        <td class="left">${fmt.date(e.startDate)} ~ ${fmt.date(e.endDate)} (${BTV.periodsOf(e).length > 1 ? `${BTV.periodsOf(e).length}개 구간 · ` : ''}${e.totalDays}일)</td>
        <td class="left">${e.type}</td>
        <td class="num">${e.discountRate}%</td>
        <td class="num">${fmt.num(e.pool)}</td>
        <td class="num">${fmt.num(e.signups)}</td>
        <td class="num">${fmt.pct(e.rate)}</td>
        <td class="num">${fmt.num(e.dailyAvg)}</td>
        <td class="num">${fmt.num(e.restAvg)}</td>
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
        <td class="num">${fmt.num(list.reduce((s, e) => s + (e.restAvg || 0), 0) / list.length)}</td>
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

  // 3개년치면 칩이 30개가 넘으므로 최근 12개월 + 선택한 기간만 먼저 보여준다
  function chipMarkup(selected, showAll) {
    const recent = BTV.months.slice(-12);
    const visible = showAll ? BTV.months : BTV.months.filter((m) => recent.includes(m) || selected.has(m));
    const hidden = BTV.months.length - visible.length;
    let lastYear = null;
    const buttons = visible
      .map((m) => {
        const year = m.slice(0, 4);
        const divider = year !== lastYear ? `<span class="chip-year">${year.slice(2)}년</span>` : '';
        lastYear = year;
        return `${divider}<button type="button" class="chip ${selected.has(m) ? 'on' : ''}" data-period="${m}">${periodLabel(m)}</button>`;
      })
      .join('');
    const toggle =
      hidden > 0 || showAll
        ? `<button type="button" class="chip toggle" data-toggle="1">${showAll ? '최근 12개월만' : `이전 기간 +${hidden}`}</button>`
        : '';
    return `${buttons}${toggle}<span class="chip-count">${selected.size}개 선택</span>`;
  }

  function renderPeriodChips() {
    el('segPeriods').innerHTML = chipMarkup(segPeriods, showAllPeriods);
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

    // UI 그룹 × 기간 × 지표 단위로 SEG 값의 최소~최대를 잡는다.
    // 그룹마다 규모가 달라(전체 vs 540 이하) 한 스케일로 묶으면 작은 그룹이 전부 흐려진다.
    const heat = {};
    uiGroups.forEach((ui) =>
      periods.forEach((period) =>
        metrics.forEach((metric) => {
          const values = BTV.SEG_LIST.map((seg) => segValue(stats[ui][period], seg, metric)).filter(
            (v) => v != null && !Number.isNaN(v)
          );
          if (values.length > 1) {
            const min = Math.min(...values);
            const max = Math.max(...values);
            if (max > min) heat[`${ui}|${period}|${metric}`] = { min, max };
          }
        })
      )
    );

    const metricCells = (ui, period, seg) =>
      metrics
        .map((metric, i) => {
          const value = segValue(stats[ui][period], seg, metric);
          const scale = seg === '합계' ? null : heat[`${ui}|${period}|${metric}`];
          let style = '';
          if (scale && value != null) {
            const norm = (value - scale.min) / (scale.max - scale.min);
            style = ` style="background: rgba(13,91,209,${(0.03 + norm * 0.27).toFixed(3)})"`;
          }
          return `<td class="num${i === 0 ? ' group-start' : ''}"${style}>${SEG_METRICS[metric].fmt(value)}</td>`;
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

  function commentItem(c, showMonth) {
    const closing = c.kind === 'closing';
    return `<li class="${closing ? 'closing' : ''}">
      <div class="body">
        <span class="tag ${closing ? 'plan' : ''}">${closing ? '월 마감' : '주간'}</span>
        ${showMonth ? `<span class="who">${util.monthLabel(c.month)}</span>` : c.week ? `<span class="who">${c.week}주차</span>` : ''}
        <span class="when">${new Date(c.at).toLocaleDateString('ko-KR')} · ${c.author}</span>
        <p>${c.text.replace(/</g, '&lt;')}</p>
      </div>
      <button class="icon-btn" data-del="${c.id}" title="삭제">×</button>
    </li>`;
  }

  function renderComments() {
    // 마감 코멘트를 위로 올려 그 달의 결론이 먼저 보이게 한다
    const list = Store.commentsOf(month).slice().sort((a, b) => (a.kind === 'closing' ? -1 : b.kind === 'closing' ? 1 : 0));
    el('commentScope').textContent = `${month.slice(0, 4)}년 ${util.monthLabel(month)} 기준 · 월별로 저장됩니다`;
    el('commentList').innerHTML = list.length
      ? list.map((c) => commentItem(c, false)).join('')
      : '<li class="empty">등록된 코멘트가 없습니다.</li>';

    const archive = Store.archivedComments(month);
    el('archiveCount').textContent = `(${archive.length}건)`;
    el('archiveList').innerHTML = archive.length
      ? archive.map((c) => commentItem(c, true)).join('')
      : '<li class="empty">다른 달의 코멘트가 아직 없습니다.</li>';
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
      // 조회 월을 바꾸면 시트 안의 그래프·Seg 기간도 그 달 기준으로 따라간다
      chartMonths.clear();
      chartMonths.add(month);
      segPeriods.clear();
      const idx = BTV.months.indexOf(month);
      if (idx > 0) segPeriods.add(BTV.months[idx - 1]);
      segPeriods.add(month);
      render();
    });
    el('showLabels').addEventListener('change', renderChart);
    el('chartMode').addEventListener('change', (e) => {
      chartMode = e.target.value;
      renderChart();
    });
    el('overlaySeries').addEventListener('change', renderChart);
    el('chartMonths').addEventListener('click', (e) => {
      if (e.target.dataset.toggle) {
        showAllChartMonths = !showAllChartMonths;
        renderChart();
        return;
      }
      const period = e.target.dataset.period;
      if (!period) return;
      if (chartMonths.has(period)) chartMonths.delete(period);
      else chartMonths.add(period);
      renderChart();
    });
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
    el('eventPlanTable').addEventListener('click', (e) => {
      const row = e.target.closest('[data-expand]');
      if (!row) return;
      const id = row.dataset.expand;
      const open = row.classList.toggle('open');
      row.querySelector('.caret').textContent = open ? '▾' : '▸';
      el('eventPlanTable')
        .querySelectorAll(`[data-child="${id}"]`)
        .forEach((child) => {
          child.hidden = !open;
        });
    });
    el('saveTarget').addEventListener('click', () => {
      Store.setTarget(month, Number(el('targetPaid').value) || 0, Number(el('targetCoupon').value) || 0);
      render();
    });
    el('commentForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const text = el('commentText').value.trim();
      if (!text) return;
      Store.addComment(month, text, el('commentKind').value);
      el('commentText').value = '';
      renderComments();
    });
    ['commentList', 'archiveList'].forEach((id) =>
      el(id).addEventListener('click', (e) => {
        const commentId = e.target.dataset.del;
        if (!commentId) return;
        Store.removeComment(commentId);
        renderComments();
      })
    );

    render();
  }

  global.Perf = { init, render, get month() { return month; } };
})(window);
