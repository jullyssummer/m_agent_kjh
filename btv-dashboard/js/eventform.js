/* 이벤트 직접 입력 — 운영 중에는 CSV 대신 한 건씩 등록·수정한다.
   저장 위치는 CSV 업로드와 같아서(Store.uploads) 두 방식이 섞여도 누적된다. */
(function (global) {
  'use strict';

  const el = (id) => document.getElementById(id);
  let editingId = null;
  let editingPool = 0;
  let editingAutoPool = true;

  const options = (list, selected) =>
    list.map((v) => `<option value="${v}"${v === selected ? ' selected' : ''}>${v}</option>`).join('');

  function periodRow(p = {}) {
    return `<div class="form-row" data-period-row>
      <label>시작일<input type="date" class="p-start" value="${p.startDate || ''}"></label>
      <label>종료일<input type="date" class="p-end" value="${p.endDate || ''}"></label>
      <button type="button" class="icon-btn row-remove" data-remove-row title="삭제">×</button>
    </div>`;
  }

  function prizeRow(p = {}) {
    return `<div class="form-row" data-prize-row>
      <label class="rank-field">등급<input type="number" class="z-rank" min="1" value="${p.rank || 1}"></label>
      <label>종류<select class="z-kind">${options(['없음', ...BTV.PRIZE_KINDS], p.kind)}</select></label>
      <label>유형<select class="z-form">${options(['디지털', '실물', '-'], p.form)}</select></label>
      <label>단가<input type="number" class="z-price" min="0" step="1000" value="${p.unitPrice || 0}"></label>
      <label>수량<input type="number" class="z-count" min="0" value="${p.count || 0}"></label>
      <label>선정 방식<select class="z-pick">${options(['-', '랜덤 추첨', '선착순', '전원 지급'], p.winnerPick)}</select></label>
      <label>당첨자 수<input type="number" class="z-winners" min="0" value="${p.winners != null ? p.winners : ''}"></label>
      <label>실수령자 수<input type="number" class="z-receivers" min="0" value="${p.receivers != null ? p.receivers : ''}"></label>
      <label>구매비<input type="number" class="z-cost" min="0" step="1000" value="${p.purchaseCost != null ? p.purchaseCost : ''}"></label>
      <label>실예산<input type="number" class="z-budget" min="0" step="1000" value="${p.actualBudget != null ? p.actualBudget : ''}"></label>
      <button type="button" class="icon-btn row-remove" data-remove-row title="삭제">×</button>
    </div>`;
  }

  // 등급은 경품이 2개 이상일 때만 의미가 있다
  function syncRankFields() {
    const rows = el('ef-prizes').querySelectorAll('[data-prize-row]');
    rows.forEach((row, i) => {
      row.querySelector('.rank-field').hidden = rows.length < 2;
      if (rows.length < 2) row.querySelector('.z-rank').value = 1;
      else if (!row.querySelector('.z-rank').value) row.querySelector('.z-rank').value = i + 1;
    });
  }

  function open(eventId) {
    editingId = eventId || null;
    const ev = eventId ? BTV.allEvents().find((e) => e.id === eventId) : null;

    el('eventFormTitle').textContent = ev ? `이벤트 수정 — ${ev.name}` : '이벤트 직접 입력';
    el('eventFormDelete').hidden = !ev;
    el('ef-error').hidden = true;

    el('ef-purpose').innerHTML = options(BTV.PURPOSES, ev ? ev.purpose : null);
    el('ef-type').innerHTML = options(BTV.TYPES, ev ? ev.type : null);

    editingPool = ev && !ev.autoPool ? ev.pool : 0;
    editingAutoPool = !ev || !!ev.autoPool;
    el('ef-name').value = ev ? ev.name : '';
    el('ef-discount').value = ev ? ev.discountRate : 0;
    el('ef-policy').value = ev && ev.couponPolicy !== '-' ? ev.couponPolicy : '';
    el('ef-policyIds').value = ev && ev.couponPolicyIds ? ev.couponPolicyIds.join(', ') : '';
    el('ef-paid').value = ev && ev.paidSignups != null ? ev.paidSignups : '';
    el('ef-coupon').value = ev && ev.couponSignups != null ? ev.couponSignups : '';
    el('ef-entrants').value = ev && ev.entrants != null ? ev.entrants : '';

    el('ef-periods').innerHTML = (ev ? BTV.periodsOf(ev) : [{}]).map(periodRow).join('');
    el('ef-prizes').innerHTML = ev && ev.prizes.length ? ev.prizes.map(prizeRow).join('') : '';

    syncRankFields();
    el('eventFormModal').hidden = false;
    el('ef-name').focus();
  }

  function collect() {
    const periods = [...el('ef-periods').querySelectorAll('[data-period-row]')]
      .map((row) => ({
        startDate: row.querySelector('.p-start').value,
        endDate: row.querySelector('.p-end').value,
      }))
      .filter((p) => p.startDate && p.endDate)
      .sort((a, b) => (a.startDate < b.startDate ? -1 : 1));

    // 응모자 수는 이벤트에서 한 번 입력받아 각 등급에 같이 저장한다 (보통 응모 풀이 하나다)
    const entrantsValue = el('ef-entrants').value === '' ? null : Number(el('ef-entrants').value);
    const prizes = [...el('ef-prizes').querySelectorAll('[data-prize-row]')]
      .map((row) => {
        const num = (cls) => {
          const raw = row.querySelector(cls).value;
          return raw === '' ? null : Number(raw);
        };
        const count = num('.z-count') || 0;
        const unitPrice = num('.z-price') || 0;
        const receivers = num('.z-receivers');
        return {
          rank: num('.z-rank') || 1,
          kind: row.querySelector('.z-kind').value,
          form: row.querySelector('.z-form').value,
          unitPrice,
          count,
          winners: num('.z-winners') != null ? num('.z-winners') : count,
          winnerPick: row.querySelector('.z-pick').value,
          entrants: entrantsValue,
          receivers: receivers != null ? receivers : count,
          purchaseCost: num('.z-cost') != null ? num('.z-cost') : count * unitPrice,
          actualBudget: num('.z-budget') != null ? num('.z-budget') : (receivers != null ? receivers : count) * unitPrice,
        };
      })
      .filter((p) => p.kind !== '없음' && p.count > 0)
      .sort((a, b) => a.rank - b.rank);

    const name = el('ef-name').value.trim();
    const paid = el('ef-paid').value === '' ? null : Number(el('ef-paid').value);
    const coupon = el('ef-coupon').value === '' ? null : Number(el('ef-coupon').value);
    const signups = paid != null || coupon != null ? (paid || 0) + (coupon || 0) : null;
    const type = el('ef-type').value;
    const lead = prizes.slice().sort((a, b) => b.unitPrice - a.unitPrice)[0];

    // 휴일/평일 분해값은 따로 받지 않고 기간 구성으로 나눈다 (CSV 업로드와 같은 방식)
    const dates = periods.flatMap((p) => BTV.util.eachDay(p.startDate, p.endDate));
    const restDays = dates.filter(BTV.util.isRestDay).length;
    const weekdayDays = dates.length - restDays;
    const restUnits = restDays * 1.25;
    const share = restUnits + weekdayDays;

    return {
      id: editingId || `MN-${Date.now().toString(36)}`,
      name,
      purpose: el('ef-purpose').value,
      type,
      couponPolicy: el('ef-policy').value.trim() || '-',
      couponPolicyIds: el('ef-policyIds').value.split(/[,;|]/).map((v) => v.trim()).filter(Boolean),
      autoRollup: paid == null && coupon == null,
      prizeMethod:
        type.includes('전원경품') && type.includes('추첨경품')
          ? '전원+추첨'
          : type.includes('전원경품')
            ? '전원 지급'
            : type.includes('추첨경품')
              ? '추첨'
              : '없음',
      prizeForm: lead ? lead.form : '-',
      discountRate: Number(el('ef-discount').value) || 0,
      prizeKind: lead ? lead.kind : '없음',
      prizeUnitPrice: lead ? lead.unitPrice : 0,
      startDate: periods.length ? periods[0].startDate : '',
      endDate: periods.length ? periods[periods.length - 1].endDate : '',
      periods,
      // 모수는 쿠폰 할당 내역에서 잡는다. CSV로 값을 직접 받은 이벤트만 그 값을 지킨다.
      pool: editingPool,
      autoPool: editingAutoPool,
      paidSignups: paid,
      couponSignups: coupon,
      signups,
      restSignups: signups != null && share ? Math.round((signups * restUnits) / share) : null,
      weekdaySignups: signups != null && share ? Math.round((signups * weekdayDays) / share) : null,
      entrants: entrantsValue,
      prizes,
      status: '',
    };
  }

  function save() {
    const row = collect();
    const fail = (msg) => {
      el('ef-error').textContent = msg;
      el('ef-error').hidden = false;
    };
    if (!row.name) return fail('이벤트명을 입력해주세요.');
    if (!row.periods.length) return fail('기간을 최소 한 구간 입력해주세요.');
    if (row.periods.some((p) => p.startDate > p.endDate)) return fail('종료일이 시작일보다 빠른 구간이 있습니다.');

    row.status = row.endDate <= BTV.LAST_DATA_DAY ? '종료' : row.startDate <= BTV.LAST_DATA_DAY ? '진행중' : '예정';
    App.saveManualEvent(row);
    el('eventFormModal').hidden = true;
  }

  function remove() {
    if (!editingId) return;
    if (!window.confirm('이 이벤트를 삭제할까요? 되돌릴 수 없습니다.')) return;
    App.removeManualEvent(editingId);
    el('eventFormModal').hidden = true;
  }

  function init() {
    el('eventAdd').addEventListener('click', () => open(null));
    el('eventFormClose').addEventListener('click', () => {
      el('eventFormModal').hidden = true;
    });
    el('eventFormModal').addEventListener('click', (e) => {
      if (e.target.id === 'eventFormModal') el('eventFormModal').hidden = true;
    });
    el('eventFormSave').addEventListener('click', save);
    el('eventFormDelete').addEventListener('click', remove);
    el('ef-addPeriod').addEventListener('click', () => el('ef-periods').insertAdjacentHTML('beforeend', periodRow()));
    el('ef-addPrize').addEventListener('click', () => {
      const next = el('ef-prizes').querySelectorAll('[data-prize-row]').length + 1;
      el('ef-prizes').insertAdjacentHTML('beforeend', prizeRow({ rank: next }));
      syncRankFields();
    });
    el('eventForm').addEventListener('click', (e) => {
      if (e.target.dataset.removeRow != null) {
        e.target.closest('.form-row').remove();
        syncRankFields();
      }
    });
  }

  global.EventForm = { init, open };
})(window);
