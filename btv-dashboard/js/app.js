(function (global) {
  'use strict';

  const el = (id) => document.getElementById(id);

  /* ---------- CSV ---------- */
  function splitRow(line) {
    const out = [];
    let cur = '';
    let quoted = false;
    for (const ch of line) {
      if (ch === '"') quoted = !quoted;
      else if (ch === ',' && !quoted) {
        out.push(cur);
        cur = '';
      } else cur += ch;
    }
    out.push(cur);
    return out;
  }

  function parseCsv(text) {
    const lines = text.replace(/^﻿/, '').trim().split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) return [];
    const head = splitRow(lines[0]).map((h) => h.trim().toLowerCase());
    return lines.slice(1).map((line) => {
      const cells = splitRow(line);
      const row = {};
      head.forEach((h, i) => {
        row[h] = (cells[i] || '').trim();
      });
      return row;
    });
  }

  const DAILY_ALIAS = {
    date: ['date', '일자', '날짜'],
    paid: ['paid', '유료 가입자 수', '유료가입자수', '유료신규', '유료 신규', '유료'],
    // 쿠폰은 선택 — 예전 정리 양식에만 있고, raw로 올리면 쿠폰 파일이 대신한다
    coupon: ['coupon', '쿠폰가입', '쿠폰 가입', '쿠폰'],
  };
  const SEG_ALIAS = {
    month: ['month', '월', '기준월'],
    ui: ['ui', 'ui구분', 'ui 구분'],
    segment: ['seg', 'segment', '세그먼트'],
    allocated: ['allocated', '할당'],
    used: ['used', '사용'],
  };
  const COUPON_ALIAS = {
    date: ['date', '일자', '날짜'],
    policyId: ['policy_id', '쿠폰정책번호', '쿠폰 정책번호', '정책번호'],
    policyName: ['policy_name', '쿠폰정책명', '쿠폰 정책명'],
    count: ['count', 'signups', '가입자수', '가입자 수'],
  };
  const ALLOC_ALIAS = {
    date: ['date', '일자', '날짜'],
    policyId: ['policy_id', '쿠폰정책번호', '쿠폰 정책번호', '정책번호'],
    policyName: ['policy_name', '쿠폰정책명', '쿠폰 정책명'],
    count: ['allocated', '할당 수', '할당수', '할당', '대상자 수', '대상자수'],
  };
  const PRIZE_ALIAS = {
    event: ['event', 'event_name', '이벤트명'],
    rank: ['rank', '등급'],
    kind: ['kind', 'prize_kind', '경품종류', '경품 종류'],
    form: ['form', 'prize_form', '경품유형', '경품 유형'],
    unitPrice: ['unit_price', '경품단가', '경품 단가'],
    count: ['count', 'prize_count', '경품수량', '경품 수량'],
    winners: ['winners', '당첨자수', '당첨자 수'],
    winnerPick: ['winner_pick', '당첨자선정방식', '당첨자 선정 방식'],
    entrants: ['entrants', '응모자수', '응모자 수'],
    receivers: ['receivers', '실수령자수', '실수령자 수', '수령자 수'],
    purchaseCost: ['purchase_cost', '경품구매비', '경품 구매비'],
    actualBudget: ['actual_budget', '실예산'],
  };
  const EVENT_ALIAS = {
    id: ['id', 'event_id', '이벤트id'],
    name: ['name', 'event_name', '이벤트명'],
    purpose: ['purpose', '구분', '목적'],
    couponPolicy: ['coupon_policy', '쿠폰정책명', '쿠폰 정책명'],
    couponPolicyIds: ['policy_id', '쿠폰정책번호', '쿠폰 정책번호', '정책번호'],
    paidSignups: ['paid_signups', '유료가입자수', '유료 가입자 수'],
    couponSignups: ['coupon_signups', '쿠폰가입자수', '쿠폰 가입자 수'],
    signups: ['signups', '가입자수', '가입자 수'],
    type: ['type', '이벤트타입', '타입', '이벤트종류', '이벤트 종류'],
    discountRate: ['discount_rate', '할인율'],
    startDate: ['start_date', '시작일'],
    endDate: ['end_date', '종료일'],
    pool: ['pool', '모수'],
  };

  const val = (row, aliases) => {
    const key = aliases.find((a) => row[a] !== undefined && row[a] !== '');
    return key ? row[key] : '';
  };
  const toNum = (v) => {
    const cleaned = String(v).replace(/[,%원\s]/g, '');
    // 빈 칸은 0이 아니라 '값 없음'이다 (성과를 비워 두면 raw에서 집계하도록)
    if (cleaned === '') return null;
    const n = Number(cleaned);
    return Number.isNaN(n) ? null : n;
  };
  const toDate = (v) => {
    const s = String(v).trim().replace(/[./]/g, '-');
    if (/^\d{8}$/.test(s)) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
    const m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    return m ? `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}` : null;
  };

  function detectKind(rows) {
    const keys = Object.keys(rows[0] || {});
    const has = (aliases) => aliases.some((a) => keys.includes(a));
    const named = has(EVENT_ALIAS.name) || has(EVENT_ALIAS.id);
    const dated = has(DAILY_ALIAS.date);
    if (has(SEG_ALIAS.segment) && has(SEG_ALIAS.allocated)) return 'seg';
    if (has(ALLOC_ALIAS.policyId) && has(ALLOC_ALIAS.count)) return 'couponAlloc';
    if (dated && has(COUPON_ALIAS.policyId)) return 'couponDaily';
    if (named && has(PRIZE_ALIAS.rank) && has(PRIZE_ALIAS.count)) return 'prizes';
    if (named) return 'events';
    if (dated) return 'daily';
    return null;
  }

  function buildSeg(rows) {
    return rows
      .map((r) => {
        const month = String(val(r, SEG_ALIAS.month)).trim().replace(/[./]/g, '-').slice(0, 7);
        if (!/^\d{4}-\d{2}$/.test(month)) return null;
        return {
          month,
          ui: val(r, SEG_ALIAS.ui) || '전체',
          segment: val(r, SEG_ALIAS.segment),
          days: new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate(),
          allocated: toNum(val(r, SEG_ALIAS.allocated)) || 0,
          used: toNum(val(r, SEG_ALIAS.used)) || 0,
        };
      })
      .filter((r) => r && r.segment);
  }

  function buildCouponAlloc(rows) {
    return rows
      .map((r) => ({
        date: toDate(val(r, ALLOC_ALIAS.date)) || '',
        policyId: String(val(r, ALLOC_ALIAS.policyId)).trim(),
        policyName: val(r, ALLOC_ALIAS.policyName) || '',
        count: toNum(val(r, ALLOC_ALIAS.count)) || 0,
      }))
      .filter((r) => r.policyId && r.count);
  }

  function buildCouponDaily(rows) {
    return rows
      .map((r) => ({
        date: toDate(val(r, COUPON_ALIAS.date)),
        policyId: String(val(r, COUPON_ALIAS.policyId)).trim(),
        policyName: val(r, COUPON_ALIAS.policyName) || '',
        count: toNum(val(r, COUPON_ALIAS.count)) || 0,
      }))
      .filter((r) => r.date && r.policyId);
  }

  function buildPrizes(rows) {
    return rows
      .map((r) => {
        const event = val(r, PRIZE_ALIAS.event);
        const count = toNum(val(r, PRIZE_ALIAS.count)) || 0;
        const unitPrice = toNum(val(r, PRIZE_ALIAS.unitPrice)) || 0;
        const receivers = toNum(val(r, PRIZE_ALIAS.receivers));
        if (!event || !count) return null;
        return {
          event,
          rank: toNum(val(r, PRIZE_ALIAS.rank)) || 1,
          kind: val(r, PRIZE_ALIAS.kind) || '없음',
          form: val(r, PRIZE_ALIAS.form) || '-',
          unitPrice,
          count,
          winners: toNum(val(r, PRIZE_ALIAS.winners)) != null ? toNum(val(r, PRIZE_ALIAS.winners)) : count,
          winnerPick: val(r, PRIZE_ALIAS.winnerPick) || '-',
          entrants: toNum(val(r, PRIZE_ALIAS.entrants)),
          receivers: receivers != null ? receivers : count,
          purchaseCost: toNum(val(r, PRIZE_ALIAS.purchaseCost)) != null ? toNum(val(r, PRIZE_ALIAS.purchaseCost)) : count * unitPrice,
          actualBudget: toNum(val(r, PRIZE_ALIAS.actualBudget)) != null ? toNum(val(r, PRIZE_ALIAS.actualBudget)) : (receivers != null ? receivers : count) * unitPrice,
        };
      })
      .filter(Boolean);
  }

  function buildDaily(rows) {
    return rows
      .map((r) => ({
        date: toDate(val(r, DAILY_ALIAS.date)),
        paid: toNum(val(r, DAILY_ALIAS.paid)) || 0,
        coupon: toNum(val(r, DAILY_ALIAS.coupon)) || 0,
      }))
      .filter((r) => r.date);
  }

  // 같은 이벤트가 끊어진 여러 구간으로 진행되면 CSV에 여러 행으로 나온다.
  // 이벤트명(또는 ID) 기준으로 한 건으로 묶고, 구간과 실적을 합친다.
  function groupPeriods(list) {
    const byKey = new Map();
    list.forEach((row) => {
      const key = row.id;
      const prev = byKey.get(key);
      if (!prev) {
        byKey.set(key, { ...row, periods: [{ startDate: row.startDate, endDate: row.endDate }] });
        return;
      }
      prev.periods.push({ startDate: row.startDate, endDate: row.endDate });
      prev.periods.sort((a, b) => (a.startDate < b.startDate ? -1 : 1));
      prev.startDate = prev.periods[0].startDate;
      prev.endDate = prev.periods[prev.periods.length - 1].endDate;
      // 실적·예산은 구간별로 쌓이는 값이라 더하고, 모수는 같은 대상일 수 있어 최댓값을 쓴다
      prev.couponPolicyIds = [...new Set([...(prev.couponPolicyIds || []), ...(row.couponPolicyIds || [])])];
      if (!prev.autoRollup) {
        ['signups', 'paidSignups', 'couponSignups', 'restSignups', 'weekdaySignups'].forEach((k) => {
          if (row[k] == null) return;
          prev[k] = (prev[k] || 0) + row[k];
        });
      }
      prev.pool = Math.max(prev.pool || 0, row.pool || 0);
      prev.status = prev.endDate <= BTV.LAST_DATA_DAY ? '종료' : prev.startDate <= BTV.LAST_DATA_DAY ? '진행중' : '예정';
    });
    return [...byKey.values()];
  }

  function buildEvents(rows) {
    return groupPeriods(
      rows
      .map((r, i) => {
        const startDate = toDate(val(r, EVENT_ALIAS.startDate));
        const endDate = toDate(val(r, EVENT_ALIAS.endDate));
        if (!startDate || !endDate) return null;
        // 정리된 양식(성과 포함)과 raw 기반(성과 없음)을 모두 받는다
        const paid = toNum(val(r, EVENT_ALIAS.paidSignups));
        const coupon = toNum(val(r, EVENT_ALIAS.couponSignups));
        const total = toNum(val(r, EVENT_ALIAS.signups));
        const given = paid != null || coupon != null || total != null;
        const signups = given ? (paid != null || coupon != null ? (paid || 0) + (coupon || 0) : total) : null;
        const dates = BTV.util.eachDay(startDate, endDate);
        const restDays = dates.filter(BTV.util.isRestDay).length;
        const weekdayDays = dates.length - restDays;
        const restUnits = restDays * 1.25;
        const share = restUnits + weekdayDays;
        return {
          id: val(r, EVENT_ALIAS.id) || `UP-${val(r, EVENT_ALIAS.name)}`,
          name: val(r, EVENT_ALIAS.name) || `업로드 이벤트 ${i + 1}`,
          type: val(r, EVENT_ALIAS.type) || '할인',
          discountRate: toNum(val(r, EVENT_ALIAS.discountRate)) || 0,
          startDate,
          endDate,
          purpose: val(r, EVENT_ALIAS.purpose) || '-',
          couponPolicy: val(r, EVENT_ALIAS.couponPolicy) || '-',
          // 성과는 raw에서 채운다. 정책번호는 쉼표로 여러 개 적을 수 있다.
          couponPolicyIds: String(val(r, EVENT_ALIAS.couponPolicyIds) || '')
            .split(/[,;|]/)
            .map((v) => v.trim())
            .filter(Boolean),
          // 성과를 직접 적어 올린 건은 그 값을 유지하고, 비어 있으면 raw에서 채운다
          autoRollup: !given,
          paidSignups: paid,
          couponSignups: coupon,
          signups,
          restSignups: given && share ? Math.round((signups * restUnits) / share) : null,
          weekdaySignups: given && share ? Math.round((signups * weekdayDays) / share) : null,
          pool: toNum(val(r, EVENT_ALIAS.pool)) || 0,
          autoPool: toNum(val(r, EVENT_ALIAS.pool)) == null,
          status: endDate <= BTV.LAST_DATA_DAY ? '종료' : startDate <= BTV.LAST_DATA_DAY ? '진행중' : '예정',
        };
      })
      .filter(Boolean)
    );
  }

  const csvCell = (v) => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csvOf = (header, rows) => [header.join(','), ...rows.map((r) => r.map(csvCell).join(','))].join('\n');

  function exportAll() {
    const stamp = BTV.LAST_DATA_DAY.replace(/-/g, '');
    const files = [];

    const daily = Store.uploadsOf('daily').slice().sort((a, b) => (a.date < b.date ? -1 : 1));
    if (daily.length) {
      files.push([
        `btv_01_일별유료가입자_${stamp}.csv`,
        csvOf(['일자', '유료 가입자 수'], daily.map((r) => [r.date, r.paid])),
      ]);
    }

    const couponDaily = Store.uploadsOf('couponDaily').slice().sort((a, b) => (a.date < b.date ? -1 : 1));
    if (couponDaily.length) {
      files.push([
        `btv_02_일별쿠폰가입자_${stamp}.csv`,
        csvOf(
          ['일자', '쿠폰 정책번호', '쿠폰 정책명', '가입자 수'],
          couponDaily.map((r) => [r.date, r.policyId, r.policyName, r.count])
        ),
      ]);
    }

    const alloc = Store.uploadsOf('couponAlloc');
    if (alloc.length) {
      files.push([
        `btv_03_쿠폰할당내역_${stamp}.csv`,
        csvOf(
          ['일자', '쿠폰 정책번호', '쿠폰 정책명', '할당 수'],
          alloc.map((r) => [r.date, r.policyId, r.policyName, r.count])
        ),
      ]);
    }

    const events = Store.uploadsOf('events').slice().sort((a, b) => (a.startDate < b.startDate ? -1 : 1));
    if (events.length) {
      // 끊어서 진행한 캠페인은 구간마다 한 행으로 푼다 (성과·모수는 raw에서 자동 집계하므로 싣지 않는다)
      const rows = events.flatMap((e) =>
        (e.periods && e.periods.length ? e.periods : [{ startDate: e.startDate, endDate: e.endDate }]).map((p, i) => [
          e.name,
          e.purpose,
          e.type,
          e.discountRate,
          e.couponPolicy,
          (e.couponPolicyIds || []).join(','),
          p.startDate,
          p.endDate,
        ])
      );
      files.push([
        `btv_04_캠페인정보_${stamp}.csv`,
        csvOf(['이벤트명', '구분', '이벤트 종류', '할인율', '쿠폰 정책명', '쿠폰 정책번호', '시작일', '종료일'], rows),
      ]);
    }

    const seg = Store.uploadsOf('seg').slice().sort((a, b) => (a.month < b.month ? -1 : 1));
    if (seg.length) {
      files.push([
        `btv_06_Seg별실적_${stamp}.csv`,
        csvOf(['월', 'UI구분', 'SEG', '할당', '사용'], seg.map((r) => [r.month, r.ui, r.segment, r.allocated, r.used])),
      ]);
    }

    const prizes = Store.uploadsOf('prizes');
    if (prizes.length) {
      const nameOf = new Map(Store.uploadsOf('events').map((e) => [e.id, e.name]));
      files.push([
        `btv_05_경품_${stamp}.csv`,
        csvOf(
          ['이벤트명', '등급', '경품 종류', '경품 유형', '경품 단가', '경품 수량', '당첨자 선정 방식', '응모자 수', '당첨자 수', '실수령자 수', '경품 구매비', '실예산'],
          prizes.map((r) => [
            nameOf.get(r.event) || r.event,
            r.rank,
            r.kind,
            r.form,
            r.unitPrice,
            r.count,
            r.winnerPick,
            r.entrants,
            r.winners,
            r.receivers,
            r.purchaseCost,
            r.actualBudget,
          ])
        ),
      ]);
    }

    if (!files.length) {
      note('⚠ 내보낼 데이터가 없습니다. CSV를 올리거나 이벤트를 직접 입력해주세요.');
      return;
    }
    files.forEach(([name, content], i) => setTimeout(() => download(name, content), i * 250));
    note(`✔ ${files.length}개 파일을 내려받습니다 — ${files.map(([n]) => n).join(', ')}`);
  }

  /* ---------- 업로드 체크리스트 ---------- */
  // 올려야 하는 파일이 여러 개라 무엇을 올렸고 무엇이 비었는지 한 화면에서 본다
  const FILE_SPECS = [
    { kind: 'daily', no: '①', required: true, desc: '일자 × 유료 가입자 수 — 모든 화면의 기준이 되는 raw' },
    { kind: 'couponDaily', no: '②', required: true, desc: '일자 × 쿠폰 정책번호 × 가입자 수 — 캠페인 쿠폰 실적 자동 집계' },
    { kind: 'couponAlloc', no: '③', required: true, desc: '쿠폰 정책번호 × 할당 수 — 캠페인 모수 자동 집계' },
    { kind: 'events', no: '④', required: true, desc: '캠페인 속성만 (성과·모수는 ①②③에서 자동으로 채워짐)' },
    { kind: 'prizes', no: '⑤', required: false, desc: '경품이 걸린 캠페인만 — 등급별 단가·수량·응모자' },
    { kind: 'seg', no: '⑥', required: false, desc: '월 × UI × SEG 할당·사용 — Seg.별 실적 화면용' },
  ];

  let pendingKind = null;

  function lastUploadOf(kind) {
    return Store.uploadLog.find((l) => l.kind === kind) || null;
  }

  function updateDataBadge() {
    const req = FILE_SPECS.filter((f) => f.required);
    const done = req.filter((f) => Store.uploadsOf(f.kind).length).length;
    const badge = el('dataBadge');
    badge.textContent = `${done}/${req.length}`;
    badge.className = `badge ${done === req.length ? 'ok' : done ? 'part' : 'none'}`;
  }

  function renderDataPanel() {
    const rows = FILE_SPECS.map((f) => {
      const n = Store.uploadsOf(f.kind).length;
      const last = lastUploadOf(f.kind);
      const state = n ? 'done' : f.required ? 'todo' : 'skip';
      const mark = n ? '✔' : f.required ? '○' : '–';
      return `<tr class="${state}">
        <td class="mark">${mark}</td>
        <td class="left">
          <b>${f.no} ${KIND_LABEL[f.kind]}</b>${f.required ? '' : ' <span class="hint">선택</span>'}
          <div class="hint">${f.desc}</div>
        </td>
        <td class="left status">${
          n
            ? `<b>${n.toLocaleString()}행</b><div class="hint">${last ? `${last.file || '직접 입력'} · ${new Date(last.at).toLocaleString('ko-KR')}` : ''}</div>`
            : `<span class="${f.required ? 'warn' : 'hint'}">${f.required ? '아직 안 올림' : '없어도 동작'}</span>`
        }</td>
        <td class="acts">
          <div class="acts-wrap">
            <button type="button" class="btn small" data-act="upload" data-kind="${f.kind}">${n ? '추가 업로드' : '올리기'}</button>
            <button type="button" class="btn small ghost" data-act="sample" data-kind="${f.kind}">양식</button>
            ${n ? `<button type="button" class="btn small ghost" data-act="drop" data-kind="${f.kind}">비우기</button>` : ''}
          </div>
        </td>
      </tr>`;
    }).join('');

    el('dataBody').innerHTML = `
      <p class="hint panel-lead">같은 파일을 다시 올리면 같은 키(일자·정책번호·이벤트명)는 최신값으로 덮어쓰고 새 행만 늘어납니다. 2년치를 매주 다시 올릴 필요가 없습니다.</p>
      <table class="data-check"><tbody>${rows}</tbody></table>
      <p class="hint">${Store.isRealData ? `누적 — ${uploadSummary() || '없음'}` : '아직 올린 데이터가 없어 더미 데이터로 보고 있습니다.'}</p>`;
    updateDataBadge();
  }

  function openDataPanel() {
    renderDataPanel();
    el('dataModal').hidden = false;
  }

  function showUploadLog() {
    const log = Store.uploadLog;
    note(
      `<b>업로드 이력</b> (누적: ${uploadSummary() || '없음'})<br>` +
        (log.length
          ? log
              .map(
                (l) =>
                  `· ${new Date(l.at).toLocaleString('ko-KR')} — ${KIND_LABEL[l.kind]} ${l.file || ''} 신규 ${l.added} / 갱신 ${l.updated} (누적 ${l.total})`
              )
              .join('<br>')
          : '· 기록 없음')
    );
    el('dataModal').hidden = true;
  }

  function clearAllUploads() {
    if (!window.confirm('업로드한 데이터를 모두 지우고 더미 데이터로 되돌립니다. 계속할까요?')) return;
    Store.clearUploads();
    location.reload();
  }

  function note(html) {
    const box = el('uploadNote');
    box.innerHTML = html;
    box.hidden = false;
  }

  function syncMonthOptions() {
    ['perfMonth'].forEach((id) => {
      const sel = el(id);
      const existing = new Set([...sel.options].map((o) => o.value));
      BTV.months.forEach((m) => {
        if (!existing.has(m)) {
          sel.insertAdjacentHTML('beforeend', `<option value="${m}">${m.slice(0, 4)}년 ${BTV.util.monthLabel(m)}</option>`);
        }
      });
    });
  }

  function renderAll() {
    el('asOf').textContent = BTV.LAST_DATA_DAY;
    Perf.render();
    Compare.render();
  }

  const KIND_LABEL = { daily: '일별 유료 가입자', couponDaily: '일별 쿠폰 가입자', couponAlloc: '쿠폰 할당 내역', events: '캠페인 정보', seg: 'Seg.별 실적', prizes: '경품' };

  // 저장된 업로드를 순서대로 다시 적용한다 (캠페인이 있어야 이벤트별 일자를 붙일 수 있다)
  function applyStored() {
    if (!Store.isRealData) return false;
    BTV.clearSeed();
    ['daily', 'couponDaily', 'couponAlloc', 'events', 'seg', 'prizes'].forEach((kind) => {
      const rows = Store.uploadsOf(kind);
      if (!rows.length) return;
      if (kind === 'daily') BTV.replaceDays(rows);
      if (kind === 'events') BTV.replaceEvents(rows);
      if (kind === 'seg') BTV.replaceSegments(rows);
      if (kind === 'couponDaily') BTV.replaceCouponDaily(rows);
      if (kind === 'couponAlloc') BTV.replaceCouponAlloc(rows);
      if (kind === 'prizes') BTV.replacePrizes(rows);
    });
    BTV.recomputeEventDays();
    BTV.rollupPerformance();
    return true;
  }

  // 직접 입력분도 CSV와 같은 저장소에 넣어 함께 누적된다
  function saveManualEvent(row) {
    const { prizes, ...event } = row;
    Store.mergeUpload('events', [event], '직접 입력');
    // 등급을 지운 채 저장하면 옛 등급이 남지 않도록 이 이벤트의 경품은 통째로 교체한다
    Store.removeUploadRow('prizes', (r) => r.event === event.id);
    if (prizes && prizes.length) {
      Store.mergeUpload('prizes', prizes.map((p) => ({ ...p, event: event.id })), '직접 입력');
    }
    applyStored();
    syncMonthOptions();
    renderAll();
    note(`✔ ${event.name} 저장 완료 · <a href="#" id="showUploadLog">업로드 이력</a>`);
  }

  function removeManualEvent(id) {
    Store.removeUploadRow('events', (r) => r.id === id);
    Store.removeUploadRow('prizes', (r) => r.event === id);
    applyStored();
    renderAll();
    note('✔ 이벤트를 삭제했습니다.');
  }

  function applyUpload(kind, rows, fileName) {
    const result = Store.mergeUpload(kind, rows, fileName);
    applyStored();
    syncMonthOptions();
    renderAll();
    renderDataPanel();
    return result;
  }

  function handleFile(file) {
    const reader = new FileReader();
    reader.onload = () => {
      const buffer = reader.result;
      let text = new TextDecoder('utf-8').decode(buffer);
      // 엑셀에서 저장한 CP949 파일 대응
      if (text.includes('�')) text = new TextDecoder('euc-kr').decode(buffer);
      const rows = parseCsv(text);
      const kind = detectKind(rows);
      if (!kind) {
        note('⚠ 인식할 수 없는 형식입니다. "샘플 양식"의 컬럼명을 확인해주세요.');
        return;
      }
      const builders = { daily: buildDaily, couponDaily: buildCouponDaily, couponAlloc: buildCouponAlloc, events: buildEvents, seg: buildSeg, prizes: buildPrizes };
      const built = builders[kind](rows);
      if (!built.length) {
        note('⚠ 읽을 수 있는 데이터 행이 없습니다.');
        return;
      }
      if (kind !== 'daily' && !Store.isRealData && !Store.uploadsOf('daily').length) {
        note('⚠ 일자별 실적 CSV를 먼저 올려주세요. 일자별 데이터가 다른 화면의 기준이 됩니다.');
        return;
      }
      if (kind === 'prizes') {
        const touched = new Set(built.map((r) => r.event));
        Store.removeUploadRow('prizes', (r) => touched.has(r.event));
      }
      const picked = pendingKind;
      pendingKind = null;
      const result = applyUpload(kind, built, file.name);
      if (picked && picked !== kind) {
        note(`⚠ ${KIND_LABEL[picked]} 칸에 올렸지만 컬럼을 보니 <b>${KIND_LABEL[kind]}</b> 형식이라 그쪽으로 반영했습니다.`);
        return;
      }
      note(
        `✔ ${file.name} — ${KIND_LABEL[kind]} 신규 ${result.added}행 · 갱신 ${result.updated}행 (누적 ${result.total}행) · ` +
          `<a href="#" id="showUploadLog">업로드 이력</a> · <a href="#" id="clearUpload">전체 초기화</a>`
      );
    };
    reader.readAsArrayBuffer(file);
  }

  function download(filename, content) {
    const blob = new Blob([`﻿${content}`], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const PRIZE_SAMPLE = [
    '이벤트명,등급,경품 종류,경품 유형,경품 단가,경품 수량,당첨자 선정 방식,응모자 수,당첨자 수,실수령자 수,경품 구매비,실예산',
    '9월 추석 연휴 특가,1,숙박권,실물,100000,50,랜덤 추첨,8200,50,41,5000000,4100000',
    '9월 추석 연휴 특가,2,상품권,디지털,20000,300,랜덤 추첨,8200,300,246,6000000,4920000',
    '9월 추석 연휴 특가,3,티켓,디지털,10000,1000,랜덤 추첨,8200,1000,742,10000000,7420000',
  ].join('\n');
  const SEG_SAMPLE = [
    '월,UI구분,SEG,할당,사용',
    '2026-09,541 이상,신규가입,135000,1215',
    '2026-09,541 이상,PPM 유료,90000,764',
    '2026-09,540 이하,신규가입,80000,747',
  ].join('\n');
  // 쿠폰 컬럼은 선택 — 예전 정리 양식(일자, 유료신규, 쿠폰가입)도 그대로 읽힌다
  const DAILY_SAMPLE = ['일자,유료 가입자 수', '2026-09-01,412', '2026-09-02,388', '2026-09-03,401'].join('\n');
  const COUPON_SAMPLE = [
    '일자,쿠폰 정책번호,쿠폰 정책명,가입자 수',
    '2026-09-01,CP1001,쿠폰 A형,120',
    '2026-09-01,CP1002,쿠폰 B형,67',
    '2026-09-02,CP1001,쿠폰 A형,131',
  ].join('\n');
  const EVENT_SAMPLE = [
    '이벤트명,구분,이벤트 종류,할인율,쿠폰 정책명,쿠폰 정책번호,시작일,종료일',
    '9월 추석 연휴 특가,유료 신규,할인+추첨경품,30,쿠폰 A형,CP1001,2026-09-05,2026-09-14',
    '9월 가을맞이 프로모션,유료+무료,할인+전원경품,20,쿠폰 B형,"CP1002,CP1003",2026-09-18,2026-09-24',
  ].join('\n');

  const ALLOC_SAMPLE = [
    '쿠폰 정책번호,쿠폰 정책명,할당 수',
    'CP1001,쿠폰 A형,120000',
    'CP1002,쿠폰 B형,95000',
    'CP1003,쿠폰 C형,40000',
  ].join('\n');

  const SAMPLES = {
    daily: { file: 'btv_01_일별유료가입자_양식.csv', content: DAILY_SAMPLE },
    couponDaily: { file: 'btv_02_일별쿠폰가입자_양식.csv', content: COUPON_SAMPLE },
    couponAlloc: { file: 'btv_03_쿠폰할당내역_양식.csv', content: ALLOC_SAMPLE },
    events: { file: 'btv_04_캠페인정보_양식.csv', content: EVENT_SAMPLE },
    seg: { file: 'btv_06_Seg별실적_양식.csv', content: SEG_SAMPLE },
    prizes: { file: 'btv_05_경품_양식.csv', content: PRIZE_SAMPLE },
  };

  /* ---------- 부트 ---------- */
  function uploadSummary() {
    return ['daily', 'couponDaily', 'couponAlloc', 'events', 'seg', 'prizes']
      .map((kind) => ({ kind, n: Store.uploadsOf(kind).length }))
      .filter((x) => x.n)
      .map((x) => `${KIND_LABEL[x.kind]} ${x.n.toLocaleString()}행`)
      .join(' · ');
  }

  function boot() {
    const usingReal = applyStored();

    el('asOf').textContent = BTV.LAST_DATA_DAY;
    updateDataBadge();
    Perf.init();
    Compare.init();
    EventForm.init();

    if (usingReal) {
      note(
        `✔ 업로드한 실데이터가 적용되어 있습니다 — ${uploadSummary()} · ` +
          `<a href="#" id="showUploadLog">업로드 이력</a> · <a href="#" id="clearUpload">전체 초기화</a>`
      );
    }

    el('viewTabs').addEventListener('click', (e) => {
      const view = e.target.dataset.view;
      if (!view) return;
      document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.view === view));
      document.querySelectorAll('.view').forEach((v) => v.classList.toggle('active', v.id === `view-${view}`));
      // 숨겨진 상태에서 그려진 차트의 크기를 바로잡는다
      if (view === 'compare') Compare.render();
      if (view === 'perf') Perf.render();
    });

    el('csvInput').addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) handleFile(file);
      e.target.value = '';
    });

    el('exportBtn').addEventListener('click', exportAll);
    el('dataBtn').addEventListener('click', openDataPanel);
    el('dataClose').addEventListener('click', () => (el('dataModal').hidden = true));
    el('dataModal').addEventListener('click', (e) => {
      if (e.target.id === 'dataModal') el('dataModal').hidden = true;
    });
    el('dataLogBtn').addEventListener('click', showUploadLog);
    el('dataResetBtn').addEventListener('click', clearAllUploads);
    el('dataBody').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-act]');
      if (!btn) return;
      const { act, kind } = btn.dataset;
      if (act === 'sample') download(SAMPLES[kind].file, SAMPLES[kind].content);
      if (act === 'upload') {
        pendingKind = kind;
        el('csvInput').click();
      }
      if (act === 'drop') {
        if (!window.confirm(`${KIND_LABEL[kind]} 데이터를 지웁니다. 계속할까요?`)) return;
        Store.removeUploadRow(kind, () => true);
        applyStored();
        syncMonthOptions();
        renderAll();
        renderDataPanel();
      }
    });

    el('uploadNote').addEventListener('click', (e) => {
      if (e.target.dataset.sample) {
        e.preventDefault();
        const sample = SAMPLES[e.target.dataset.sample];
        download(sample.file, sample.content);
      }
      if (e.target.id === 'showUploadLog') {
        e.preventDefault();
        const log = Store.uploadLog;
        note(
          `<b>업로드 이력</b> (누적: ${uploadSummary() || '없음'})<br>` +
            (log.length
              ? log
                  .map(
                    (l) =>
                      `· ${new Date(l.at).toLocaleString('ko-KR')} — ${KIND_LABEL[l.kind]} ${l.file || ''} 신규 ${l.added} / 갱신 ${l.updated} (누적 ${l.total})`
                  )
                  .join('<br>')
              : '· 기록 없음') +
            `<br><a href="#" id="clearUpload">전체 초기화</a>`
        );
      }
      if (e.target.id === 'clearUpload') {
        e.preventDefault();
        if (!window.confirm('업로드한 데이터를 모두 지우고 더미 데이터로 되돌립니다. 계속할까요?')) return;
        Store.clearUploads();
        location.reload();
      }
    });

  }

  global.App = { saveManualEvent, removeManualEvent };

  document.addEventListener('DOMContentLoaded', boot);
})(window);
