(function (global) {
  'use strict';

  const { fmt, util } = BTV;
  const el = (id) => document.getElementById(id);
  let month = util.monthOf(BTV.LAST_DATA_DAY);

  function monthDates(m) {
    const last = new Date(Number(m.slice(0, 4)), Number(m.slice(5, 7)), 0).getDate();
    return util.eachDay(`${m}-01`, `${m}-${String(last).padStart(2, '0')}`);
  }

  // 이벤트가 없던 날을 우선 사용해 평상시(오가닉) 일평균을 잡는다
  function trendBase() {
    const window = Number(el('trendWindow').value);
    const recent = BTV.days.slice(-window);
    const organic = recent.filter((d) => !d.eventIds || !d.eventIds.length);
    const source = organic.length >= 3 ? organic : recent;
    const pickAvg = (list, key) => (list.length ? list.reduce((s, d) => s + d[key], 0) / list.length : 0);
    const weekend = source.filter((d) => d.weekend);
    const weekday = source.filter((d) => !d.weekend);
    const fallbackPaid = pickAvg(source, 'paid');
    const fallbackCoupon = pickAvg(source, 'coupon');
    return {
      usedOrganic: organic.length >= 3,
      sampleSize: source.length,
      weekend: {
        paid: weekend.length ? pickAvg(weekend, 'paid') : fallbackPaid * 1.25,
        coupon: weekend.length ? pickAvg(weekend, 'coupon') : fallbackCoupon * 1.25,
      },
      weekday: {
        paid: weekday.length ? pickAvg(weekday, 'paid') : fallbackPaid,
        coupon: weekday.length ? pickAvg(weekday, 'coupon') : fallbackCoupon,
      },
    };
  }

  function baselineDuring(ev) {
    const rows = BTV.days.filter((d) => d.date >= ev.startDate && d.date <= ev.endDate);
    if (!rows.length) return null;
    return rows.reduce((s, d) => s + d.basePaid + d.baseCoupon, 0) / rows.length;
  }

  function recommendedWeight(planned) {
    const similar = BTV.doneEvents()
      .filter((e) => e.id !== planned.id)
      .map((e) => ({ e, score: Compare.similarity(planned, e) }))
      .filter((x) => x.score >= 5)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map((x) => x.e);
    if (!similar.length) return { weight: 1.3, basis: '유사 이벤트 없음 · 기본값' };
    const mults = similar
      .map((e) => {
        const base = baselineDuring(e);
        return base ? 1 + e.dailyAvg / base : null;
      })
      .filter(Boolean);
    if (!mults.length) return { weight: 1.3, basis: '기준선 계산 불가 · 기본값' };
    const avg = mults.reduce((s, v) => s + v, 0) / mults.length;
    return {
      weight: Math.round(Math.min(3.5, Math.max(1, avg)) * 100) / 100,
      basis: `유사 ${similar.length}건 평균 (${similar.map((e) => e.name.replace(/^\d+월 /, '').slice(0, 10).trim()).join(', ')})`,
    };
  }

  function plannedEventsOf(m) {
    return BTV.allEvents().filter((e) => e.status !== '종료' && util.monthOf(e.startDate) <= m && util.monthOf(e.endDate) >= m);
  }

  function compute(scenario) {
    const factor = scenario === 'low' ? 0.92 : scenario === 'high' ? 1.08 : 1;
    const weightFactor = scenario === 'low' ? 0.85 : scenario === 'high' ? 1.15 : 1;
    const dates = monthDates(month);
    const actual = new Map(BTV.dayRows(month).map((d) => [d.date, d]));
    const base = trendBase();
    const planned = plannedEventsOf(month);

    const series = dates.map((date) => {
      const row = actual.get(date);
      if (row) return { date, paid: row.paid, coupon: row.coupon, forecast: false };
      const b = util.isWeekend(date) ? base.weekend : base.weekday;
      const covering = planned.filter((e) => e.startDate <= date && date <= e.endDate);
      const weight = covering.reduce((w, e) => {
        const rec = recommendedWeight(e).weight;
        const applied = Store.weightOf(e.id, rec);
        return w * (1 + (applied - 1) * weightFactor);
      }, 1);
      return {
        date,
        paid: b.paid * weight * factor,
        coupon: b.coupon * weight * factor,
        forecast: true,
      };
    });

    const actualPaid = series.filter((s) => !s.forecast).reduce((s, d) => s + d.paid, 0);
    const actualCoupon = series.filter((s) => !s.forecast).reduce((s, d) => s + d.coupon, 0);
    const futurePaid = series.filter((s) => s.forecast).reduce((s, d) => s + d.paid, 0);
    const futureCoupon = series.filter((s) => s.forecast).reduce((s, d) => s + d.coupon, 0);
    const target = Store.targetOf(month);

    return {
      series,
      base,
      planned,
      actualPaid,
      actualCoupon,
      futurePaid,
      futureCoupon,
      finalPaid: actualPaid + futurePaid,
      finalCoupon: actualCoupon + futureCoupon,
      finalTotal: actualPaid + actualCoupon + futurePaid + futureCoupon,
      remainDays: series.filter((s) => s.forecast).length,
      target,
      targetTotal: target.paid + target.coupon,
    };
  }

  function renderKpis(r) {
    const achieve = r.targetTotal ? r.finalTotal / r.targetTotal : 0;
    const gap = r.finalTotal - r.targetTotal;
    el('forecastKpis').innerHTML = `
      <div class="kpi">
        <div class="label">예상 마감 (합계)</div>
        <div class="value">${fmt.num(r.finalTotal)}</div>
        <div class="sub">실적 ${fmt.num(r.actualPaid + r.actualCoupon)} + 예측 ${fmt.num(r.futurePaid + r.futureCoupon)}</div>
      </div>
      <div class="kpi">
        <div class="label">예상 마감 · 유료 신규</div>
        <div class="value">${fmt.num(r.finalPaid)}</div>
        <div class="sub">목표 ${fmt.num(r.target.paid)} · ${fmt.pct(r.target.paid ? r.finalPaid / r.target.paid : 0, 1)}</div>
      </div>
      <div class="kpi">
        <div class="label">예상 마감 · 쿠폰</div>
        <div class="value">${fmt.num(r.finalCoupon)}</div>
        <div class="sub">목표 ${fmt.num(r.target.coupon)} · ${fmt.pct(r.target.coupon ? r.finalCoupon / r.target.coupon : 0, 1)}</div>
      </div>
      <div class="kpi">
        <div class="label">목표 대비</div>
        <div class="value">${fmt.pct(achieve, 1)}</div>
        <div class="sub ${gap >= 0 ? 'good' : 'warn'}">${gap >= 0 ? '초과' : '미달'} ${fmt.num(Math.abs(gap))}건</div>
        <div class="bar"><span style="width:${Math.min(100, achieve * 100)}%;background:${gap >= 0 ? 'var(--good)' : 'var(--warn)'}"></span></div>
      </div>
      <div class="kpi">
        <div class="label">예측 기준</div>
        <div class="value">${r.remainDays}일</div>
        <div class="sub">${r.base.usedOrganic ? '이벤트 없는 날' : '최근 전체'} ${r.base.sampleSize}일 기준 · 평일 ${fmt.num(r.base.weekday.paid + r.base.weekday.coupon)} / 주말 ${fmt.num(r.base.weekend.paid + r.base.weekend.coupon)}</div>
      </div>`;

    const signals = [];
    if (r.remainDays === 0) {
      signals.push({ level: 'good', text: '집계가 완료된 월입니다. 예측 없이 실적 기준으로 표시합니다.' });
    } else if (gap < 0) {
      const needDaily = (r.targetTotal - (r.actualPaid + r.actualCoupon)) / r.remainDays;
      signals.push({
        level: 'warn',
        text: `현재 추세로는 목표 ${fmt.num(Math.abs(gap))}건 미달 예상 — 잔여 ${r.remainDays}일간 일평균 ${fmt.num(needDaily)}건(예측 대비 +${fmt.num(needDaily - (r.futurePaid + r.futureCoupon) / r.remainDays)}건)이 필요합니다.`,
      });
    } else {
      signals.push({ level: 'good', text: `현재 추세로 목표 ${fmt.num(gap)}건 초과 달성 예상` });
    }
    el('forecastSignals').innerHTML = signals
      .map((s) => `<div class="signal ${s.level}">${s.level === 'warn' ? '⚠' : '✔'} ${s.text}</div>`)
      .join('');
  }

  function renderChart(r) {
    const labels = r.series.map((s) => fmt.date(s.date));
    let cum = 0;
    const actualCum = r.series.map((s) => {
      if (s.forecast) return null;
      cum += s.paid + s.coupon;
      return Math.round(cum);
    });
    let cum2 = cum;
    const firstForecast = r.series.findIndex((s) => s.forecast);
    const forecastCum = r.series.map((s, i) => {
      if (!s.forecast) return i === firstForecast - 1 ? Math.round(cum) : null;
      cum2 += s.paid + s.coupon;
      return Math.round(cum2);
    });

    const bands = r.planned
      .map((ev) => {
        const dates = r.series.map((s) => s.date);
        const from = dates.findIndex((d) => d >= ev.startDate);
        let to = -1;
        dates.forEach((d, i) => {
          if (d <= ev.endDate) to = i;
        });
        if (from < 0 || to < from) return null;
        const shortName = ev.name.length > 13 ? `${ev.name.slice(0, 12)}…` : ev.name;
        return { from, to, planned: true, label: `${shortName} ${ev.discountRate}%` };
      })
      .filter(Boolean);

    Charts.render(
      'forecastChart',
      {
        type: 'line',
        data: {
          labels,
          datasets: [
            {
              label: '누적 실적',
              data: actualCum,
              borderColor: Charts.COLOR.paid,
              backgroundColor: 'rgba(13,91,209,.08)',
              fill: true,
              tension: 0.25,
              pointRadius: 2,
              hideLabels: true,
            },
            {
              label: '누적 예측',
              data: forecastCum,
              borderColor: Charts.COLOR.forecast,
              borderDash: [6, 4],
              tension: 0.25,
              pointRadius: 2,
              hideLabels: true,
            },
            {
              label: '월 목표',
              data: labels.map(() => r.targetTotal),
              borderColor: '#d94f3d',
              borderDash: [2, 4],
              pointRadius: 0,
              borderWidth: 1.5,
              hideLabels: true,
            },
          ],
        },
        options: {
          layout: { padding: { top: Math.min(70, 16 + bands.length * 10) } },
          interaction: { mode: 'index', intersect: false },
          plugins: { legend: { position: 'bottom' } },
          scales: {
            y: { beginAtZero: true, grid: { color: Charts.COLOR.grid }, title: { display: true, text: '누적 가입자' } },
            x: { grid: { display: false } },
          },
        },
      },
      { $showLabels: false, $eventBands: bands }
    );
  }

  function renderWeights(r) {
    const base = r.base;
    el('weightTable').innerHTML = `
      <thead><tr>
        <th class="left">예정 이벤트</th><th class="left">기간</th><th class="left">타입</th><th>할인율</th>
        <th class="left">경품</th><th>추천 가중치</th><th>적용 가중치</th><th>예상 기여</th><th class="left">추천 근거</th>
      </tr></thead>
      <tbody>${
        r.planned.length
          ? r.planned
              .map((ev) => {
                const rec = recommendedWeight(ev);
                const applied = Store.weightOf(ev.id, rec.weight);
                const days = r.series.filter((s) => s.forecast && s.date >= ev.startDate && s.date <= ev.endDate);
                const contribution = days.reduce((sum, s) => {
                  const b = util.isWeekend(s.date) ? base.weekend : base.weekday;
                  const daily = b.paid + b.coupon;
                  return sum + daily * (applied - 1);
                }, 0);
                return `<tr>
          <td class="left">${ev.name}</td>
          <td class="left">${fmt.date(ev.startDate)} ~ ${fmt.date(ev.endDate)}</td>
          <td class="left">${ev.type}</td>
          <td class="num">${ev.discountRate}%</td>
          <td class="left">${ev.prizeKind === '없음' ? '-' : `${ev.prizeKind} ${ev.priceBand}`}</td>
          <td class="num">×${rec.weight.toFixed(2)}</td>
          <td class="num"><input type="number" step="0.05" min="0.5" max="5" value="${applied}" data-weight="${ev.id}" style="width:80px"></td>
          <td class="num">${fmt.num(contribution)}건</td>
          <td class="left hint">${rec.basis}</td>
        </tr>`;
              })
              .join('')
          : '<tr><td colspan="9" class="left">해당 월에 남은 예정 이벤트가 없습니다.</td></tr>'
      }</tbody>`;
  }

  function renderScenarios() {
    const rows = [
      { key: 'low', label: '보수 (기준 -8%, 이벤트 효과 85%)' },
      { key: 'base', label: '기본 (추천 가중치 적용)' },
      { key: 'high', label: '공격 (기준 +8%, 이벤트 효과 115%)' },
    ].map((s) => ({ ...s, r: compute(s.key) }));

    el('scenarioTable').innerHTML = `
      <thead><tr>
        <th class="left">시나리오</th><th>잔여 기간 예상</th><th>예상 마감 (유료)</th>
        <th>예상 마감 (쿠폰)</th><th>예상 마감 (합계)</th><th>목표 대비</th><th>달성률</th>
      </tr></thead>
      <tbody>${rows
        .map(
          ({ key, label, r }) => `<tr${key === 'base' ? ' style="background:#eef4ff"' : ''}>
        <td class="left">${label}</td>
        <td class="num">${fmt.num(r.futurePaid + r.futureCoupon)}</td>
        <td class="num">${fmt.num(r.finalPaid)}</td>
        <td class="num">${fmt.num(r.finalCoupon)}</td>
        <td class="num"><b>${fmt.num(r.finalTotal)}</b></td>
        <td class="num ${r.finalTotal >= r.targetTotal ? 'delta up' : 'delta down'}">${r.finalTotal >= r.targetTotal ? '+' : ''}${fmt.num(r.finalTotal - r.targetTotal)}</td>
        <td class="num">${fmt.pct(r.targetTotal ? r.finalTotal / r.targetTotal : 0, 1)}</td>
      </tr>`
        )
        .join('')}</tbody>`;
  }

  function render() {
    const r = compute('base');
    renderKpis(r);
    renderChart(r);
    renderWeights(r);
    renderScenarios();
    return r;
  }

  function init() {
    BTV.months.forEach((m) =>
      el('forecastMonth').insertAdjacentHTML('beforeend', `<option value="${m}">${m.slice(0, 4)}년 ${util.monthLabel(m)}</option>`)
    );
    el('forecastMonth').value = month;
    el('forecastMonth').addEventListener('change', (e) => {
      month = e.target.value;
      render();
    });
    el('trendWindow').addEventListener('change', render);
    el('resetWeights').addEventListener('click', () => {
      Store.clearWeights();
      render();
    });
    el('weightTable').addEventListener('change', (e) => {
      const id = e.target.dataset.weight;
      if (!id) return;
      Store.setWeight(id, Number(e.target.value) || 1);
      render();
    });
    render();
  }

  global.Forecast = { init, render, compute, recommendedWeight, get month() { return month; } };
})(window);
