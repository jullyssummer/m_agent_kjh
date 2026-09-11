/* 로컬 규칙 기반 어시스턴트. 답변 수치는 모두 화면과 동일한 데이터에서 계산한다.
   외부 LLM 연동 시 answer() 만 API 호출로 교체하면 된다. */
(function (global) {
  'use strict';

  const { fmt, util } = BTV;
  const el = (id) => document.getElementById(id);
  const pending = new Map();
  let context = 'perf';

  const CONTEXT_LABEL = { perf: '현재 실적 파악', compare: '실적 비교 분석', forecast: '마감 예측' };
  const SUGGESTIONS = {
    perf: ['이번 달 어때?', '이번 주 요약해줘', '세그먼트별로 보면?'],
    compare: ['가장 성과 좋은 이벤트는?', '할인율 효과 있어?', '추첨 경품 효율 비교해줘'],
    forecast: ['이번 달 마감 얼마나 될까?', '목표 달성 가능해?', '다음 이벤트 뭐로 할까?'],
  };

  const table = (head, rows) =>
    `<table><thead><tr>${head.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows
      .map((r) => `<tr>${r.map((c, i) => `<td class="${i === 0 ? 'left' : 'num'}">${c}</td>`).join('')}</tr>`)
      .join('')}</tbody></table>`;

  const avg = (list, f) => {
    const vals = list.map(f).filter((v) => v != null && !Number.isNaN(v));
    return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null;
  };

  function groupBy(list, keyFn) {
    const map = new Map();
    list.forEach((e) => {
      const k = keyFn(e);
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(e);
    });
    return map;
  }

  /* ---------- 답변 생성기 ---------- */
  function monthSummary() {
    const month = Perf.month;
    const s = BTV.monthStats(month);
    const target = Store.targetOf(month);
    const targetTotal = target.paid + target.coupon;
    const series = BTV.seriesThrough(month);
    const last7 = series.slice(-7);
    const prev7 = series.slice(-14, -7);
    const dailyAvg = (list) => (list.length ? list.reduce((acc, d) => acc + d.paid + d.coupon, 0) / list.length : 0);
    const delta = prev7.length ? (dailyAvg(last7) - dailyAvg(prev7)) / dailyAvg(prev7) : 0;
    const evs = BTV.eventsOfMonth(month).filter((e) => e.signups != null);
    const best = evs.slice().sort((a, b) => b.rate - a.rate)[0];

    const text = `${util.monthLabel(month)} 누적 ${fmt.num(s.total)}건(유료 ${fmt.num(s.paid)} / 쿠폰 ${fmt.num(s.coupon)}), 목표 대비 ${fmt.pct(targetTotal ? s.total / targetTotal : 0, 1)}. 최근 7일은 직전 주 대비 ${(delta * 100).toFixed(1)}% ${delta >= 0 ? '증가' : '감소'}${best ? `. 최고 성과는 ${best.name}(가입률 ${fmt.pct(best.rate)})` : ''}`;

    return {
      html: `<b>${util.monthLabel(month)} 현황</b><br>${text}
        ${table(
          ['구분', '누적', '목표', '달성률'],
          [
            ['유료 신규', fmt.num(s.paid), fmt.num(target.paid), fmt.pct(target.paid ? s.paid / target.paid : 0, 1)],
            ['쿠폰 가입', fmt.num(s.coupon), fmt.num(target.coupon), fmt.pct(target.coupon ? s.coupon / target.coupon : 0, 1)],
          ]
        )}`,
      insight: text,
      tags: [util.monthLabel(month), '월간요약'],
    };
  }

  function topEvents() {
    const list = BTV.doneEvents().slice().sort((a, b) => b.rate - a.rate).slice(0, 5);
    const top = list[0];
    const text = `가입률 기준 최고 성과는 ${top.name} (${top.type}, 할인 ${top.discountRate}%${top.prizeKind !== '없음' ? ` + ${top.prizeKind} ${top.priceBand}` : ''}) — 가입률 ${fmt.pct(top.rate)}, 일평균 ${fmt.num(top.dailyAvg)}건`;
    return {
      html: `<b>성과 상위 이벤트</b><br>${text}
        ${table(
          ['이벤트', '타입', '할인', '가입률', '일평균'],
          list.map((e) => [e.name, e.type.replace('할인+', ''), `${e.discountRate}%`, fmt.pct(e.rate), fmt.num(e.dailyAvg)])
        )}`,
      insight: text,
      tags: ['성과분석', top.type],
    };
  }

  function discountAnalysis() {
    const list = BTV.doneEvents();
    const groups = [...groupBy(list, (e) => e.discountRate).entries()].sort((a, b) => a[0] - b[0]);
    const rows = groups.map(([rate, evs]) => ({
      rate,
      n: evs.length,
      avgRate: avg(evs, (e) => e.rate),
      perPoint: avg(evs, (e) => e.rate) / rate,
    }));
    const best = rows.slice().sort((a, b) => b.avgRate - a.avgRate)[0];
    const efficient = rows.slice().sort((a, b) => b.perPoint - a.perPoint)[0];
    const text = `할인율이 높을수록 가입률은 오르지만 효율은 다릅니다. 절대 가입률 최고는 ${best.rate}% 구간(${fmt.pct(best.avgRate)}), 할인 1%p당 효율이 가장 좋은 구간은 ${efficient.rate}%입니다`;
    return {
      html: `<b>할인율 교차분석</b><br>${text}
        ${table(
          ['할인율', '건수', '평균 가입률', '1%p당 효율'],
          rows.map((r) => [`${r.rate}%`, r.n, fmt.pct(r.avgRate), fmt.pct(r.perPoint, 3)])
        )}`,
      insight: text,
      tags: ['할인율', '교차분석'],
    };
  }

  function raffleAnalysis() {
    const list = BTV.doneEvents().filter((e) => e.isRaffle && e.entrants);
    if (!list.length) return { html: '추첨 이벤트 데이터가 없습니다.', insight: '', tags: [] };
    const byKind = [...groupBy(list, (e) => e.prizeKind).entries()].map(([kind, evs]) => ({
      kind,
      n: evs.length,
      entrants: avg(evs, (e) => e.entrants),
      competition: avg(evs, (e) => e.competition),
      cost: avg(evs, (e) => e.costPerEntrant),
      receive: avg(evs, (e) => e.receiveRate),
    }));
    const cheapest = byKind.slice().sort((a, b) => a.cost - b.cost)[0];
    const hottest = byKind.slice().sort((a, b) => b.competition - a.competition)[0];
    const text = `응모자 1명당 비용이 가장 낮은 경품은 ${cheapest.kind}(${fmt.won(cheapest.cost)}), 경쟁률이 가장 높은 경품은 ${hottest.kind}(${hottest.competition.toFixed(1)}:1). 수령률은 ${cheapest.kind} ${fmt.pct(cheapest.receive, 1)}`;
    return {
      html: `<b>추첨 경품 효율</b><br>${text}
        ${table(
          ['경품', '건수', '평균 응모자', '경쟁률', '1명당 비용', '수령률'],
          byKind.map((r) => [r.kind, r.n, fmt.num(r.entrants), `${r.competition.toFixed(1)}:1`, fmt.won(r.cost), fmt.pct(r.receive, 1)])
        )}`,
      insight: text,
      tags: ['추첨', '경품효율'],
    };
  }

  function forecastAnswer() {
    const r = Forecast.compute('base');
    const gap = r.finalTotal - r.targetTotal;
    const text = `${util.monthLabel(Forecast.month)} 예상 마감은 ${fmt.num(r.finalTotal)}건(유료 ${fmt.num(r.finalPaid)} / 쿠폰 ${fmt.num(r.finalCoupon)})으로 목표 ${fmt.num(r.targetTotal)} 대비 ${gap >= 0 ? '초과' : '미달'} ${fmt.num(Math.abs(gap))}건 (달성률 ${fmt.pct(r.targetTotal ? r.finalTotal / r.targetTotal : 0, 1)})`;
    const low = Forecast.compute('low');
    const high = Forecast.compute('high');
    return {
      html: `<b>마감 예측</b><br>${text}
        ${table(
          ['시나리오', '예상 마감', '목표 대비'],
          [
            ['보수', fmt.num(low.finalTotal), fmt.num(low.finalTotal - low.targetTotal)],
            ['기본', fmt.num(r.finalTotal), fmt.num(gap)],
            ['공격', fmt.num(high.finalTotal), fmt.num(high.finalTotal - high.targetTotal)],
          ]
        )}
        ${r.planned.length ? `잔여 ${r.remainDays}일 · 예정 이벤트 ${r.planned.length}건 반영` : `잔여 ${r.remainDays}일 · 예정 이벤트 없음`}`,
      insight: text,
      tags: [util.monthLabel(Forecast.month), '마감예측'],
    };
  }

  function recommendation() {
    const list = BTV.doneEvents();
    const byType = [...groupBy(list, (e) => e.type).entries()]
      .map(([type, evs]) => ({ type, n: evs.length, rate: avg(evs, (e) => e.rate) }))
      .sort((a, b) => b.rate - a.rate);
    const byDiscount = [...groupBy(list, (e) => e.discountRate).entries()]
      .map(([rate, evs]) => ({ rate, eff: avg(evs, (e) => e.rate) / rate, avgRate: avg(evs, (e) => e.rate) }))
      .sort((a, b) => b.eff - a.eff);
    const raffle = list.filter((e) => e.isRaffle && e.costPerEntrant);
    const byPrize = [...groupBy(raffle, (e) => `${e.prizeKind} ${e.priceBand}`).entries()]
      .map(([key, evs]) => ({ key, cost: avg(evs, (e) => e.costPerEntrant), rate: avg(evs, (e) => e.rate) }))
      .sort((a, b) => a.cost - b.cost);

    const bestType = byType[0];
    const bestDiscount = byDiscount[0];
    const bestPrize = byPrize[0];
    const text = `다음 이벤트는 ${bestType.type}(평균 가입률 ${fmt.pct(bestType.rate)}) 구조에 할인 ${bestDiscount.rate}%(할인 1%p당 효율 최고)를 적용하고, 경품은 ${bestPrize ? `${bestPrize.key}(응모자 1명당 ${fmt.won(bestPrize.cost)}으로 가장 저렴)` : '추가 데이터 필요'} 조합을 추천합니다`;
    return {
      html: `<b>다음 이벤트 기획 조언</b><br>${text}
        ${table(
          ['이벤트 타입', '건수', '평균 가입률'],
          byType.map((t) => [t.type, t.n, fmt.pct(t.rate)])
        )}`,
      insight: text,
      tags: ['기획조언', bestType.type],
    };
  }

  function segmentAnalysis() {
    const month = Perf.month;
    const rows = BTV.segStats(month, '전체').slice().sort((a, b) => b.rate - a.rate);
    const best = rows[0];
    const worst = rows[rows.length - 1];
    const text = `${util.monthLabel(month)} 기준 가입률이 가장 높은 SEG는 ${best.segment}(${fmt.pct(best.rate)}), 가장 낮은 SEG는 ${worst.segment}(${fmt.pct(worst.rate)})`;
    return {
      html: `<b>SEG별 실적</b><br>${text}
        ${table(
          ['SEG', '할당', '사용', '가입률'],
          rows.map((r) => [r.segment, fmt.num(r.allocated), fmt.num(r.used), fmt.pct(r.rate)])
        )}`,
      insight: text,
      tags: [util.monthLabel(month), '세그먼트'],
    };
  }

  function compareAnswer() {
    const baseId = el('baseEvent').value;
    const base = BTV.doneEvents().find((e) => e.id === baseId) || BTV.doneEvents().slice(-1)[0];
    const others = Compare.comparisonSet(base);
    const refRate = avg(others, (e) => e.rate);
    const diff = refRate ? (base.rate - refRate) / refRate : 0;
    const text = `${base.name}의 가입률 ${fmt.pct(base.rate)}는 유사 이벤트 ${others.length}건 평균 ${fmt.pct(refRate)} 대비 ${diff >= 0 ? '+' : ''}${(diff * 100).toFixed(1)}% 수준입니다`;
    return {
      html: `<b>현재 ↔ 과거 비교</b><br>${text}
        ${table(
          ['이벤트', '가입률', '일평균'],
          [base, ...others.slice(0, 4)].map((e) => [e.name, fmt.pct(e.rate), fmt.num(e.dailyAvg)])
        )}`,
      insight: text,
      tags: ['비교분석', base.name],
    };
  }

  function help() {
    return {
      html: `<b>이렇게 물어보세요</b><br>
        · 이번 달 어때? / 이번 주 요약해줘<br>
        · 가장 성과 좋은 이벤트는?<br>
        · 할인율 효과 있어? / 경품 효율 비교해줘<br>
        · 이번 달 마감 얼마나 될까? / 목표 달성 가능해?<br>
        · 다음 이벤트 뭐로 할까?<br>
        · 세그먼트별로 보면?`,
      insight: '',
      tags: [],
    };
  }

  const INTENTS = [
    { keys: ['마감', '예측', '전망', '달성 가능', '얼마나 될'], fn: forecastAnswer },
    { keys: ['다음', '추천', '기획', '뭐로', '어떻게 할'], fn: recommendation },
    { keys: ['할인'], fn: discountAnalysis },
    { keys: ['경품', '추첨', '응모', '경쟁률', '수령'], fn: raffleAnalysis },
    { keys: ['세그', '타겟', 'seg'], fn: segmentAnalysis },
    { keys: ['비교', '지난', '과거', '대비'], fn: compareAnswer },
    { keys: ['최고', '베스트', '잘된', '성과 좋', 'top'], fn: topEvents },
    { keys: ['이번 달', '이번달', '현황', '요약', '어때', '실적'], fn: monthSummary },
    { keys: ['도움', '뭐 할', 'help', '사용법'], fn: help },
  ];

  function answer(question) {
    const q = question.toLowerCase();
    const hit = INTENTS.find((i) => i.keys.some((k) => q.includes(k.toLowerCase())));
    const contextFallback = { perf: monthSummary, compare: topEvents, forecast: forecastAnswer };
    const result = hit ? hit.fn() : contextFallback[context]();
    if (!hit) result.html = `질문을 정확히 이해하지 못해 현재 화면 기준으로 답변합니다.<br><br>${result.html}`;

    const keywords = result.tags.concat(question.split(/\s+/).filter((w) => w.length > 1));
    const cited = Store.searchInsights(keywords).slice(0, 2);
    if (cited.length) {
      result.html += `<div class="cited"><b>축적된 인사이트</b><br>${cited.map((c) => `· ${c.text}`).join('<br>')}</div>`;
    }
    return result;
  }

  /* ---------- 렌더링 ---------- */
  function push(role, html, insight, tags) {
    const log = el('chatLog');
    const id = `m${Date.now()}${Math.random().toString(36).slice(2, 5)}`;
    const saveBtn =
      role === 'bot' && insight ? `<button class="save-insight" data-save="${id}">인사이트로 저장</button>` : '';
    log.insertAdjacentHTML('beforeend', `<div class="msg ${role}" id="${id}">${html}${saveBtn}</div>`);
    if (insight) pending.set(id, { text: insight, tags: tags || [] });
    log.scrollTop = log.scrollHeight;
  }

  function ask(question) {
    push('user', question.replace(/</g, '&lt;'));
    const result = answer(question);
    setTimeout(() => push('bot', result.html, result.insight, result.tags), 120);
  }

  function renderInsights() {
    const list = Store.state.insights;
    el('insightCount').textContent = list.length;
    el('insightList').innerHTML = list.length
      ? list
          .map(
            (i) => `<div class="insight">
        <p>${i.text.replace(/</g, '&lt;')}</p>
        <div class="tags">${i.tags.map((t) => `<span class="tag">${t}</span>`).join('')}</div>
        <div class="row"><span class="when">${new Date(i.at).toLocaleDateString('ko-KR')} · ${i.source}</span>
        <button class="icon-btn" data-drop="${i.id}">×</button></div>
      </div>`
          )
          .join('')
      : '<div class="empty">저장된 인사이트가 없습니다.<br>채팅 답변에서 "인사이트로 저장"을 눌러보세요.</div>';
  }

  function setContext(view) {
    context = view;
    el('chatContext').textContent = CONTEXT_LABEL[view] || '';
    el('chatSuggest').innerHTML = (SUGGESTIONS[view] || [])
      .map((s) => `<button class="chip" type="button">${s}</button>`)
      .join('');
  }

  function init() {
    setContext('perf');
    push('bot', '안녕하세요. 화면에 표시된 실제 데이터를 계산해 답변합니다. 아래 추천 질문을 눌러보거나 직접 물어보세요.');
    renderInsights();

    el('chatForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const v = el('chatInput').value.trim();
      if (!v) return;
      el('chatInput').value = '';
      ask(v);
    });
    el('chatSuggest').addEventListener('click', (e) => {
      if (e.target.classList.contains('chip')) ask(e.target.textContent);
    });
    el('chatLog').addEventListener('click', (e) => {
      const id = e.target.dataset.save;
      if (!id) return;
      const item = pending.get(id);
      const ok = Store.addInsight(item.text, item.tags, 'chat');
      e.target.textContent = ok ? '저장됨' : '이미 저장된 인사이트';
      e.target.disabled = true;
      renderInsights();
    });
    el('insightForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const v = el('insightInput').value.trim();
      if (!v) return;
      Store.addInsight(v, ['직접입력'], 'manual');
      el('insightInput').value = '';
      renderInsights();
    });
    el('insightList').addEventListener('click', (e) => {
      const id = e.target.dataset.drop;
      if (!id) return;
      Store.removeInsight(id);
      renderInsights();
    });
    document.querySelectorAll('.chat-tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.chat-tab').forEach((t) => t.classList.remove('active'));
        document.querySelectorAll('.chat-pane').forEach((p) => p.classList.remove('active'));
        tab.classList.add('active');
        el(`pane-${tab.dataset.pane}`).classList.add('active');
      });
    });
  }

  global.Chat = { init, setContext, ask, renderInsights };
})(window);
