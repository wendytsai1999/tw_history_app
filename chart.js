// chart.js - 優化版圖表管理模組

// ========================================
// 圖表管理類別
// ========================================

class ChartManager {
  constructor() {
    // 依賴
    this.stateManager = null;
    this.utils = null;
    
    // 圖表實例
    this.chartInstances = new Map();
    
    // 年份篩選狀態
    this.yearSelection = {
      startYear: null,
      endYear: null,
      selectedYears: new Set(),
      clickStage: 0,
      firstClickedYear: null
    };
    
    // 圖表配置
    this.chartConfig = {
      year: {
        type: 'line',
        color: '#2563eb',
        backgroundColor: 'rgba(37, 99, 235, 0.2)',
        borderWidth: 2,
        pointRadius: 4,
        pointBorderWidth: 2,
        tension: 0.1,
        selectedColor: '#dc2626',
        selectedBackgroundColor: 'rgba(220, 38, 38, 0.3)'
      }
    };
    
    // 快取系統
    this.cache = new Map();
    this.maxCacheSize = 30;
    
    // 事件處理器快取
    this.eventHandlers = new Map();
  }

  // 初始化
  init(stateManager, utils) {
    this.stateManager = stateManager;
    this.utils = utils;
    
    // 初始化年份篩選清除按鈕事件
    this.initializeYearFilterEvents();
  }

  // ========================================
  // 年份分布圖表
  // ========================================

  renderYearChart(filteredData) {
    const data = filteredData || (this.stateManager ? this.stateManager.getFilteredDataset() : []);
    
    if (data.length === 0) {
      this.destroyChart('year');
      return;
    }
    
    const { years, counts } = this.calculateYearStats(data);
    if (years.length === 0) {
      this.destroyChart('year');
      return;
    }
    
    const yearChartElement = this.utils?.$('yearChart');
    if (!yearChartElement) return;
    
    this.destroyChart('year');
    
    try {
      const config = this.chartConfig.year;
      
      const chartInstance = new Chart(yearChartElement, {
        type: config.type,
        data: {
          labels: years,
          datasets: [{
            label: '年代分布',
            data: counts,
            borderColor: config.color,
            backgroundColor: config.backgroundColor,
            borderWidth: config.borderWidth,
            pointRadius: config.pointRadius,
            pointBorderWidth: config.pointBorderWidth,
            tension: config.tension,
            pointBackgroundColor: years.map(() => config.color),
            pointBorderColor: years.map(() => '#ffffff'),
          }]
        },
        options: this.createResponsiveOptions('line', {
          onClick: this.createYearChartClickHandler(),
        })
      });
      
      this.chartInstances.set('year', chartInstance);
      
    } catch (error) {
      console.error('[ChartManager] 年份圖表渲染失敗:', error);
    }
  }

  calculateYearStats(data) {
    const cacheKey = this.generateCacheKey('year', data);
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    const yearCounts = new Map();
    
    data.forEach(item => {
      if (item._年份 && item._年份 >= 1895 && item._年份 <= 1945) {
        yearCounts.set(item._年份, (yearCounts.get(item._年份) || 0) + 1);
      }
    });

    const years = Array.from(yearCounts.keys()).sort((a, b) => a - b);
    const counts = years.map(year => yearCounts.get(year));

    const result = { years, counts, yearCounts };
    
    this.setCache(cacheKey, result);
    return result;
  }

  createYearChartClickHandler() {
    return (event, elements) => {
      if (!elements || elements.length === 0 || !this.stateManager) return;
      
      const chart = this.chartInstances.get('year');
      if (!chart) return;
      
      const clickedIndex = elements[0].index;
      const years = chart.data.labels;
      const clickedYear = years[clickedIndex];
      
      // 單選該年
      this.yearSelection.selectedYears.clear();
      this.yearSelection.selectedYears.add(clickedYear);
      this.yearSelection.startYear = clickedYear;
      this.yearSelection.endYear = clickedYear;
      
      this.updateYearChartStyle();
      
      // 更新年份輸入框
      const startYearInput = this.utils.$('start-year-input');
      const endYearInput = this.utils.$('end-year-input');
      
      if (startYearInput) startYearInput.value = clickedYear;
      if (endYearInput) endYearInput.value = clickedYear;
      
      // 立即套用篩選
      this.stateManager.update({
        'filters.startYear': clickedYear,
        'filters.endYear': clickedYear
      });
      this.stateManager.triggerFilterChange();
    };
  }

