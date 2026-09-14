(function (global) {
  'use strict';

  const registry = {};
  const COLOR = {
    paid: '#0d5bd1',
    coupon: '#12a594',
    forecast: '#f0a202',
    grid: '#e3e8f0',
    muted: '#6b7688',
  };

  // 일자별 데이터 레이블: 유료는 포인트 위, 쿠폰은 아래.
  // 선·음영 위에서도 읽히도록 흰색 테두리(할로)를 깔고 그린다.
  const valueLabels = {
    id: 'valueLabels',
    afterDatasetsDraw(chart) {
      if (!chart.$showLabels) return;
      const { ctx } = chart;
      ctx.save();
      ctx.font = '700 10px "Malgun Gothic", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round';
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = 'rgba(255,255,255,.95)';
      chart.data.datasets.forEach((ds, di) => {
        if (ds.hideLabels) return;
        const meta = chart.getDatasetMeta(di);
        if (meta.hidden) return;
        const below = di % 2 === 1;
        const values = ds.data.filter((v) => v != null);
        const peak = values.length ? Math.max(...values) : null;
        const step = chart.$labelStep || 1;
        meta.data.forEach((pt, i) => {
          const v = ds.data[i];
          if (v == null) return;
          // 구간이 길어지면 레이블을 솎아 낸다 (최고점은 항상 표시)
          if (step > 1 && i % step !== 0 && v !== peak) return;
          const text = Math.round(v).toLocaleString();
          const y = pt.y + (below ? 14 : -11);
          ctx.strokeText(text, pt.x, y);
          ctx.fillStyle = v === peak ? '#1c2536' : ds.borderColor || COLOR.muted;
          ctx.fillText(text, pt.x, y);
          if (v === peak) {
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, 4.5, 0, Math.PI * 2);
            ctx.fillStyle = ds.borderColor;
            ctx.fill();
            ctx.lineWidth = 2;
            ctx.strokeStyle = '#fff';
            ctx.stroke();
            ctx.lineWidth = 3.5;
            ctx.strokeStyle = 'rgba(255,255,255,.95)';
          }
        });
      });
      ctx.restore();
    },
  };

  // 평일 / 주말 / 공휴일 구분 음영. 이벤트 리본보다 먼저 깔아 색이 서로 묻히지 않게 한다.
  const restDays = {
    id: 'restDays',
    beforeDatasetsDraw(chart) {
      const types = chart.$dayTypes;
      if (!types || !types.length) return;
      const { ctx, chartArea, scales } = chart;
      const half = (scales.x.getPixelForValue(1) - scales.x.getPixelForValue(0)) / 2 || 6;
      ctx.save();
      types.forEach((type, i) => {
        if (type === 'weekday') return;
        const x = scales.x.getPixelForValue(i);
        ctx.fillStyle = type === 'holiday' ? 'rgba(217,79,61,.09)' : 'rgba(20,32,60,.055)';
        ctx.fillRect(
          Math.max(chartArea.left, x - half),
          chartArea.top,
          Math.min(chartArea.right, x + half) - Math.max(chartArea.left, x - half),
          chartArea.bottom - chartArea.top
        );
      });
      ctx.restore();
    },
  };

  // 이벤트 진행 구간: 기간만큼 리본(간트 막대)을 그려 언제부터 언제까지인지 바로 보이게 한다.
  // 리본이 좁으면 번호만 남기고, 번호는 아래 '월간 이벤트 계획' 표와 짝을 이룬다.
  const RIBBON_H = 16;
  const RIBBON_GAP = 20;

  // 월 경계를 걸친 이벤트는 리본이 캔버스 밖으로 나가 잘리므로 차트 영역 안으로 자른다
  function bandRange(chart, band) {
    const { scales, chartArea } = chart;
    const half = (scales.x.getPixelForValue(1) - scales.x.getPixelForValue(0)) / 2 || 6;
    const x0 = Math.max(chartArea.left, scales.x.getPixelForValue(band.from) - half);
    const x1 = Math.min(chartArea.right, scales.x.getPixelForValue(band.to) + half);
    return [x0, Math.max(x1, x0 + RIBBON_H)];
  }

  const eventBands = {
    id: 'eventBands',
    beforeDatasetsDraw(chart) {
      const bands = chart.$eventBands;
      if (!bands || !bands.length) return;
      const { ctx, chartArea } = chart;
      ctx.save();
      bands.forEach((b) => {
        const [x0, x1] = bandRange(chart, b);
        ctx.fillStyle = b.tint;
        ctx.fillRect(x0, chartArea.top, x1 - x0, chartArea.bottom - chartArea.top);
        ctx.strokeStyle = b.color;
        ctx.globalAlpha = 0.3;
        ctx.setLineDash(b.planned ? [4, 3] : []);
        [x0, x1].forEach((x) => {
          ctx.beginPath();
          ctx.moveTo(x, chartArea.top);
          ctx.lineTo(x, chartArea.bottom);
          ctx.stroke();
        });
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
      });
      ctx.restore();
    },
    afterDatasetsDraw(chart) {
      const bands = chart.$eventBands;
      if (!bands || !bands.length) return;
      const { ctx, chartArea } = chart;
      ctx.save();
      ctx.textBaseline = 'middle';
      bands.forEach((b) => {
        const [x0, x1] = bandRange(chart, b);
        const width = Math.max(RIBBON_H, x1 - x0);
        const y = chartArea.top - 10 - b.level * RIBBON_GAP;
        const top = y - RIBBON_H / 2;

        ctx.beginPath();
        ctx.roundRect(x0, top, width, RIBBON_H, 8);
        ctx.fillStyle = b.planned ? `${b.color}22` : `${b.color}e6`;
        ctx.fill();
        if (b.planned) {
          ctx.setLineDash([4, 3]);
          ctx.strokeStyle = b.color;
          ctx.lineWidth = 1.2;
          ctx.stroke();
          ctx.setLineDash([]);
        }

        // 번호 배지
        ctx.beginPath();
        ctx.arc(x0 + RIBBON_H / 2, y, 6, 0, Math.PI * 2);
        ctx.fillStyle = b.planned ? b.color : '#fff';
        ctx.fill();
        ctx.font = '700 9px "Malgun Gothic", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = b.planned ? '#fff' : b.color;
        ctx.fillText(String(b.no), x0 + RIBBON_H / 2, y + 0.5);

        // 남는 폭에 맞춰 이벤트명 · 오퍼
        const textX = x0 + RIBBON_H + 3;
        const room = x0 + width - textX - 6;
        if (room > 28) {
          ctx.font = '700 10px "Malgun Gothic", sans-serif';
          ctx.textAlign = 'left';
          ctx.fillStyle = b.planned ? b.color : '#fff';
          let text = b.label;
          while (text.length > 1 && ctx.measureText(text).width > room) text = text.slice(0, -1);
          if (text !== b.label) text = `${text.slice(0, -1)}…`;
          ctx.fillText(text, textX, y + 0.5);
        }
      });
      ctx.restore();
    },
  };

  Chart.register(restDays, valueLabels, eventBands);
  Chart.defaults.font.family = '"Malgun Gothic", sans-serif';
  Chart.defaults.color = '#6b7688';
  Chart.defaults.maintainAspectRatio = false;

  function render(canvasId, config, extras) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;
    if (registry[canvasId]) registry[canvasId].destroy();
    const chart = new Chart(canvas, config);
    Object.assign(chart, extras || {});
    chart.update();
    registry[canvasId] = chart;
    return chart;
  }

  const EVENT_COLORS = ['#0d5bd1', '#12a594', '#8b5cf6', '#d94f3d', '#0ea5e9', '#b5711a'];

  global.Charts = { render, COLOR, registry, EVENT_COLORS, RIBBON_GAP };
})(window);
