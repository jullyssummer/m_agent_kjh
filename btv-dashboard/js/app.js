(function () {
  'use strict';

  const el = (id) => document.getElementById(id);

  // 마감 예측은 아직 검증 중이라 잠가 둔다. 코드를 바꾸려면 이 값을 수정.
  // 정적 페이지라 화면을 가릴 뿐, 소스를 열면 보이는 수준의 잠금이다.
  const FORECAST_CODE = 'btv0913';
  const UNLOCK_KEY = 'btvDashboard.forecastUnlocked';

  function setForecastLock(unlocked) {
    el('forecastLock').hidden = unlocked;
    el('forecastBody').hidden = !unlocked;
    if (unlocked) Forecast.render();
  }

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
  const EVENT_ALIAS = {
    id: ['id', 'event_id', '이벤트id'],
    name: ['name', 'event_name', '이벤트명'],
    type: ['type', '이벤트타입', '타입'],
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
    if (has(EVENT_ALIAS.name) || has(EVENT_ALIAS.id)) return 'events';
    if (has(DAILY_ALIAS.date)) return 'daily';
    return null;
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
        const signups = toNum(val(r, EVENT_ALIAS.signups));
        const dates = BTV.util.eachDay(startDate, endDate);
        const weekendDays = dates.filter(BTV.util.isWeekend).length;
        const weekdayDays = dates.length - weekendDays;
        // 주말/평일 분해값이 없으면 주말 가중 1.25로 배분
        const weekendUnits = weekendDays * 1.25;
        const share = weekendUnits + weekdayDays;
        return {
          id: val(r, EVENT_ALIAS.id) || `UP-${startDate.replace(/-/g, '')}-${i}`,
          name: val(r, EVENT_ALIAS.name) || `업로드 이벤트 ${i + 1}`,
          type: val(r, EVENT_ALIAS.type) || '할인',
          discountRate: toNum(val(r, EVENT_ALIAS.discountRate)) || 0,
          prizeKind: val(r, EVENT_ALIAS.prizeKind) || '없음',
          prizeUnitPrice: toNum(val(r, EVENT_ALIAS.prizeUnitPrice)) || 0,
          startDate,
          endDate,
          pool: toNum(val(r, EVENT_ALIAS.pool)) || 0,
          signups,
          weekendSignups: signups != null && share ? Math.round((signups * weekendUnits) / share) : null,
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
    ['perfMonth', 'forecastMonth'].forEach((id) => {
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
    if (!el('forecastBody').hidden) Forecast.render();
  }

  function applyUpload(kind, rows, persist) {
    if (kind === 'daily') BTV.replaceDays(rows);
    else BTV.replaceEvents(rows);
    if (persist) Store.saveUpload(kind, rows);
    syncMonthOptions();
    renderAll();
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
      const built = kind === 'daily' ? buildDaily(rows) : buildEvents(rows);
      if (!built.length) {
        note('⚠ 읽을 수 있는 데이터 행이 없습니다.');
        return;
      }
      applyUpload(kind, built, true);
      note(
        `✔ ${file.name} — ${kind === 'daily' ? '일자별 실적' : '캠페인 실적'} ${built.length}행 반영 완료 · <a href="#" id="clearUpload">업로드 초기화</a>`
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

  const DAILY_SAMPLE = ['일자,유료신규,쿠폰가입', '2026-09-01,412,187', '2026-09-02,388,171', '2026-09-03,401,180'].join('\n');
  const EVENT_SAMPLE = [
    '이벤트명,타입,할인율,경품종류,경품단가,시작일,종료일,모수,가입자수,응모자수,경품수량,실수령자수,경품구매비,실예산',
    '9월 추석 연휴 특가,할인+추첨경품,30,상품권,20000,2026-09-05,2026-09-14,120000,3840,8200,300,246,6000000,4920000',
    '9월 가을맞이 프로모션,할인+전원경품,20,티켓,10000,2026-09-18,2026-09-24,95000,2210,,2210,1832,22100000,18320000',
  ].join('\n');

  /* ---------- 부트 ---------- */
  function boot() {
    const uploads = Store.state.uploads || {};
    if (uploads.daily) BTV.replaceDays(uploads.daily);
    if (uploads.events) BTV.replaceEvents(uploads.events);

    el('asOf').textContent = BTV.LAST_DATA_DAY;
    Perf.init();
    Compare.init();
    Forecast.init();
    Chat.init();

    if (uploads.daily || uploads.events) {
      note(
        `✔ 이전에 업로드한 CSV가 적용되어 있습니다 (${[uploads.daily && '일자별 실적', uploads.events && '캠페인 실적'].filter(Boolean).join(', ')}) · <a href="#" id="clearUpload">업로드 초기화</a>`
      );
    }

    el('viewTabs').addEventListener('click', (e) => {
      const view = e.target.dataset.view;
      if (!view) return;
      document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.view === view));
      document.querySelectorAll('.view').forEach((v) => v.classList.toggle('active', v.id === `view-${view}`));
      Chat.setContext(view);
      // 숨겨진 상태에서 그려진 차트의 크기를 바로잡는다
      if (view === 'compare') Compare.render();
      if (view === 'forecast' && !el('forecastBody').hidden) Forecast.render();
      if (view === 'perf') Perf.render();
    });

    setForecastLock(localStorage.getItem(UNLOCK_KEY) === '1');
    el('forecastUnlock').addEventListener('submit', (e) => {
      e.preventDefault();
      const ok = el('forecastCode').value.trim() === FORECAST_CODE;
      el('forecastError').hidden = ok;
      el('forecastCode').value = '';
      if (!ok) return;
      localStorage.setItem(UNLOCK_KEY, '1');
      setForecastLock(true);
    });
    el('forecastRelock').addEventListener('click', () => {
      localStorage.removeItem(UNLOCK_KEY);
      setForecastLock(false);
    });

    el('csvInput').addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) handleFile(file);
      e.target.value = '';
    });

    el('sampleBtn').addEventListener('click', () => {
      note(
        '샘플 양식을 내려받아 같은 컬럼명으로 채운 뒤 업로드하세요. ' +
          '<a href="#" data-sample="daily">일자별 실적 양식</a> · <a href="#" data-sample="events">캠페인 실적 양식</a>'
      );
    });

    el('uploadNote').addEventListener('click', (e) => {
      if (e.target.dataset.sample) {
        e.preventDefault();
        const kind = e.target.dataset.sample;
        download(kind === 'daily' ? 'btv_일자별실적_양식.csv' : 'btv_캠페인실적_양식.csv', kind === 'daily' ? DAILY_SAMPLE : EVENT_SAMPLE);
      }
      if (e.target.id === 'clearUpload') {
        e.preventDefault();
        Store.clearUploads();
        location.reload();
      }
    });

    const toggleChat = () => {
      document.body.classList.toggle('chat-open');
      setTimeout(() => Object.values(Charts.registry).forEach((c) => c.resize()), 60);
    };
    el('chatToggle').addEventListener('click', toggleChat);
    el('chatClose').addEventListener('click', toggleChat);
    document.body.classList.add('chat-open');
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