  updateYearChartStyle() {
    const chart = this.chartInstances.get('year');
    if (!chart) return;

    const dataset = chart.data.datasets[0];
    const years = chart.data.labels;
    const config = this.chartConfig.year;

    dataset.pointBackgroundColor = years.map(year => 
      this.yearSelection.selectedYears.has(year) ? config.selectedColor : config.color
    );
    
    dataset.pointBorderColor = years.map(year => 
      this.yearSelection.selectedYears.has(year) ? config.selectedColor : '#ffffff'
    );

    dataset.pointRadius = years.map(year => 
      this.yearSelection.selectedYears.has(year) ? 6 : config.pointRadius
    );

    chart.update('none');
  }

  // ========================================
  // 年份篩選功能
  // ========================================

  initializeYearFilterEvents() {
    if (typeof window === 'undefined') return;
    
    // 延遲綁定，確保DOM已載入
    const bindEvents = () => {
      const clearButton = this.utils.$('clear-year-filter');
      if (clearButton && !this.eventHandlers.has('clear-year-filter')) {
        const handler = () => this.clearYearFilter();
        clearButton.addEventListener('click', handler);
        this.eventHandlers.set('clear-year-filter', { element: clearButton, handler });
      }
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', bindEvents);
    } else {
      bindEvents();
    }
  }

  clearYearFilter() {
    this.yearSelection.selectedYears.clear();
    this.yearSelection.startYear = null;
    this.yearSelection.endYear = null;
    this.yearSelection.firstClickedYear = null;
    this.yearSelection.clickStage = 0;
    
    this.updateYearChartStyle();
    this.updateYearFilterDisplay();
    
    if (this.stateManager) {
      this.stateManager.update({
        'filters.startYear': 1895,
        'filters.endYear': 1945
      });
      this.stateManager.triggerFilterChange();
    }
  }

  setYearRange(startYear, endYear) {
    if (startYear && endYear) {
      this.yearSelection.selectedYears.clear();
      this.yearSelection.startYear = startYear;
      this.yearSelection.endYear = endYear;
      
      for (let year = startYear; year <= endYear; year++) {
        this.yearSelection.selectedYears.add(year);
      }
      
      this.updateYearChartStyle();
      this.updateYearFilterDisplay();
    }
  }

  updateYearFilterDisplay() {
    const displayElement = this.utils.$('year-filter-display');
    const textElement = this.utils.$('year-filter-text');
    
    if (!displayElement || !textElement) return;

    const { startYear, endYear, selectedYears } = this.yearSelection;

    if (selectedYears.size === 0) {
      displayElement.classList.add('hidden');
      return;
    }

    displayElement.classList.remove('hidden');

    if (startYear === endYear) {
      textElement.textContent = `已選擇：${startYear}年`;
    } else if (selectedYears.size === endYear - startYear + 1) {
      textElement.textContent = `已選擇：${startYear}-${endYear}年`;
    } else {
      const sortedYears = Array.from(selectedYears).sort((a, b) => a - b);
      if (sortedYears.length <= 5) {
        textElement.textContent = `已選擇：${sortedYears.join(', ')}年`;
      } else {
        textElement.textContent = `已選擇：${sortedYears.length}個年份 (${sortedYears[0]}-${sortedYears[sortedYears.length - 1]})`;
      }
    }
  }

  // ========================================
  // 圖表工具方法
  // ========================================

