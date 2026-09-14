(function () {
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
    paid: ['paid', '유료신규', '유료 신규', '유료'],
    coupon: ['coupon', '쿠폰가입', '쿠폰 가입', '쿠폰'],
  };
  const SEG_ALIAS = {
    month: ['month', '월', '기준월'],
    ui: ['ui', 'ui구분', 'ui 구분'],
    segment: ['seg', 'segment', '세그먼트'],
    allocated: ['allocated', '할당'],
    used: ['used', '사용'],
  };
  const EVENT_ALIAS = {
    id: ['id', 'event_id', '이벤트id'],
    name: ['name', 'event_name', '이벤트명'],
    purpose: ['purpose', '구분', '목적'],
    couponPolicy: ['coupon_policy', '쿠폰정책명', '쿠폰 정책명'],
    prizeMethod: ['prize_method', '경품방식', '경품 방식'],
    prizeForm: ['prize_form', '경품유형', '경품 유형'],
    winnerPick: ['winner_pick', '당첨자선정방식', '당첨자 선정 방식'],
    paidSignups: ['paid_signups', '유료가입자수', '유료 가입자 수'],
    couponSignups: ['coupon_signups', '쿠폰가입자수', '쿠폰 가입자 수'],
    type: ['type', '이벤트타입', '타입', '이벤트종류', '이벤트 종류'],
    discountRate: ['discount_rate', '할인율'],
    prizeKind: ['prize_kind', '경품종류', '경품 종류'],
    prizeUnitPrice: ['prize_unit_price', '경품단가', '경품 단가'],
    startDate: ['start_date', '시작일'],
    endDate: ['end_date', '종료일'],
    pool: ['pool', '모수'],
    signups: ['signups', '가입자수', '가입자 수'],
    entrants: ['entrants', '응모자수', '응모자 수'],
    prizeCount: ['prize_count', '경품수량', '경품 수량'],
    winners: ['winners', '당첨자수', '당첨자 수'],
    actualReceivers: ['actual_receivers', '실수령자수', '실수령자 수'],
    prizePurchaseCost: ['prize_purchase_cost', '경품구매비', '경품 구매비'],
    actualBudget: ['actual_budget', '실예산'],
  };

  const val = (row, aliases) => {
    const key = aliases.find((a) => row[a] !== undefined && row[a] !== '');
    return key ? row[key] : '';
  };
  const toNum = (v) => {
    const n = Number(String(v).replace(/[,%원\s]/g, ''));
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

  function buildDaily(rows) {
    return rows
      .map((r) => ({
        date: toDate(val(r, DAILY_ALIAS.date)),
        paid: toNum(val(r, DAILY_ALIAS.paid)) || 0,
        coupon: toNum(val(r, DAILY_ALIAS.coupon)) || 0,
      }))
      .filter((r) => r.date);
  }

  function buildEvents(rows) {
    return rows
      .map((r, i) => {
        const startDate = toDate(val(r, EVENT_ALIAS.startDate));
        const endDate = toDate(val(r, EVENT_ALIAS.endDate));
        if (!startDate || !endDate) return null;
        // 유료·쿠폰을 따로 주면 합계를 거기서 만든다
        const paid = toNum(val(r, EVENT_ALIAS.paidSignups));
        const coupon = toNum(val(r, EVENT_ALIAS.couponSignups));
        const signups = paid != null || coupon != null ? (paid || 0) + (coupon || 0) : toNum(val(r, EVENT_ALIAS.signups));
        const dates = BTV.util.eachDay(startDate, endDate);
        const restDays = dates.filter(BTV.util.isRestDay).length;
        const weekdayDays = dates.length - restDays;
        // 휴일/평일 분해값이 없으면 휴일 가중 1.25로 배분
        const restUnits = restDays * 1.25;
        const share = restUnits + weekdayDays;
        return {
          id: val(r, EVENT_ALIAS.id) || `UP-${startDate.replace(/-/g, '')}-${i}`,
          name: val(r, EVENT_ALIAS.name) || `업로드 이벤트 ${i + 1}`,
          type: val(r, EVENT_ALIAS.type) || '할인',
          discountRate: toNum(val(r, EVENT_ALIAS.discountRate)) || 0,
          prizeKind: val(r, EVENT_ALIAS.prizeKind) || '없음',
          prizeUnitPrice: toNum(val(r, EVENT_ALIAS.prizeUnitPrice)) || 0,
          startDate,
          endDate,
          purpose: val(r, EVENT_ALIAS.purpose) || '-',
          couponPolicy: val(r, EVENT_ALIAS.couponPolicy) || '-',
          prizeMethod: val(r, EVENT_ALIAS.prizeMethod) || '없음',
          prizeForm: val(r, EVENT_ALIAS.prizeForm) || '-',
          winnerPick: val(r, EVENT_ALIAS.winnerPick) || '-',
          paidSignups: toNum(val(r, EVENT_ALIAS.paidSignups)),
          couponSignups: toNum(val(r, EVENT_ALIAS.couponSignups)),
          pool: toNum(val(r, EVENT_ALIAS.pool)) || 0,
          signups,
          restSignups: signups != null && share ? Math.round((signups * restUnits) / share) : null,
          weekdaySignups: signups != null && share ? Math.round((signups * weekdayDays) / share) : null,
          entrants: toNum(val(r, EVENT_ALIAS.entrants)),
          prizeCount: toNum(val(r, EVENT_ALIAS.prizeCount)),
          winners: toNum(val(r, EVENT_ALIAS.winners)) || toNum(val(r, EVENT_ALIAS.prizeCount)),
          actualReceivers: toNum(val(r, EVENT_ALIAS.actualReceivers)),
          prizePurchaseCost: toNum(val(r, EVENT_ALIAS.prizePurchaseCost)),
          actualBudget: toNum(val(r, EVENT_ALIAS.actualBudget)),
          status: endDate <= BTV.LAST_DATA_DAY ? '종료' : startDate <= BTV.LAST_DATA_DAY ? '진행중' : '예정',
        };
      })
      .filter(Boolean);
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

  const KIND_LABEL = { daily: '일자별 실적', events: '캠페인', seg: 'Seg.별 실적' };

  // 저장된 업로드를 순서대로 다시 적용한다 (캠페인이 있어야 이벤트별 일자를 붙일 수 있다)
  function applyStored() {
    if (!Store.isRealData) return false;
    BTV.clearSeed();
    ['daily', 'events', 'seg'].forEach((kind) => {
      const rows = Store.uploadsOf(kind);
      if (!rows.length) return;
      if (kind === 'daily') BTV.replaceDays(rows);
      if (kind === 'events') BTV.replaceEvents(rows);
      if (kind === 'seg') BTV.replaceSegments(rows);
    });
    BTV.recomputeEventDays();
    return true;
  }

  function applyUpload(kind, rows, fileName) {
    const result = Store.mergeUpload(kind, rows, fileName);
    applyStored();
    syncMonthOptions();
    renderAll();
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
      const builders = { daily: buildDaily, events: buildEvents, seg: buildSeg };
      const built = builders[kind](rows);
      if (!built.length) {
        note('⚠ 읽을 수 있는 데이터 행이 없습니다.');
        return;
      }
      if (kind !== 'daily' && !Store.isRealData && !Store.uploadsOf('daily').length) {
        note('⚠ 일자별 실적 CSV를 먼저 올려주세요. 일자별 데이터가 다른 화면의 기준이 됩니다.');
        return;
      }
      const result = applyUpload(kind, built, file.name);
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

  const SEG_SAMPLE = [
    '월,UI구분,SEG,할당,사용',
    '2026-09,541 이상,신규가입,135000,1215',
    '2026-09,541 이상,PPM 유료,90000,764',
    '2026-09,540 이하,신규가입,80000,747',
  ].join('\n');
  const DAILY_SAMPLE = ['일자,유료신규,쿠폰가입', '2026-09-01,412,187', '2026-09-02,388,171', '2026-09-03,401,180'].join('\n');
  const EVENT_SAMPLE = [
    '이벤트명,구분,이벤트 종류,할인율,쿠폰 정책명,경품 방식,경품 유형,경품 종류,경품 단가,시작일,종료일,모수,유료 가입자 수,쿠폰 가입자 수,응모자 수,경품 수량,당첨자 선정 방식,실수령자 수,경품 구매비,실예산',
    '9월 추석 연휴 특가,유료 신규,할인+추첨경품,30,쿠폰 A형,추첨,디지털,상품권,20000,2026-09-05,2026-09-14,120000,2560,1280,8200,300,랜덤 추첨,246,6000000,4920000',
    '9월 가을맞이 프로모션,유료+무료,할인+전원경품,20,쿠폰 B형,전원 지급,디지털,티켓,10000,2026-09-18,2026-09-24,95000,1480,730,,2210,전원 지급,1832,22100000,18320000',
  ].join('\n');

  const SAMPLES = {
    daily: { file: 'btv_01_일자별실적_양식.csv', content: DAILY_SAMPLE },
    events: { file: 'btv_02_캠페인_양식.csv', content: EVENT_SAMPLE },
    seg: { file: 'btv_03_Seg별실적_양식.csv', content: SEG_SAMPLE },
  };

  /* ---------- 부트 ---------- */
  function uploadSummary() {
    return ['daily', 'events', 'seg']
      .map((kind) => ({ kind, n: Store.uploadsOf(kind).length }))
      .filter((x) => x.n)
      .map((x) => `${KIND_LABEL[x.kind]} ${x.n.toLocaleString()}행`)
      .join(' · ');
  }

  function boot() {
    const usingReal = applyStored();

    el('asOf').textContent = BTV.LAST_DATA_DAY;
    Perf.init();
    Compare.init();

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

    el('sampleBtn').addEventListener('click', () => {
      note(
        '같은 컬럼명으로 채워 올리면 됩니다. 파일은 순서대로 올려주세요 — ①이 다른 화면의 기준이 됩니다.<br>' +
          '<a href="#" data-sample="daily">① 일자별 실적</a> · <a href="#" data-sample="events">② 캠페인</a> · ' +
          '<a href="#" data-sample="seg">③ Seg.별 실적</a>'
      );
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

  document.addEventListener('DOMContentLoaded', boot);
})();
