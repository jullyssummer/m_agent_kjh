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

  // 일자별 데이터 레이블: 유료는 포인트 위, 쿠폰은 아래로 흘려 겹침을 줄인다
  const valueLabels = {
    id: 'valueLabels',
    afterDatasetsDraw(chart) {
      if (!chart.$showLabels) return;
      const { ctx } = chart;
      ctx.save();
      ctx.font = '9px "Gowun Dodum", sans-serif';
      ctx.textAlign = 'center';
      chart.data.datasets.forEach((ds, di) => {
        if (ds.hideLabels) return;
        const meta = chart.getDatasetMeta(di);
        if (meta.hidden) return;
        ctx.fillStyle = ds.borderColor || COLOR.muted;
        meta.data.forEach((pt, i) => {
          const v = ds.data[i];
          if (v == null) return;
          const below = di % 2 === 1;
          ctx.fillText(Math.round(v).toLocaleString(), pt.x, pt.y + (below ? 13 : -6));
        });
      });
      ctx.restore();
    },
  };

  // 이벤트 진행 구간 음영 + 이벤트명·오퍼 라벨
  const eventBands = {
    id: 'eventBands',
    beforeDatasetsDraw(chart) {
      const bands = chart.$eventBands;
      if (!bands || !bands.length) return;
      const { ctx, chartArea, scales } = chart;
      ctx.save();
      bands.forEach((b) => {
        const x0 = scales.x.getPixelForValue(b.from);
        const x1 = scales.x.getPixelForValue(b.to);
        const half = (scales.x.getPixelForValue(1) - scales.x.getPixelForValue(0)) / 2 || 6;
        ctx.fillStyle = b.planned ? 'rgba(240, 162, 2, .09)' : 'rgba(13, 91, 209, .07)';
        ctx.fillRect(x0 - half, chartArea.top, x1 - x0 + half * 2, chartArea.bottom - chartArea.top);
      });
      ctx.restore();
    },
    afterDatasetsDraw(chart) {
      const bands = chart.$eventBands;
      if (!bands || !bands.length) return;
      const { ctx, chartArea, scales } = chart;
      ctx.save();
      ctx.font = '10px "Gowun Dodum", sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      const rows = [];
      bands.forEach((b) => {
        const x = scales.x.getPixelForValue(b.from);
        const text = b.label;
        const width = ctx.measureText(text).width + 14;
        let level = 0;
        while (rows[level] != null && rows[level] > x - 4) level += 1;
        rows[level] = x + width;
        const y = chartArea.top + 9 + level * 15;
        ctx.fillStyle = b.planned ? '#fff4e5' : '#e8f0fe';
        ctx.strokeStyle = b.planned ? '#f0a202' : '#0d5bd1';
        ctx.lineWidth = 1;
        const boxY = y - 7;
        ctx.beginPath();
        ctx.roundRect(x, boxY, width, 14, 4);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = b.planned ? '#b5711a' : '#0d5bd1';
        ctx.fillText(text, x + 7, y + 1);
      });
      ctx.restore();
    },
  };

  Chart.register(valueLabels, eventBands);
  Chart.defaults.font.family = '"Gowun Dodum", "Malgun Gothic", sans-serif';
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

  global.Charts = { render, COLOR, registry };
})(window);
