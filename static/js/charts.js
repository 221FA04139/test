/* ── Charts.js — Chart.js chart instances ────────────────────────────────── */

const Charts = (() => {
  let monthlyChart = null;
  let donutChart = null;

  const CHART_DEFAULTS = {
    color: '#e8eaf0',
    font: { family: "'Sora', sans-serif", size: 11 },
  };

  Chart.defaults.color = CHART_DEFAULTS.color;
  Chart.defaults.font.family = CHART_DEFAULTS.font.family;
  Chart.defaults.font.size = CHART_DEFAULTS.font.size;

  function renderMonthly(data) {
    const ctx = document.getElementById('chart-monthly');
    if (!ctx) return;

    const labels = data.map(d => {
      const [y, m] = d.month.split('-');
      return new Date(y, m - 1).toLocaleString('default', { month: 'short', year: '2-digit' });
    });
    const incomeData = data.map(d => d.income);
    const expenseData = data.map(d => d.expense);

    if (monthlyChart) monthlyChart.destroy();

    monthlyChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Income',
            data: incomeData,
            backgroundColor: 'rgba(34, 197, 94, 0.7)',
            borderColor: 'rgba(34, 197, 94, 1)',
            borderWidth: 1,
            borderRadius: 3,
          },
          {
            label: 'Expense',
            data: expenseData,
            backgroundColor: 'rgba(239, 68, 68, 0.7)',
            borderColor: 'rgba(239, 68, 68, 1)',
            borderWidth: 1,
            borderRadius: 3,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { boxWidth: 10, padding: 12, color: '#9ca3af' },
          },
          tooltip: {
            backgroundColor: '#1a1e2a',
            borderColor: '#252a38',
            borderWidth: 1,
            callbacks: {
              label: ctx => ' ' + fmtRupee(ctx.raw),
            },
          },
        },
        scales: {
          x: {
            grid: { color: 'rgba(37,42,56,0.8)' },
            ticks: { color: '#6b7280' },
          },
          y: {
            grid: { color: 'rgba(37,42,56,0.8)' },
            ticks: {
              color: '#6b7280',
              callback: v => '₹' + (v >= 100000 ? (v / 100000).toFixed(1) + 'L' : v >= 1000 ? (v / 1000).toFixed(0) + 'K' : v),
            },
          },
        },
      },
    });
  }

  function renderDonut(data) {
    const ctx = document.getElementById('chart-donut');
    if (!ctx) return;

    const filtered = data.filter(d => d.amount > 0);
    if (filtered.length === 0) return;

    const COLORS = [
      '#4f8ef7', '#22c55e', '#ef4444', '#f59e0b', '#f4d03f',
      '#a78bfa', '#34d399', '#fb923c', '#60a5fa', '#f472b6',
    ];

    if (donutChart) donutChart.destroy();

    donutChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: filtered.map(d => d.category),
        datasets: [{
          data: filtered.map(d => d.amount),
          backgroundColor: COLORS.slice(0, filtered.length),
          borderColor: '#141720',
          borderWidth: 2,
          hoverOffset: 6,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '65%',
        plugins: {
          legend: {
            position: 'right',
            labels: {
              boxWidth: 10,
              padding: 10,
              color: '#9ca3af',
              font: { size: 10 },
            },
          },
          tooltip: {
            backgroundColor: '#1a1e2a',
            borderColor: '#252a38',
            borderWidth: 1,
            callbacks: {
              label: ctx => ' ' + fmtRupee(ctx.raw) + ' (' + ctx.label + ')',
            },
          },
        },
      },
    });
  }

  function update(dashboardData) {
    renderMonthly(dashboardData.monthly_trend || []);
    renderDonut(dashboardData.category_donut || []);
  }

  return { update };
})();