  createResponsiveOptions(chartType, customOptions = {}) {
    const baseOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false,
          position: 'bottom',
          labels: {
            fontSize: 12,
            padding: 10
          }
        },
        tooltip: {
          mode: 'index',
          intersect: false,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          titleColor: '#fff',
          bodyColor: '#fff',
          borderColor: 'rgba(255, 255, 255, 0.2)',
          borderWidth: 1
        }
      },
      interaction: {
        mode: 'nearest',
        axis: 'x',
        intersect: false
      }
    };

    if (chartType === 'line') {
      baseOptions.scales = {
        y: {
          beginAtZero: true,
          ticks: {
            precision: 0,
            fontSize: 11
          },
          grid: {
            color: 'rgba(0, 0, 0, 0.1)'
          }
        },
        x: {
          ticks: {
            maxTicksLimit: 10,
            fontSize: 11
          },
          grid: {
            display: false
          }
        }
      };
    }

    return { ...baseOptions, ...customOptions };
  }

  destroyChart(chartKey) {
    const chartInstance = this.chartInstances.get(chartKey);
    if (chartInstance) {
      try {
        chartInstance.destroy();
      } catch (error) {
        console.warn(`[ChartManager] 銷毀圖表 ${chartKey} 時發生錯誤:`, error);
      } finally {
        this.chartInstances.delete(chartKey);
      }
    }
  }

  // ========================================
  // 公開方法
  // ========================================

  renderAllCharts(filteredData) {
    if (typeof requestAnimationFrame !== 'undefined') {
      requestAnimationFrame(() => {
        this.renderYearChart(filteredData);
      });
    } else {
      this.renderYearChart(filteredData);
    }
  }

  updateCharts(filteredData) {
    this.renderAllCharts(filteredData);
  }

  destroyAllCharts() {
    for (const chartKey of this.chartInstances.keys()) {
      this.destroyChart(chartKey);
    }
  }

  resizeCharts() {
    this.chartInstances.forEach(chart => {
      if (chart && typeof chart.resize === 'function') {
        try {
          chart.resize();
        } catch (error) {
          console.warn('[ChartManager] 圖表大小調整失敗:', error);
        }
      }
    });
  }

  getSelectedYears() {
    return {
      years: Array.from(this.yearSelection.selectedYears).sort(),
      startYear: this.yearSelection.startYear,
      endYear: this.yearSelection.endYear
    };
  }

  hasYearSelection() {
    return this.yearSelection.selectedYears.size > 0;
  }

  getChartStats(filteredData) {
    const data = filteredData || (this.stateManager ? this.stateManager.getFilteredDataset() : []);
    
    return {
      totalRecords: data.length,
      yearRange: this.getYearRange(data),
      selectedYears: Array.from(this.yearSelection.selectedYears).sort()
    };
  }

  getYearRange(data) {
    const years = data
      .map(item => item._年份)
      .filter(year => year && year >= 1895 && year <= 1945);
    
    if (years.length === 0) {
      return { start: null, end: null, span: 0 };
    }
    
    const start = Math.min(...years);
    const end = Math.max(...years);
    
    return { start, end, span: end - start + 1 };
  }

  exportChart(chartType, format = 'png') {
    const chart = this.chartInstances.get(chartType);
    if (!chart) {
      console.warn(`[ChartManager] 圖表 ${chartType} 不存在`);
      return null;
    }

    try {
      const canvas = chart.canvas;
      const dataURL = canvas.toDataURL(`image/${format}`);
      
      const link = document.createElement('a');
      link.download = `${chartType}-chart.${format}`;
      link.href = dataURL;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      return dataURL;
    } catch (error) {
      console.error(`[ChartManager] 導出圖表 ${chartType} 失敗:`, error);
      return null;
    }
  }

  // ========================================
  // 快取管理
  // ========================================

  generateCacheKey(type, data) {
    const dataLength = data ? data.length : 0;
    const dataHash = data ? JSON.stringify(data.slice(0, 3).map(i => i.資料編號)).substring(0, 20) : '';
    return `${type}_${dataLength}_${dataHash}`;
  }

  setCache(key, value) {
    if (this.cache.size >= this.maxCacheSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, value);
  }

  clearCache() {
    this.cache.clear();
  }

  getCacheStats() {
    return {
      cacheSize: this.cache.size,
      maxCacheSize: this.maxCacheSize,
      activeCharts: Array.from(this.chartInstances.keys())
    };
  }

  // ========================================
  // 系統方法
  // ========================================

  isChartSupported() {
    return typeof Chart !== 'undefined';
  }

  getChartInstance(chartType) {
    return this.chartInstances.get(chartType);
  }

  reinitialize() {
    this.destroyAllCharts();
    this.clearCache();
    
    if (!this.isChartSupported()) {
      console.error('[ChartManager] Chart.js 未載入，無法初始化圖表系統');
      return false;
    }
    
    return true;
  }

  cleanup() {
    this.destroyAllCharts();
    this.clearCache();
    
    // 清理事件監聽器
    this.eventHandlers.forEach(({ element, handler }) => {
      if (element && handler) {
        element.removeEventListener('click', handler);
      }
    });
    this.eventHandlers.clear();
  }
}

// 導出單例
export const chartManager = new ChartManager();
