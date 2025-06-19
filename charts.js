// charts.js - 圖表模組

(function(global) {
  'use strict';

  // 取得其他模組
  const Utils = global.TaiwanNewsApp.Utils;
  const DataManager = global.TaiwanNewsApp.DataManager;
  const StateManager = global.TaiwanNewsApp.StateManager;

  // ========================================
  // 私有變數
  // ========================================
  
  // 儲存圖表實例
  const chartInstances = {
    year: null
  };

  // 圖表顏色配置
  const CHART_COLORS = {
    primary: '#3b82f6',
    secondary: '#93c5fd',
    tertiary: '#dbeafe',
    selected: '#1e40af',
    background: '#f8fafc'
  };

  // ========================================
  // 私有函數
  // ========================================

  // 銷毀圖表實例
  function destroyChart(chartKey) {
    if (chartInstances[chartKey]) {
      chartInstances[chartKey].destroy();
      chartInstances[chartKey] = null;
    }
  }

  // ========================================
  // 公開的 API
  // ========================================
  const ChartManager = {
    // 渲染年份分布圖表
    renderYearChart(filteredData) {
      destroyChart('year');
      
      const data = filteredData || (StateManager ? StateManager.getFilteredDataset() : []);
      const yearCounts = {};
      data.forEach(r => { 
        if (r._年份) yearCounts[r._年份] = (yearCounts[r._年份] || 0) + 1; 
      });

      const years = Object.keys(yearCounts).map(Number).sort();
      const counts = years.map(y => yearCounts[y]);

      const yearChartElement = Utils.$('yearChart');
      if (yearChartElement && years.length > 0) {
        chartInstances.year = new Chart(yearChartElement, {
          type: 'line',
          data: {
            labels: years,
            datasets: [{
              label: '資料筆數', 
              data: counts, 
              borderColor: '#2563eb', 
              backgroundColor: 'rgba(37, 99, 235, 0.2)',
              borderWidth: 3, 
              fill: true, 
              tension: 0.1, 
              pointBackgroundColor: '#2563eb',
              pointBorderColor: '#ffffff', 
              pointBorderWidth: 2, 
              pointRadius: 4
            }]
          },
          options: {
            responsive: true, 
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { 
              y: { beginAtZero: true, ticks: { precision: 0 } }, 
              x: { ticks: { maxTicksLimit: 15 } } 
            }
          }
        });
      }
    },

    // 渲染所有圖表
    renderAllCharts(filteredData) {
      requestAnimationFrame(() => this.renderYearChart(filteredData));
    },

    // 銷毀所有圖表
    destroyAllCharts() {
      Object.keys(chartInstances).forEach(key => {
        destroyChart(key);
      });
    },

    // 更新圖表大小
    resizeCharts() {
      Object.values(chartInstances).forEach(chart => {
        if (chart && typeof chart.resize === 'function') {
          chart.resize();
        }
      });
    }
  };

  // 註冊到應用程式模組系統
  global.TaiwanNewsApp.ChartManager = ChartManager;

})(this);