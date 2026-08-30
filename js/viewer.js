(function () {
  'use strict';

  const C = window.MAP_CONFIG || {};
  let map = null;
  let infoWindow = null;
  let routeControl = null;
  let places = [];
  let markers = [];
  let searchText = '';
  let activeCategory = 'all';
  let activeMode = 'driving';
  let lastSteps = [];

  const $ = function (id) { return document.getElementById(id); };

  function init() {
    bindEvents();
    App.loadPlaces().then(function (data) {
      places = data;
      renderChips();
      renderSelects();
      renderList();
      App.loadAmap(initMap);
    });
  }

  function bindEvents() {
    $('searchInput').addEventListener('input', function () {
      searchText = this.value;
      renderList();
      applyFilter();
    });

    $('categoryChips').addEventListener('click', function (e) {
      const btn = e.target.closest('.chip');
      if (!btn) return;
      activeCategory = btn.dataset.category;
      Array.prototype.forEach.call(this.querySelectorAll('.chip'), function (c) {
        c.classList.toggle('active', c === btn);
      });
      renderList();
      applyFilter();
    });

    Array.prototype.forEach.call(document.querySelectorAll('.tab'), function (tab) {
      tab.addEventListener('click', function () {
        switchTab(this.dataset.tab);
      });
    });

    $('originSelect').addEventListener('change', function () { $('routeResult').innerHTML = ''; });
    $('destSelect').addEventListener('change', function () { $('routeResult').innerHTML = ''; });

    $('modeRow').addEventListener('click', function (e) {
      const btn = e.target.closest('.mode-btn');
      if (!btn) return;
      activeMode = btn.dataset.mode;
      Array.prototype.forEach.call(this.querySelectorAll('.mode-btn'), function (b) {
        b.classList.toggle('active', b === btn);
      });
      $('routeResult').innerHTML = '';
    });

    $('routeBtn').addEventListener('click', planRoute);
    $('clearRouteBtn').addEventListener('click', clearRoute);

    $('placeList').addEventListener('click', function (e) {
      const item = e.target.closest('.place-item');
      if (!item) return;
      focusPlace(item.dataset.id);
    });

    $('routeResult').addEventListener('click', function (e) {
      const btn = e.target.closest('[data-expand]');
      if (!btn) return;
      const ol = this.querySelector('.route-steps');
      if (ol) {
        ol.innerHTML = lastSteps.map(function (s) {
          return '<li>' + App.escapeHtml(s) + '</li>';
        }).join('');
      }
    });

    $('map').addEventListener('click', function (e) {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const id = btn.dataset.id;
      if (btn.dataset.action === 'dest') setRouteFromInfo(null, id);
      if (btn.dataset.action === 'origin') setRouteFromInfo(id, null);
    });
  }

  function switchTab(name) {
    Array.prototype.forEach.call(document.querySelectorAll('.tab'), function (t) {
      t.classList.toggle('active', t.dataset.tab === name);
    });
    $('placesTab').classList.toggle('active', name === 'places');
    $('routeTab').classList.toggle('active', name === 'route');
    if (map) setTimeout(function () { map.resize(); }, 80);
  }

  function initMap() {
    map = new AMap.Map('map', {
      center: C.mapCenter || [121.56, 31.22],
      zoom: C.mapZoom || 11,
      resizeEnable: true,
      viewMode: '2D'
    });
    infoWindow = new AMap.InfoWindow({ offset: new AMap.Pixel(0, -30), autoMove: true });
    buildMarkers();
    applyFilter();
    if (markers.length) map.setFitView(markers, false, [130, 130, 130, 130]);
  }

  function buildMarkers() {
    markers.forEach(function (m) { m.setMap(null); });
    markers = [];
    places.forEach(function (p) {
      if (p.lng == null || p.lat == null) return;
      const color = p.type === 'work' ? App.WORK_COLOR : (p.color || '#2563eb');
      const cls = p.type === 'work' ? 'pin work' : 'pin';
      const marker = new AMap.Marker({
        position: [p.lng, p.lat],
        content: '<div class="' + cls + '" style="--pin-color:' + color + '"><span>' +
          App.escapeHtml((p.name || '点').slice(0, 1)) + '</span></div>',
        offset: new AMap.Pixel(-13, -13),
        zIndex: p.type === 'work' ? 120 : 100,
        title: p.name
      });
      marker._place = p;
      marker.on('click', function () { openInfo(marker); });
      markers.push(marker);
    });
  }

  function matchesFilter(p) {
    const q = searchText.trim().toLowerCase();
    const text = (p.name + ' ' + (p.address || '') + ' ' + (p.note || '') + ' ' + (p.category || '')).toLowerCase();
    const textOk = !q || text.indexOf(q) > -1;
    let catOk = true;
    if (activeCategory === 'work') catOk = p.type === 'work';
    else if (activeCategory !== 'all') catOk = p.category === activeCategory;
    return textOk && catOk;
  }

  function applyFilter() {
    markers.forEach(function (m) {
      m.setMap(matchesFilter(m._place) ? map : null);
    });
  }

  function renderChips() {
    const cats = ['全部', '工作地点'];
    places.forEach(function (p) {
      if (p.type !== 'work' && p.category && cats.indexOf(p.category) === -1) cats.push(p.category);
    });
    $('categoryChips').innerHTML = cats.map(function (c) {
      const key = c === '全部' ? 'all' : (c === '工作地点' ? 'work' : c);
      return '<button class="chip' + (key === activeCategory ? ' active' : '') + '" data-category="' + key + '" type="button">' + App.escapeHtml(c) + '</button>';
    }).join('');
  }

  function renderSelects() {
    const work = places.filter(function (p) { return p.type === 'work'; });
    const others = places.filter(function (p) { return p.type !== 'work'; });
    const opt = function (p, label) {
      return '<option value="' + p.id + '">' + App.escapeHtml(label) + '</option>';
    };

    let oHtml = '<option value="">请选择出发地点</option>';
    work.forEach(function (p) { oHtml += opt(p, p.name + '（工作地点）'); });
    others.forEach(function (p) { oHtml += opt(p, p.name); });
    $('originSelect').innerHTML = oHtml;

    let dHtml = '<option value="">请选择到达地点</option>';
    others.forEach(function (p) { dHtml += opt(p, p.name); });
    work.forEach(function (p) { dHtml += opt(p, p.name + '（工作地点）'); });
    $('destSelect').innerHTML = dHtml;

    if (work.length) $('originSelect').value = work[0].id;
    if (others.length) $('destSelect').value = others[0].id;
  }

  function renderList() {
    const filtered = places.filter(matchesFilter);
    const list = $('placeList');
    if (!filtered.length) {
      list.innerHTML = '<div class="empty">暂无地点</div>';
      return;
    }
    list.innerHTML = filtered.map(function (p) {
      const color = p.type === 'work' ? App.WORK_COLOR : (p.color || '#2563eb');
      const tag = p.type === 'work' ? '工作地点' : (p.category || '未分类');
      return '<div class="place-item" data-id="' + p.id + '">' +
        '<span class="dot" style="background:' + color + '"></span>' +
        '<div class="place-main">' +
          '<div class="place-name">' + App.escapeHtml(p.name) + '</div>' +
          '<div class="place-meta">' + App.escapeHtml(tag) +
            (p.address ? ' · ' + App.escapeHtml(p.address) : '') + '</div>' +
          (p.note ? '<div class="place-note">' + App.escapeHtml(p.note) + '</div>' : '') +
        '</div>' +
      '</div>';
    }).join('');
  }

  function openInfo(marker) {
    const p = marker._place;
    const color = p.type === 'work' ? App.WORK_COLOR : (p.color || '#2563eb');
    const tag = p.type === 'work' ? '工作地点' : (p.category || '未分类');
    const note = p.note
      ? '<div class="iw-note">' + App.escapeHtml(p.note).replace(/\n/g, '<br>') + '</div>'
      : '';
    const photos = Array.isArray(p.photos) && p.photos.length
      ? p.photos
      : [];
    const photoHtml = photos.length
      ? '<div class="iw-photos">' + photos.map(function (u) {
          return '<a href="' + App.escapeHtml(u) + '" target="_blank" rel="noopener"><img src="' +
            App.escapeHtml(u) + '" alt=""></a>';
        }).join('') + '</div>'
      : '';
    const html = '<div class="iw">' +
      '<div class="iw-head"><span class="dot" style="background:' + color + '"></span><b>' +
        App.escapeHtml(p.name) + '</b></div>' +
      '<div class="iw-tag">' + App.escapeHtml(tag) + '</div>' +
      (p.address ? '<div class="iw-addr">' + App.escapeHtml(p.address) + '</div>' : '') +
      note +
      photoHtml +
      '<div class="iw-actions">' +
        '<button class="btn btn-ghost btn-small" data-action="origin" data-id="' + p.id + '" type="button">从这里出发</button>' +
        '<button class="btn btn-primary btn-small" data-action="dest" data-id="' + p.id + '" type="button">规划到这里</button>' +
      '</div>' +
    '</div>';
    infoWindow.setContent(html);
    infoWindow.open(map, marker.getPosition());
  }

  function focusPlace(id) {
    const marker = markers.find(function (m) { return m._place.id === id; });
    if (!marker) return;
    map.setZoomAndCenter(Math.max(map.getZoom(), 13), marker.getPosition());
    openInfo(marker);
  }

  function setRouteFromInfo(originId, destId) {
    if (originId) $('originSelect').value = originId;
    if (destId) $('destSelect').value = destId;
    switchTab('route');
    planRoute();
  }

  function planRoute() {
    const origin = places.find(function (p) { return p.id === $('originSelect').value; });
    const dest = places.find(function (p) { return p.id === $('destSelect').value; });
    const box = $('routeResult');
    if (!origin || !dest) {
      box.innerHTML = '<div class="empty">请选择出发和到达地点</div>';
      return;
    }
    clearRoute();
    routeControl = createPlanner(activeMode);
    box.innerHTML = '<div class="route-loading">正在规划路线…</div>';
    routeControl.search([origin.lng, origin.lat], [dest.lng, dest.lat], function (status, result) {
      if (status !== 'complete' || !result) {
        box.innerHTML = '<div class="empty">没找到路线，试试其他交通方式</div>';
        return;
      }
      renderResult(activeMode, result);
    });
  }

  function createPlanner(mode) {
    if (mode === 'transit') {
      return new AMap.Transfer({
        map: map,
        city: '上海',
        cityd: '上海',
        policy: AMap.TransferPolicy.LEAST_TIME,
        hideMarkers: true
      });
    }
    if (mode === 'riding') {
      return new AMap.Riding({ map: map, hideMarkers: true });
    }
    return new AMap.Driving({ map: map, policy: AMap.DrivingPolicy.LEAST_TIME, hideMarkers: true });
  }

  function clearRoute() {
    if (routeControl) {
      try { routeControl.clear(); } catch (e) { /* noop */ }
      routeControl = null;
    }
    $('routeResult').innerHTML = '';
  }

  function renderResult(mode, result) {
    const box = $('routeResult');
    const modeName = { driving: '驾车', transit: '公交', riding: '骑行' }[mode] || mode;
    if (mode === 'transit') {
      const plan = result.plans && result.plans[0];
      if (!plan) {
        box.innerHTML = '<div class="empty">没找到公交路线</div>';
        return;
      }
      const lines = (plan.transits || []).map(function (t) { return t.name; }).filter(Boolean).join('、');
      box.innerHTML = '<div class="route-summary">' +
        '<div class="route-mode">' + modeName + '</div>' +
        '<div class="route-stats"><b>' + App.formatTime(plan.time) + '</b><span>' +
          App.formatDistance(plan.distance) + '</span></div>' +
        (lines ? '<div class="route-lines">' + App.escapeHtml(lines) + '</div>' : '') +
        stepsHtml((plan.segments || []).map(function (s) { return s.instruction; }).filter(Boolean)) +
      '</div>';
      return;
    }
    const route = result.routes && result.routes[0];
    if (!route) {
      box.innerHTML = '<div class="empty">没找到路线</div>';
      return;
    }
    box.innerHTML = '<div class="route-summary">' +
      '<div class="route-mode">' + modeName + '</div>' +
      '<div class="route-stats"><b>' + App.formatTime(route.time) + '</b><span>' +
        App.formatDistance(route.distance) + '</span></div>' +
      stepsHtml((route.steps || []).map(function (s) { return s.instruction; }).filter(Boolean)) +
    '</div>';
  }

  function stepsHtml(steps) {
    lastSteps = steps;
    if (!steps.length) return '';
    const shown = steps.slice(0, 8);
    const more = steps.slice(8);
    let html = '<ol class="route-steps">';
    shown.forEach(function (s) {
      html += '<li>' + App.escapeHtml(s) + '</li>';
    });
    if (more.length) {
      html += '<li class="more-steps">还有 ' + more.length + ' 步 <button class="btn-link" data-expand type="button">展开</button></li>';
    }
    html += '</ol>';
    return html;
  }

  init();
})();
