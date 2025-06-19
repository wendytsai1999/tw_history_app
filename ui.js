// ui.js - UI管理模組

(function(global) {
  'use strict';

  // 取得其他模組
  const Utils = global.TaiwanNewsApp.Utils;
  const SearchManager = global.TaiwanNewsApp.SearchManager;
  const StateManager = global.TaiwanNewsApp.StateManager;

  // ========================================
  // 私有變數和設定
  // ========================================
  
  // 分頁設定
  const ITEMS_PER_PAGE = 15; // 一列一個卡片
  
  // 高亮緩存
  const highlightCache = new Map();

  // ========================================
  // 私有函數
  // ========================================
  
  // 檢查搜尋匹配
  function checkSearchMatch(text, searchData, searchMode) {
    if (!text || !searchData || !SearchManager) return false;
    try {
      return SearchManager.containsSearchTerms(text, searchData, searchMode);
    } catch (error) {
      console.warn('搜尋匹配檢查錯誤:', error);
      return false;
    }
  }

  // 檢查篩選匹配
  function checkFilterMatch(item, field, filterValues, searchMatch) {
    return !searchMatch && filterValues && filterValues.length > 0 && filterValues.includes(item[field]);
  }

  // 檢查關鍵詞篩選匹配
  function checkKeywordFilterMatch(kw, keywordFilters) {
    if (!keywordFilters) return false;
    
    return (keywordFilters.major && keywordFilters.major.includes(kw.大分類)) ||
           (keywordFilters.mid && keywordFilters.mid.includes(kw.中分類)) ||
           (keywordFilters.minor && keywordFilters.minor.includes(kw.小分類));
  }

  // 取得區塊樣式
  function getHighlightClass(searchMatch, filterMatch) {
    if (searchMatch) return 'search-highlight';
    if (filterMatch) return 'filter-highlight';
    return '';
  }

  // 高亮搜尋詞
  function highlightSearchTerms(text, searchData, searchMode) {
    if (!text) return '';
    if (!SearchManager || !searchData) return Utils.safe(text);
    try {
      return SearchManager.highlightSearchTerms(text, searchData, searchMode);
    } catch (error) {
      console.warn('搜尋詞高亮錯誤:', error);
      return Utils.safe(text);
    }
  }

  // 取得當前頁面起始索引
  function getCurrentPageStartIndex() {
    const currentPage = StateManager ? StateManager.get('currentPage') : 1;
    return (currentPage - 1) * ITEMS_PER_PAGE;
  }

  // 生成單個資料卡片的 HTML
  function generateDataCard(item, index, searchData, searchMode, filters) {
    const startIndex = getCurrentPageStartIndex();
    const cardIndex = startIndex + index + 1;
    
    // 檢查各種匹配狀態
    const titleSearchMatch = checkSearchMatch(item.題名, searchData, searchMode);
    const titleMajorSearchMatch = checkSearchMatch(item.標題大分類, searchData, searchMode);
    const titleMidSearchMatch = checkSearchMatch(item.標題中分類, searchData, searchMode);
    
    const titleMajorFilterMatch = checkFilterMatch(item, '標題大分類', filters.title?.major, titleMajorSearchMatch);
    const titleMidFilterMatch = checkFilterMatch(item, '標題中分類', filters.title?.mid, titleMidSearchMatch);

    // 生成標題分類 - 用斜線分隔層級
    const titleCategory = (() => {
      const majorClass = item.標題大分類 || '';
      const midClass = item.標題中分類 || '';
      
      if (!majorClass) return '<span class="text-gray-400 text-sm">無分類</span>';
      
      const categoryParts = [majorClass];
      if (midClass) categoryParts.push(midClass);
      
      const categoryText = categoryParts.join('/');
      const highlightClass = getHighlightClass(titleMajorSearchMatch || titleMidSearchMatch, titleMajorFilterMatch || titleMidFilterMatch);
      
      return `<span class="title-category ${highlightClass}">
        ${highlightSearchTerms(categoryText, searchData, searchMode)}
      </span>`;
    })();

    // 生成關鍵詞方塊 - 灰色方塊，2-3個一排
    const keywordBoxes = item.關鍵詞列表.flatMap(kwGroup => {
      return kwGroup.關鍵詞.map(keyword => {
        const kwSearchMatch = checkSearchMatch(keyword, searchData, searchMode) || 
                             checkSearchMatch(kwGroup.大分類, searchData, searchMode) || 
                             checkSearchMatch(kwGroup.中分類, searchData, searchMode) || 
                             checkSearchMatch(kwGroup.小分類, searchData, searchMode);
        
        const kwFilterMatch = !kwSearchMatch && checkKeywordFilterMatch(kwGroup, filters.keyword);
        
        const highlightClass = getHighlightClass(kwSearchMatch, kwFilterMatch);
        
        // 建構分類路徑，用斜線分隔
        const categoryParts = [kwGroup.大分類, kwGroup.中分類, kwGroup.小分類].filter(Boolean);
        const categoryPath = categoryParts.length > 0 ? categoryParts.join('/') : '無分類';
        
        return `
          <div class="keyword-box ${highlightClass}">
            <div class="keyword-name">
              ${highlightSearchTerms(keyword || '(無關鍵詞)', searchData, searchMode)}
            </div>
            <div class="keyword-divider"></div>
            <div class="keyword-category">
              ${highlightSearchTerms(categoryPath, searchData, searchMode)}
            </div>
          </div>
        `;
      });
    }).join('');

    return `
      <div class="data-card">
        <!-- 第一行：編號和題名 -->
        <div class="card-header-row">
          <div class="card-number">${cardIndex}</div>
          <div class="card-title ${getHighlightClass(titleSearchMatch, false)}">
            ${highlightSearchTerms(Utils.safe(item.題名), searchData, searchMode)}
          </div>
        </div>
        
        <!-- 第二行：日期 -->
        <div class="card-date">
          日期：${item._日期 ? Utils.formatDate(item._日期) : Utils.safe(item.時間)}
        </div>
        
        <!-- 資料編號 -->
        <div class="card-id">
          編號：${Utils.safe(item.資料編號)}
        </div>
        
        <!-- 標題分類區域 -->
        <div class="card-section">
          <div class="section-header">
            <div class="section-icon blue"></div>
            <h4 class="section-title">標題分類</h4>
          </div>
          <div class="section-content">
            ${titleCategory}
          </div>
        </div>
        
        <!-- 關鍵詞區域 -->
        <div class="card-section">
          <div class="section-header">
            <div class="section-icon green"></div>
            <h4 class="section-title">關鍵詞資訊</h4>
          </div>
          <div class="section-content">
            ${keywordBoxes ? `<div class="keyword-grid">${keywordBoxes}</div>` : '<div class="text-gray-400 italic">無關鍵詞資料</div>'}
          </div>
        </div>
      </div>
    `;
  }

  // 顯示載入狀態
  function showLoadingState() {
    return `
      <div class="loading-container">
        <div class="loading-spinner"></div>
        <div class="loading-text">載入中...</div>
      </div>
    `;
  }

  // 顯示空狀態
  function showEmptyState() {
    return `
      <div class="empty-container">
        <div class="empty-icon">📋</div>
        <div class="empty-title">沒有符合條件的資料</div>
        <div class="empty-subtitle">請嘗試調整篩選條件或搜尋關鍵字</div>
      </div>
    `;
  }

  // ========================================
  // 公開的 API
  // ========================================
  const UIManager = {
    // 渲染卡片列表
    renderTable(filteredData, currentPage, searchData, searchMode, filters) {
      console.log('renderTable 被調用，資料量:', filteredData.length);
      
      const start = (currentPage - 1) * ITEMS_PER_PAGE;
      const pageData = filteredData.slice(start, start + ITEMS_PER_PAGE);

      // 找到結果容器
      const resultContainer = document.querySelector('.bg-white.rounded-lg.shadow.border.overflow-hidden');
      if (!resultContainer) {
        console.error('找不到結果容器');
        return;
      }
      
      // 保留標題列，替換內容區域
      const headerHtml = `
        <div class="result-header">
          <div class="header-content">
            <h4 class="header-title">結果列表</h4>
            <div class="header-controls">
              <p class="result-count">符合條件：<span id="filtered-count">${filteredData.length.toLocaleString()}</span> 筆資料</p>
              <div class="sort-control">
                <label class="sort-label">排序：</label>
                <select id="sort-order" class="sort-select" ${!StateManager || !StateManager.isDataLoaded() ? 'disabled' : ''}>
                  <option value="relevance" ${StateManager && StateManager.get('sortOrder') === 'relevance' ? 'selected' : ''}>相關度</option>
                  <option value="date-asc" ${StateManager && StateManager.get('sortOrder') === 'date-asc' ? 'selected' : ''}>日期（舊→新）</option>
                  <option value="date-desc" ${StateManager && StateManager.get('sortOrder') === 'date-desc' ? 'selected' : ''}>日期（新→舊）</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      `;
      
      // 卡片容器
      let cardsHtml;
      
      if (filteredData.length === 0) {
        cardsHtml = `<div class="result-content">${showEmptyState()}</div>`;
      } else if (pageData.length === 0) {
        cardsHtml = `<div class="result-content">${showLoadingState()}</div>`;
      } else {
        cardsHtml = `
          <div class="result-content">
            <div class="cards-container" id="data-cards-container">
              ${pageData.map((item, index) => generateDataCard(item, index, searchData, searchMode, filters)).join('')}
            </div>
          </div>
        `;
      }
      
      // 分頁區域
      const totalPages = Math.ceil(filteredData.length / ITEMS_PER_PAGE) || 1;
      const paginationHtml = `
        <div class="pagination-container">
          <div class="pagination-content">
            <button id="prev-page-btn" class="pagination-btn" ${currentPage <= 1 ? 'disabled' : ''}>上一頁</button>
            <span class="pagination-info">
              第 
              <input id="page-input" type="number" value="${currentPage}" min="1" max="${totalPages}" 
                     class="page-input" ${!StateManager || !StateManager.isDataLoaded() ? 'disabled' : ''} /> 
              / <span id="total-pages">${totalPages}</span> 頁
            </span>
            <button id="next-page-btn" class="pagination-btn" ${currentPage >= totalPages ? 'disabled' : ''}>下一頁</button>
          </div>
        </div>
      `;
      
      resultContainer.innerHTML = headerHtml + cardsHtml + paginationHtml;
      
      // 重新綁定事件監聽器
      this.rebindEventListeners();
    },

    // 重新綁定事件監聽器
    rebindEventListeners() {
      // 排序選擇器
      const sortSelect = Utils.$('sort-order');
      if (sortSelect) {
        sortSelect.addEventListener('change', function() {
          if (StateManager) {
            StateManager.set('sortOrder', this.value);
            // 觸發重新渲染
            window.dispatchEvent(new CustomEvent('stateChange'));
          }
        });
      }

      // 分頁按鈕
      const prevBtn = Utils.$('prev-page-btn');
      const nextBtn = Utils.$('next-page-btn');
      const pageInput = Utils.$('page-input');
      
      if (prevBtn) {
        prevBtn.addEventListener('click', () => {
          if (StateManager) {
            const currentPage = StateManager.get('currentPage');
            if (currentPage > 1) {
              StateManager.set('currentPage', currentPage - 1);
              window.dispatchEvent(new CustomEvent('stateChange'));
            }
          }
        });
      }
      
      if (nextBtn) {
        nextBtn.addEventListener('click', () => {
          if (StateManager) {
            const currentPage = StateManager.get('currentPage');
            const filteredData = StateManager.getFilteredDataset();
            const maxPages = Math.ceil(filteredData.length / ITEMS_PER_PAGE);
            if (currentPage < maxPages) {
              StateManager.set('currentPage', currentPage + 1);
              window.dispatchEvent(new CustomEvent('stateChange'));
            }
          }
        });
      }
      
      if (pageInput) {
        pageInput.addEventListener('change', () => {
          if (StateManager) {
            const newPage = parseInt(pageInput.value) || 1;
            const filteredData = StateManager.getFilteredDataset();
            const maxPages = Math.ceil(filteredData.length / ITEMS_PER_PAGE) || 1;
            const validPage = Math.max(1, Math.min(newPage, maxPages));
            StateManager.set('currentPage', validPage);
            window.dispatchEvent(new CustomEvent('stateChange'));
          }
        });
      }
    },

    // 更新分頁資訊（保持向後相容）
    updatePaginationInfo(totalItems, currentPage) {
      const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE) || 1;
      
      const totalPagesElement = Utils.$('total-pages');
      const pageInputElement = Utils.$('page-input');
      const prevBtn = Utils.$('prev-page-btn');
      const nextBtn = Utils.$('next-page-btn');
      
      if (totalPagesElement) totalPagesElement.textContent = totalPages;
      if (pageInputElement) {
        pageInputElement.value = currentPage;
        pageInputElement.max = totalPages;
      }
      
      // 更新分頁按鈕狀態
      if (prevBtn) prevBtn.disabled = currentPage <= 1;
      if (nextBtn) nextBtn.disabled = currentPage >= totalPages;
    },

    // 更新篩選條件顯示（修正：移除檢索相關）
    updateActiveFilters(currentFilters, searchData, searchMode, removeFilterCallback) {
      const activeFiltersDiv = Utils.$('active-filters');
      const filterTagsDiv = Utils.$('filter-tags');
      
      if (!activeFiltersDiv || !filterTagsDiv) return;
      
      let hasFilters = false;
      let tags = [];
      
      // 日期篩選標籤
      if (currentFilters.startDate || currentFilters.endDate) {
        let dateText;
        if (currentFilters.startDate && currentFilters.endDate) {
          if (currentFilters.startDate.getTime() === currentFilters.endDate.getTime()) {
            dateText = `日期: ${Utils.formatDate(currentFilters.startDate)}`;
          } else {
            dateText = `日期: ${Utils.formatDate(currentFilters.startDate)} ~ ${Utils.formatDate(currentFilters.endDate)}`;
          }
        } else if (currentFilters.startDate) {
          dateText = `日期: 從 ${Utils.formatDate(currentFilters.startDate)}`;
        } else {
          dateText = `日期: 至 ${Utils.formatDate(currentFilters.endDate)}`;
        }
        tags.push({ type: 'date', text: dateText, removable: true });
        hasFilters = true;
      }

      // 日治年號篩選標籤
      if (currentFilters.dateFilterType === 'japanese' && currentFilters.era) {
        let eraText = `年號: ${currentFilters.era}`;
        if (currentFilters.eraStartYear || currentFilters.eraEndYear) {
          const startText = currentFilters.eraStartYear ? `${currentFilters.eraStartYear}年` : '起始';
          const endText = currentFilters.eraEndYear ? `${currentFilters.eraEndYear}年` : '結束';
          eraText += ` (${startText} ~ ${endText})`;
        }
        tags.push({ type: 'era', text: eraText, removable: true });
        hasFilters = true;
      }
      
      // 樹狀篩選條件標籤
      const treeFilters = [
        { 
          dimension: 'title',
          levels: [
            { key: 'major', label: '標題大分類', type: 'titleMajor' },
            { key: 'mid', label: '標題中分類', type: 'titleMid' }
          ]
        },
        { 
          dimension: 'keyword',
          levels: [
            { key: 'major', label: '關鍵詞大分類', type: 'keywordMajor' },
            { key: 'mid', label: '關鍵詞中分類', type: 'keywordMid' },
            { key: 'minor', label: '關鍵詞小分類', type: 'keywordMinor' }
          ]
        }
      ];

      treeFilters.forEach(filter => {
        filter.levels.forEach(level => {
          const values = currentFilters[filter.dimension] && currentFilters[filter.dimension][level.key];
          if (values && Array.isArray(values) && values.length > 0) {
            if (values.length === 1) {
              // 單個選項：顯示具體值
              tags.push({
                type: level.type,
                text: `${level.label}: ${values[0]}`,
                removable: true,
                value: values[0]
              });
            } else if (values.length <= 3) {
              // 少量選項：顯示所有值
              tags.push({
                type: level.type,
                text: `${level.label}: ${values.join(', ')}`,
                removable: true
              });
            } else {
              // 多個選項：顯示總數
              tags.push({
                type: level.type,
                text: `${level.label}: ${values.length} 項`,
                removable: true
              });
            }
            
            // 為每個具體值創建單獨的可移除標籤（如果超過1個）
            if (values.length > 1) {
              values.forEach(value => {
                tags.push({
                  type: level.type,
                  text: value,
                  removable: true,
                  value: value,
                  isIndividual: true
                });
              });
            }
            
            hasFilters = true;
          }
        });
      });
      
      if (hasFilters) {
        // 清除舊內容
        filterTagsDiv.innerHTML = '';
        
        // 創建標籤元素
        tags.forEach(tag => {
          const tagElement = document.createElement('span');
          
          // 根據標籤類型設定不同樣式
          let tagClass = 'filter-tag';
          if (tag.isIndividual) {
            tagClass += ' individual-tag';
          }
          
          tagElement.className = tagClass;
          tagElement.textContent = tag.text;
          
          if (tag.removable) {
            const removeBtn = document.createElement('span');
            removeBtn.className = 'remove-filter';
            removeBtn.textContent = '✕';
            removeBtn.style.marginLeft = '6px';
            removeBtn.style.cursor = 'pointer';
            removeBtn.style.fontWeight = 'bold';
            
            // 處理移除事件
            removeBtn.addEventListener('click', () => {
              if (removeFilterCallback) {
                if (tag.value && tag.isIndividual) {
                  // 移除特定值
                  removeFilterCallback(tag.type, tag.value);
                } else {
                  // 移除整個篩選類型
                  removeFilterCallback(tag.type);
                }
              }
            });
            
            removeBtn.addEventListener('mouseenter', () => {
              removeBtn.style.color = '#fee2e2';
            });
            
            removeBtn.addEventListener('mouseleave', () => {
              removeBtn.style.color = '';
            });
            
            tagElement.appendChild(removeBtn);
          }
          
          filterTagsDiv.appendChild(tagElement);
        });
        
        activeFiltersDiv.classList.remove('hidden');
      } else {
        activeFiltersDiv.classList.add('hidden');
      }
    },

    // 更新結果計數顯示
    updateResultCount(count) {
      console.log('updateResultCount 被調用，計數:', count);
      const countElement = Utils.$('filtered-count');
      if (countElement) {
        countElement.textContent = count.toLocaleString();
      }
    },

    // 更新篩選統計顯示（修正：只顯示篩選相關統計）
    updateFilterStatistics() {
      if (!StateManager) return;
      
      const stats = StateManager.getFilterStatistics();
      const statisticsDiv = Utils.$('filter-statistics');
      
      if (!statisticsDiv) return;
      
      // 檢查是否有篩選條件（不包含檢索）
      if (stats.hasActiveFilters || stats.hasDateFilter) {
        // 更新統計數值
        const totalCountElement = Utils.$('filtered-total-count');
        const titleFilterCountElement = Utils.$('title-filter-count');
        const keywordFilterCountElement = Utils.$('keyword-filter-count');
        
        if (totalCountElement) {
          totalCountElement.textContent = Utils.formatNumber ? Utils.formatNumber(stats.totalCount) : stats.totalCount.toLocaleString();
        }
        if (titleFilterCountElement) {
          titleFilterCountElement.textContent = stats.titleFilterCount;
        }
        if (keywordFilterCountElement) {
          keywordFilterCountElement.textContent = stats.keywordFilterCount;
        }
        
        // 顯示統計區塊
        statisticsDiv.classList.remove('hidden');
      } else {
        // 隱藏統計區塊
        statisticsDiv.classList.add('hidden');
      }
    },

    // 更新篩選模式說明文字
    updateFilterModeDescription() {
      if (!StateManager) return;
      
      const modeDescElement = Utils.$('mode-desc-text');
      if (modeDescElement) {
        modeDescElement.textContent = StateManager.getFilterModeDescription();
      }
    },

    // 更新篩選模式切換器狀態
    updateFilterModeToggle() {
      if (!StateManager) return;
      
      const toggle = Utils.$('filter-mode-toggle');
      if (toggle) {
        const currentMode = StateManager.get('filterMode');
        toggle.checked = currentMode === 'or';
      }
    },

    // 清理快取
    clearCache() {
      const maxCacheSize = 1000;
      
      if (highlightCache.size > maxCacheSize) {
        const keys = Array.from(highlightCache.keys()).slice(0, maxCacheSize / 2);
        keys.forEach(key => highlightCache.delete(key));
      }
    },

    // 分頁相關方法
    getCurrentPage() {
      return StateManager ? StateManager.get('currentPage') : 1;
    },

    setCurrentPage(page) {
      if (StateManager) {
        StateManager.set('currentPage', page);
      }
    },

    getItemsPerPage() {
      return ITEMS_PER_PAGE;
    }
  };

  // 註冊到應用程式模組系統
  global.TaiwanNewsApp.UIManager = UIManager;

})(this);