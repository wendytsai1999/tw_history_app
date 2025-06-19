// utils.js - 工具函數模組
// 這個模組包含所有基本的工具函數，就像工具箱一樣

(function(global) {
  'use strict';

  // ========================================
  // 緩存系統 - 提高效能用的記憶體
  // ========================================
  const CACHE = {
    normalizedTexts: new Map(),
    escapeRegExp: new Map(),
    eraConversions: new Map()
  };

  // ========================================
  // 字符正規化 - 把簡體字轉成繁體字
  // ========================================
  const CHARACTER_NORMALIZATION_MAP = {
    '台': '臺', '台灣': '臺灣', '台北': '臺北', '台中': '臺中', 
    '台南': '臺南', '台東': '臺東', '裡': '裏', '着': '著', 
    '国': '國', '学': '學', '会': '會'
  };

  const REVERSE_NORMALIZATION_MAP = Object.fromEntries(
    Object.entries(CHARACTER_NORMALIZATION_MAP).map(([k, v]) => [v, k])
  );

  const NORMALIZATION_REGEX = new RegExp(
    Object.keys(CHARACTER_NORMALIZATION_MAP).join('|'), 'g'
  );

  // ========================================
  // 日治年號對照表
  // ========================================
  const JAPANESE_ERA_MAP = {
    '明治': {
      startYear: 1868,
      endYear: 1912,
      taiwanStartYear: 1895, // 台灣割讓開始年
      taiwanEndYear: 1912
    },
    '大正': {
      startYear: 1912,
      endYear: 1926,
      taiwanStartYear: 1912,
      taiwanEndYear: 1926
    },
    '昭和': {
      startYear: 1926,
      endYear: 1989,
      taiwanStartYear: 1926,
      taiwanEndYear: 1945 // 日治結束年
    }
  };

  // ========================================
  // 預編譯正則表達式 - 提高效能
  // ========================================
  const REGEX_CACHE = {
    datePatterns: [
      /^(\d{4})-(\d{1,2})-(\d{1,2})/,
      /^(\d{4})\/(\d{1,2})\/(\d{1,2})/,
      /^(\d{4})-(\d{1,2})/,
      /^(\d{4})\/(\d{1,2})/
    ],
    escapeRegex: /[.*+?^${}()|[\]\\]/g
  };

  // ========================================
  // 工具函數實作
  // ========================================
  const Utils = {
    // 取得頁面元素的簡寫
    $: function(id) {
      return document.getElementById(id);
    },

    // 安全顯示文字，避免空值
    safe: function(val) {
      return String(val || '').trim();
    },

    // 從陣列中取得不重複的項目
    unique: function(arr) {
      return [...new Set(arr.filter(Boolean))].sort();
    },

    // 正規化文字（台→臺）
    normalizeText: function(text) {
      if (!text) return '';
      const cacheKey = String(text);
      if (CACHE.normalizedTexts.has(cacheKey)) {
        return CACHE.normalizedTexts.get(cacheKey);
      }
      
      const normalized = cacheKey.replace(NORMALIZATION_REGEX, 
        match => CHARACTER_NORMALIZATION_MAP[match]);
      CACHE.normalizedTexts.set(cacheKey, normalized);
      return normalized;
    },

    // 反正規化文字（臺→台）
    denormalizeText: function(text) {
      if (!text) return '';
      const str = String(text);
      const reverseRegex = new RegExp(
        Object.keys(REVERSE_NORMALIZATION_MAP).join('|'), 'g'
      );
      return str.replace(reverseRegex, 
        match => REVERSE_NORMALIZATION_MAP[match]);
    },

    // 檢查文字是否需要正規化
    hasNormalizableCharacters: function(text) {
      return text && NORMALIZATION_REGEX.test(String(text));
    },

    // 取得正規化資訊
    getNormalizationInfo: function(originalText, normalizedText) {
      if (originalText === normalizedText) return null;
      const changes = [];
      Object.entries(CHARACTER_NORMALIZATION_MAP).forEach(([simplified, traditional]) => {
        if (originalText.includes(simplified)) {
          changes.push(`「${simplified}」→「${traditional}」`);
        }
      });
      return changes.length > 0 ? `字形正規化：${changes.join('、')}` : null;
    },

    // 轉義正則表達式特殊字符
    escapeRegExp: function(str) {
      if (CACHE.escapeRegExp.has(str)) {
        return CACHE.escapeRegExp.get(str);
      }
      const escaped = str.replace(REGEX_CACHE.escapeRegex, '\\$&');
      CACHE.escapeRegExp.set(str, escaped);
      return escaped;
    },

    // ========================================
    // 日治年號相關函數
    // ========================================

    // 年號年轉換為西元年
    convertEraToWestern: function(eraName, eraYear) {
      const cacheKey = `${eraName}-${eraYear}`;
      if (CACHE.eraConversions.has(cacheKey)) {
        return CACHE.eraConversions.get(cacheKey);
      }

      const era = JAPANESE_ERA_MAP[eraName];
      if (!era) {
        console.warn(`未知的年號: ${eraName}`);
        return null;
      }

      const westernYear = era.startYear + eraYear - 1;
      
      // 檢查是否在台灣日治範圍內
      if (westernYear < era.taiwanStartYear || westernYear > era.taiwanEndYear) {
        console.warn(`${eraName}${eraYear}年 (西元${westernYear}年) 不在台灣日治範圍內`);
        return null;
      }

      CACHE.eraConversions.set(cacheKey, westernYear);
      return westernYear;
    },

    // 西元年轉換為年號年
    convertWesternToEra: function(westernYear) {
      const year = parseInt(westernYear);
      if (year < 1895 || year > 1945) {
        return null;
      }

      let targetEra = null;
      let eraYear = null;

      // 找到對應的年號
      Object.entries(JAPANESE_ERA_MAP).forEach(([eraName, era]) => {
        if (year >= era.taiwanStartYear && year <= era.taiwanEndYear) {
          targetEra = eraName;
          eraYear = year - era.startYear + 1;
        }
      });

      return targetEra ? { era: targetEra, year: eraYear } : null;
    },

    // 取得年號的有效年份範圍
    getEraYearRange: function(eraName) {
      const era = JAPANESE_ERA_MAP[eraName];
      if (!era) return null;

      return {
        minYear: 1,
        maxYear: era.taiwanEndYear - era.startYear + 1,
        westernStart: era.taiwanStartYear,
        westernEnd: era.taiwanEndYear
      };
    },

    // 取得所有可用的年號
    getAvailableEras: function() {
      return Object.keys(JAPANESE_ERA_MAP);
    },

    // 驗證年號年是否有效
    validateEraYear: function(eraName, eraYear) {
      const range = this.getEraYearRange(eraName);
      if (!range) return false;
      
      const year = parseInt(eraYear);
      return year >= range.minYear && year <= range.maxYear;
    },

    // 格式化年號顯示
    formatEraDisplay: function(eraName, eraYear, westernYear = null) {
      if (!westernYear) {
        westernYear = this.convertEraToWestern(eraName, eraYear);
      }
      return westernYear ? `${eraName}${eraYear}年 (西元${westernYear}年)` : `${eraName}${eraYear}年`;
    },

    // ========================================
    // 日期相關函數
    // ========================================

    // 解析日期
    parseDate: function(dateStr) {
      if (!dateStr) return null;
      const str = String(dateStr).trim();
      
      for (const pattern of REGEX_CACHE.datePatterns) {
        const match = str.match(pattern);
        if (match) {
          const year = parseInt(match[1]);
          const month = parseInt(match[2] || 1);
          const day = parseInt(match[3] || 1);
          if (year >= 1895 && year <= 1945) {
            return new Date(year, month - 1, day);
          }
        }
      }
      return null;
    },

    // 解析年份
    parseYear: function(yearStr) {
      if (!yearStr) return null;
      const year = parseInt(yearStr);
      return (year >= 1895 && year <= 1945) ? year : null;
    },

    // 格式化日期
    formatDate: function(date) {
      if (!date) return '';
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    },

    // 格式化日期範圍
    formatDateRange: function(startDate, endDate) {
      if (!startDate && !endDate) return '';
      if (startDate && endDate) {
        if (startDate.getTime() === endDate.getTime()) {
          return this.formatDate(startDate);
        } else {
          return `${this.formatDate(startDate)} ~ ${this.formatDate(endDate)}`;
        }
      } else if (startDate) {
        return `從 ${this.formatDate(startDate)}`;
      } else {
        return `至 ${this.formatDate(endDate)}`;
      }
    },

    // 創建日期範圍
    createDateRange: function(startYear, endYear, startMonth = 1, endMonth = 12, startDay = 1, endDay = 31) {
      const startDate = new Date(startYear, startMonth - 1, startDay);
      const endDate = new Date(endYear, endMonth - 1, endDay);
      return { start: startDate, end: endDate };
    },

    // ========================================
    // 其他工具函數
    // ========================================

    // 解析關鍵詞字串
    parseKeywords: function(kw) {
      if (Array.isArray(kw)) return kw;
      const cacheKey = String(kw || '');
      
      const result = cacheKey.replace(/^\[|\]$/g, '')
        .split(/[,，]/)
        .map(s => s.replace(/^['"]|['"]$/g, '').trim())
        .filter(Boolean);
      
      return result;
    },

    // 數字格式化
    formatNumber: function(num) {
      return new Intl.NumberFormat('zh-TW').format(num);
    },

    // 檢查是否為有效的日治時期年份
    isValidJapaneseColonialYear: function(year) {
      const y = parseInt(year);
      return y >= 1895 && y <= 1945;
    },

    // 清理緩存（記憶體管理）
    clearCache: function() {
      const maxCacheSize = 1000;
      
      if (CACHE.normalizedTexts.size > maxCacheSize) {
        const keys = Array.from(CACHE.normalizedTexts.keys()).slice(0, maxCacheSize / 2);
        keys.forEach(key => CACHE.normalizedTexts.delete(key));
      }
      
      if (CACHE.escapeRegExp.size > maxCacheSize) {
        const keys = Array.from(CACHE.escapeRegExp.keys()).slice(0, maxCacheSize / 2);
        keys.forEach(key => CACHE.escapeRegExp.delete(key));
      }

      if (CACHE.eraConversions.size > maxCacheSize) {
        const keys = Array.from(CACHE.eraConversions.keys()).slice(0, maxCacheSize / 2);
        keys.forEach(key => CACHE.eraConversions.delete(key));
      }
    },

    // 除錯用：顯示快取狀態
    getCacheStats: function() {
      return {
        normalizedTexts: CACHE.normalizedTexts.size,
        escapeRegExp: CACHE.escapeRegExp.size,
        eraConversions: CACHE.eraConversions.size
      };
    }
  };

  // 使用模組註冊系統，而不是全域變數
  if (typeof global.TaiwanNewsApp === 'undefined') {
    global.TaiwanNewsApp = {};
  }
  global.TaiwanNewsApp.Utils = Utils;

})(this);