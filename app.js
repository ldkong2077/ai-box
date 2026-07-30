/* =========================================================
   app.js — 渲染 / 筛选 / 弹窗 / 主题 / 中英切换 / 动画
   依赖 projects.js 暴露的 window.PROJECTS 与 window.CATEGORIES
   ========================================================= */
(function () {
  'use strict';

  var PROJECTS = window.PROJECTS || [];
  var CATEGORIES = window.CATEGORIES || {};

  // 状态
  var LANG = localStorage.getItem('lang') || 'zh';
  var THEME = localStorage.getItem('theme') ||
    (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');

  var activeCat = 'all';
  var activeStatus = 'all';
  var modalId = null;

  var STATUS = {
    open:  { zh: '已开源',     en: 'Open Source' },
    soon:  { zh: '即将开源',   en: 'Coming Soon' },
    deploy: { zh: '私有化部署', en: 'Private Deploy' },
  };
  var CAT_ORDER = ['ai-dev', 'ai-app', 'infra', 'industry', 'fintech', 'efficiency'];

  function t(obj) { return obj ? (obj[LANG] != null ? obj[LANG] : obj.zh) : ''; }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* ---------------- 滚动动画 · 元素检测 ---------------- */
  function initReveal() {
    if (!('IntersectionObserver' in window)) {
      document.querySelectorAll('.reveal').forEach(function (el) { el.classList.add('visible'); });
      return;
    }
    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('visible'); obs.unobserve(en.target); }
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });
    document.querySelectorAll('.reveal').forEach(function (el) { obs.observe(el); });
  }

  /* ---------------- 导航阴影 + 返回顶部 ---------------- */
  function initScrollEffects() {
    var nav = document.querySelector('.nav');
    var backTop = document.getElementById('back-top');
    if (!nav) return;
    var ticking = false;

    function onScroll() {
      if (!ticking) {
        requestAnimationFrame(function () {
          var y = window.scrollY;
          nav.classList.toggle('scrolled', y > 20);
          if (backTop) backTop.classList.toggle('show', y > 400);
          ticking = false;
        });
        ticking = true;
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    if (backTop) {
      backTop.addEventListener('click', function () {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }
  }

  /* ---------------- 筛选条 ---------------- */
  function chip(key, label, active, extraCls) {
    var b = document.createElement('button');
    b.className = 'chip' + (active ? ' active' : '') + (extraCls ? ' ' + extraCls : '');
    b.textContent = label;
    b.dataset.key = key;
    b.addEventListener('click', function () {
      if (key === 'all') { activeCat = 'all'; activeStatus = 'all'; }
      else if (key.indexOf('cat:') === 0) { activeCat = key.slice(4); }
      else if (key.indexOf('st:') === 0) { activeStatus = key.slice(3); }
      renderFilters();
      renderProjects();
      // 滚动到项目区
      document.getElementById('projects').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    return b;
  }

  function renderFilters() {
    var catBar = document.getElementById('filters-cat');
    var stBar = document.getElementById('filters-status');
    if (!catBar || !stBar) return;
    catBar.innerHTML = '';
    stBar.innerHTML = '';

    catBar.appendChild(chip('all', LANG === 'zh' ? '全部项目' : 'All Projects',
      activeCat === 'all' && activeStatus === 'all'));

    CAT_ORDER.forEach(function (k) {
      if (!CATEGORIES[k]) return;
      catBar.appendChild(chip('cat:' + k, t(CATEGORIES[k]), activeCat === k && activeStatus === 'all'));
    });

    ['open', 'soon', 'deploy'].forEach(function (s) {
      stBar.appendChild(chip('st:' + s, t(STATUS[s]), activeStatus === s && activeCat === 'all'));
    });
  }

  /* ---------------- 项目卡片 ---------------- */
  function badgeStatus(st) {
    return '<span class="badge badge-' + st + '">' + esc(t(STATUS[st])) + '</span>';
  }
  function badgeOrigin(p) {
    if (p.original) {
      return '<span class="badge badge-orig">' + (LANG === 'zh' ? '原创' : 'Original') + '</span>';
    }
    return '<span class="badge badge-fork">' +
      (LANG === 'zh' ? '基于 One-API' : 'One-API fork') + '</span>';
  }

  function projectMatches(p) {
    var okCat = activeCat === 'all' || p.cat === activeCat;
    var okSt = activeStatus === 'all' || p.status === activeStatus;
    return okCat && okSt;
  }

  function renderProjects() {
    var grid = document.getElementById('grid');
    if (!grid) return;
    grid.innerHTML = '';
    var list = PROJECTS.filter(projectMatches);

    if (!list.length) {
      grid.innerHTML = '<p style="color:var(--ink-faint);grid-column:1/-1;text-align:center;padding:40px 0;">' +
        (LANG === 'zh' ? '该分类下暂无项目。' : 'No projects in this filter.') + '</p>';
      return;
    }

    list.forEach(function (p, idx) {
      var card = document.createElement('article');
      card.className = 'card';
      card.tabIndex = 0;
      card.setAttribute('role', 'button');
      card.setAttribute('aria-label', esc(t(p.name)));

      var highlights = (p.highlights && p.highlights[LANG] || p.highlights && p.highlights.zh || []).map(function (x) {
        return '<span class="hl-tag">' + esc(x) + '</span>';
      }).join('');

      var tech = (p.tech || []).slice(0, 4).map(function (x) {
        return '<span class="tech">' + esc(x) + '</span>';
      }).join('');

      card.innerHTML =
        '<div class="card-thumb"><img loading="lazy" src="assets/thumb-' + esc(p.id) +
          '.svg" alt="' + esc(t(p.name)) + '"></div>' +
        '<div class="card-body">' +
          '<div class="badges">' + badgeStatus(p.status) + badgeOrigin(p) + '</div>' +
          '<div class="card-cat">' + esc(t(CATEGORIES[p.cat] || { zh: '', en: '' })) + '</div>' +
          '<h3 class="card-name">' + esc(t(p.name)) + '</h3>' +
          '<p class="card-tag">' + esc(t(p.tagline)) + '</p>' +
          (highlights ? '<div class="card-highlights">' + highlights + '</div>' : '') +
          '<div class="card-tech">' + tech + '</div>' +
        '</div>' +
        '<div class="card-foot">' +
          '<button class="btn btn-ghost" data-act="detail">' +
            (LANG === 'zh' ? '查看详情' : 'Details') + '</button>' +
          (p.repo ? '<a class="btn btn-primary" href="' + esc(p.repo) +
            '" target="_blank" rel="noopener" data-act="repo">GitHub</a>'
            : '<button class="btn btn-ghost" disabled data-act="norepo">' +
              (LANG === 'zh' ? '仓库整理中' : 'Repo pending') + '</button>') +
        '</div>';

      function open() { openModal(p.id); }
      card.addEventListener('click', function (e) {
        var act = e.target.getAttribute && e.target.getAttribute('data-act');
        if (act === 'repo') return;
        if (act === 'norepo') return;
        open();
      });
      card.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
      });

      // 延迟添加动画（按索引错开）
      card.style.opacity = '0';
      card.style.transform = 'translateY(20px)';
      card.style.transition = 'opacity 0.4s ease, transform 0.4s ease';

      grid.appendChild(card);

      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          card.style.opacity = '1';
          card.style.transform = 'none';
        });
      });
    });

    var count = document.getElementById('proj-count');
    if (count) count.textContent = list.length;
  }

  /* ---------------- 弹窗 ---------------- */
  function openModal(id) {
    var p = PROJECTS.filter(function (x) { return x.id === id; })[0];
    if (!p) return;
    modalId = id;
    var back = document.getElementById('modal-back');
    var box = document.getElementById('modal');

    var depth = (p.depth && p.depth[LANG] || p.depth && p.depth.zh || []).map(function (x) {
      return '<li>' + esc(x) + '</li>';
    }).join('');
    var tech = (p.tech || []).map(function (x) {
      return '<span class="tech">' + esc(x) + '</span>';
    }).join('');
    var bizValue = t(p.businessValue);

    box.innerHTML =
      '<div class="modal-head">' +
        '<img src="assets/thumb-' + esc(p.id) + '.svg" alt="' + esc(t(p.name)) + '">' +
        '<div class="mh-text">' +
          '<div class="badges">' + badgeStatus(p.status) + badgeOrigin(p) + '</div>' +
          '<h3>' + esc(t(p.name)) + '</h3>' +
          '<p class="mh-tag">' + esc(t(p.tagline)) + '</p>' +
        '</div>' +
        '<button class="modal-close" id="modal-x" aria-label="close">✕</button>' +
      '</div>' +
      '<div class="modal-body">' +
        '<h4 class="section-title">' + (LANG === 'zh' ? '项目简介' : 'Overview') + '</h4>' +
        '<p>' + esc(t(p.desc)) + '</p>' +
        '<h4 class="section-title">' + (LANG === 'zh' ? '技术深度' : 'Technical Depth') + '</h4>' +
        '<ul>' + depth + '</ul>' +
        '<h4 class="section-title">' + (LANG === 'zh' ? '应用价值' : 'Practical Value') + '</h4>' +
        '<p>' + esc(t(p.value)) + '</p>' +
        (bizValue ? '<div class="modal-biz-box">' +
          '<h4>' + (LANG === 'zh' ? '💡 落地场景' : '💡 Real-world Scenarios') + '</h4>' +
          '<p>' + esc(bizValue) + '</p>' +
          '<p style="margin-top:8px;font-size:13px;">' +
            (LANG === 'zh' ? '如果这契合你的业务，或想进一步了解设计细节，欢迎联系我交流。' : 'If this fits your context, or you’d like to dive into the design, feel free to reach out.') +
          '</p>' +
        '</div>' : '') +
        '<h4 class="section-title">' + (LANG === 'zh' ? '技术栈' : 'Tech Stack') + '</h4>' +
        '<div class="modal-tech">' + tech + '</div>' +
        '<div class="modal-actions">' +
          (p.repo
            ? '<a class="btn btn-primary" href="' + esc(p.repo) + '" target="_blank" rel="noopener">' +
              (LANG === 'zh' ? '查看源码 ↗' : 'View Source ↗') + '</a>'
            : '<span class="btn btn-ghost" style="cursor:default">' +
                (LANG === 'zh' ? '仓库整理中，即将开源' : 'Repo being prepared') + '</span>') +
          '<a class="btn btn-outline" href="#contact" onclick="closeModal()">' +
            (LANG === 'zh' ? '💬 联系我' : '💬 Contact Me') + '</a>' +
          (p.demo
            ? '<a class="btn btn-ghost" href="' + esc(p.demo) + '" target="_blank" rel="noopener">' +
                (LANG === 'zh' ? '在线演示' : 'Live Demo') + ' ↗</a>'
            : '') +
        '</div>' +
      '</div>';

    back.classList.add('open');
    document.body.style.overflow = 'hidden';
    document.getElementById('modal-x').addEventListener('click', closeModal);
    // 阻止弹窗内部点击关闭
    box.addEventListener('click', function (e) { e.stopPropagation(); });
  }

  function closeModal() {
    var back = document.getElementById('modal-back');
    if (!back) return;
    back.classList.remove('open');
    document.body.style.overflow = '';
    modalId = null;
  }
  // 暴露给内联 onclick
  window.closeModal = closeModal;

  /* ---------------- 主题 / 语言 ---------------- */
  function applyTheme() {
    document.documentElement.setAttribute('data-theme', THEME);
    var btn = document.getElementById('theme-btn');
    if (btn) btn.textContent = THEME === 'dark' ? '☀️' : '🌙';
    localStorage.setItem('theme', THEME);
  }
  function applyLang() {
    localStorage.setItem('lang', LANG);
    document.documentElement.setAttribute('lang', LANG === 'zh' ? 'zh-CN' : 'en');
    // 静态文案（带 data-en 的元素）
    document.querySelectorAll('[data-en]').forEach(function (el) {
      var zh = el.getAttribute('data-zh');
      if (zh == null) { zh = el.textContent; el.setAttribute('data-zh', zh); }
      el.textContent = LANG === 'en' ? el.getAttribute('data-en') : zh;
    });
    // 语言切换按钮：显示"目标语言"
    var lb = document.getElementById('lang-btn');
    if (lb) lb.textContent = LANG === 'zh' ? 'EN' : '中';
    renderFilters();
    renderProjects();
    if (modalId) openModal(modalId);
  }

  /* ---------------- 导航高亮 ---------------- */
  function initScrollSpy() {
    var links = {};
    document.querySelectorAll('.nav-links a').forEach(function (a) {
      var id = a.getAttribute('href');
      if (id && id.charAt(0) === '#') links[id.slice(1)] = a;
    });
    if (!('IntersectionObserver' in window)) return;
    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        var a = links[en.target.id];
        if (!a) return;
        if (en.isIntersecting) {
          Object.keys(links).forEach(function (k) { links[k].style.color = ''; links[k].style.fontWeight = ''; });
          a.style.color = 'var(--accent)';
          a.style.fontWeight = '700';
        }
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    ['projects', 'about', 'skills', 'contact'].forEach(function (id) {
      var s = document.getElementById(id); if (s) obs.observe(s);
    });
  }

  /* ---------------- 初始化 ---------------- */
  document.addEventListener('DOMContentLoaded', function () {
    applyTheme();
    applyLang();
    renderFilters();
    renderProjects();
    initScrollSpy();
    initReveal();
    initScrollEffects();

    var tb = document.getElementById('theme-btn');
    if (tb) tb.addEventListener('click', function () {
      THEME = THEME === 'dark' ? 'light' : 'dark'; applyTheme();
    });
    var lb = document.getElementById('lang-btn');
    if (lb) lb.addEventListener('click', function () {
      LANG = LANG === 'zh' ? 'en' : 'zh'; applyLang();
    });

    var back = document.getElementById('modal-back');
    if (back) back.addEventListener('click', function (e) {
      if (e.target === back) closeModal();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && modalId) closeModal();
    });
  });
})();