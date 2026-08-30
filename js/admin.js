(function () {
  'use strict';

  const C = window.MAP_CONFIG || {};
  let places = [];
  let map = null;
  let markers = [];
  let geocoder = null;
  let editMarker = null;
  let pickMode = false;
  let editingId = null;
  let currentColor = '#2563eb';
  let currentLng = null;
  let currentLat = null;
  let draftPhotos = [];
  let placeSearcher = null;
  let searchTimer = null;
  let lastPlaceResults = [];
  let pendingEditId = null;

  const $ = function (id) { return document.getElementById(id); };

  function init() {
    $('loginHint').textContent = App.isCloudConfigured() ? '输入云端管理密码' : '输入管理密码';
    $('loginForm').addEventListener('submit', function (e) {
      e.preventDefault();
      doLogin();
    });
    bindEvents();
    buildSwatches();
    buildCategoryList();
  }

  async function doLogin() {
    const pwd = $('loginPassword').value;
    $('loginError').textContent = '';
    try {
      await App.tryLogin(pwd);
      $('loginScreen').hidden = true;
      $('editor').hidden = false;
      await initEditor();
    } catch (e) {
      $('loginError').textContent = e.message || '密码不正确';
    }
  }

  async function initEditor() {
    places = await App.loadPlaces();
    const params = new URLSearchParams(window.location.search);
    pendingEditId = params.get('edit');
    updateCount();
    renderList();
    App.loadAmap(initMap);
  }

  function bindEvents() {
    $('saveBtn').addEventListener('click', savePlace);
    $('cancelBtn').addEventListener('click', resetForm);
    $('geocodeBtn').addEventListener('click', onGeocode);
    $('addressInput').addEventListener('input', onAddressInput);
    $('placeResults').addEventListener('click', onPlacePick);
    $('pickBtn').addEventListener('click', togglePick);
    $('exportBtn').addEventListener('click', exportData);
    $('importBtn').addEventListener('click', function () { $('fileInput').click(); });
    $('fileInput').addEventListener('change', importData);
    $('bulkBtn').addEventListener('click', openBulk);
    $('bulkCancel').addEventListener('click', closeBulk);
    $('bulkOk').addEventListener('click', runBulk);
    $('sampleBtn').addEventListener('click', deleteSamples);
    $('adminSearch').addEventListener('input', renderList);
    $('adminList').addEventListener('click', onListClick);
    $('photoInput').addEventListener('change', onPhotosSelected);
    $('photoPreviews').addEventListener('click', onPhotoRemove);

    Array.prototype.forEach.call(document.querySelectorAll('input[name="placeType"]'), function (r) {
      r.addEventListener('change', onTypeChange);
    });
  }

  function getType() {
    const r = document.querySelector('input[name="placeType"]:checked');
    return r ? r.value : 'place';
  }

  function onTypeChange() {
    const work = getType() === 'work';
    $('categoryInput').disabled = work;
    $('colorSwatches').classList.toggle('disabled', work);
    if (work) currentColor = App.WORK_COLOR;
    renderSwatches();
  }

  function buildSwatches() {
    $('colorSwatches').innerHTML = App.ALL_COLORS.map(function (c) {
      return '<button type="button" class="swatch" data-color="' + c + '" style="background:' + c + '"></button>';
    }).join('');
    $('colorSwatches').addEventListener('click', function (e) {
      const sw = e.target.closest('.swatch');
      if (!sw || getType() === 'work') return;
      currentColor = sw.dataset.color;
      renderSwatches();
    });
    renderSwatches();
  }

  function renderSwatches() {
    Array.prototype.forEach.call(document.querySelectorAll('.swatch'), function (sw) {
      sw.classList.toggle('active', sw.dataset.color.toLowerCase() === currentColor.toLowerCase());
    });
  }

  function buildCategoryList() {
    $('categoryList').innerHTML = App.DEFAULT_CATEGORIES.map(function (c) {
      return '<option value="' + c + '">';
    }).join('');
  }

  function renderPhotos() {
    const cloud = App.isCloudConfigured();
    $('photoInput').disabled = !cloud;
    $('photoHint').textContent = cloud ? '每张图片会自动压缩后上传到云端' : '配置云端数据库后才能上传图片';
    $('photoPreviews').innerHTML = draftPhotos.map(function (url, i) {
      return '<div class="photo-thumb">' +
        '<img src="' + App.escapeHtml(url) + '" alt="">' +
        '<button class="photo-remove" data-url="' + App.escapeHtml(url) + '" data-index="' + i + '" type="button" title="删除">×</button>' +
      '</div>';
    }).join('');
  }

  async function onPhotosSelected() {
    const files = Array.prototype.slice.call($('photoInput').files || []);
    $('photoInput').value = '';
    if (!files.length) return;
    for (let i = 0; i < files.length; i++) {
      try {
        const url = await App.uploadPhoto(files[i]);
        draftPhotos.push(url);
        renderPhotos();
      } catch (e) {
        toast(e.message || '图片上传失败', true);
      }
    }
  }

  function onPhotoRemove(e) {
    const btn = e.target.closest('.photo-remove');
    if (!btn) return;
    const url = btn.dataset.url;
    const idx = draftPhotos.indexOf(url);
    if (idx > -1) draftPhotos.splice(idx, 1);
    App.deletePhoto(url).catch(function () { /* 云端删除失败也不影响保存 */ });
    renderPhotos();
  }

  function initMap() {
    map = new AMap.Map('adminMap', {
      center: C.mapCenter || [121.56, 31.22],
      zoom: C.mapZoom || 11,
      resizeEnable: true
    });
    map.on('click', onMapClick);
    renderMarkers();
    if (markers.length) map.setFitView(markers, false, [80, 80, 80, 80]);
    if (pendingEditId) {
      const target = places.find(function (p) { return p.id === pendingEditId; });
      pendingEditId = null;
      if (target) {
        startEdit(target.id);
        const panel = document.querySelector('.form-panel');
        if (panel) panel.scrollIntoView({ block: 'start', behavior: 'smooth' });
      }
    }
  }

  function renderMarkers() {
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
        offset: new AMap.Pixel(-13, -13)
      });
      marker._place = p;
      marker.on('click', function () { startEdit(p.id); });
      markers.push(marker);
    });
    updateEditMarker();
  }

  function updateEditMarker() {
    if (!map) return;
    if (!editMarker) {
      editMarker = new AMap.Marker({
        map: map,
        draggable: true,
        offset: new AMap.Pixel(-13, -13),
        zIndex: 200
      });
      editMarker.hide();
      editMarker.on('dragend', function () {
        const pos = editMarker.getPosition();
        setCoords(pos.lng, pos.lat);
      });
    }
    if (currentLng != null && currentLat != null) {
      editMarker.setPosition([currentLng, currentLat]);
      editMarker.show();
    } else {
      editMarker.hide();
    }
  }

  function setCoords(lng, lat) {
    currentLng = Number(lng);
    currentLat = Number(lat);
    $('coordText').textContent = '坐标：' + currentLng.toFixed(6) + ', ' + currentLat.toFixed(6);
    updateEditMarker();
    if (map) map.setCenter([currentLng, currentLat]);
  }

  function onMapClick(e) {
    if (!pickMode) return;
    setCoords(e.lnglat.lng, e.lnglat.lat);
    setPickMode(false);
  }

  function togglePick() {
    setPickMode(!pickMode);
  }

  function setPickMode(on) {
    pickMode = on;
    $('pickBtn').textContent = on ? '取消点选' : '在地图上点选';
    if (map) map.setDefaultCursor(on ? 'crosshair' : 'default');
  }

  function geocode(address) {
    return searchPlaces(address).then(function (pois) {
      if (pois.length) {
        const p = pois[0];
        return { lng: p.location.lng, lat: p.location.lat, name: p.name, address: p.address };
      }
      return legacyGeocode(address);
    });
  }

  function legacyGeocode(address) {
    return new Promise(function (resolve) {
      if (!geocoder) geocoder = new AMap.Geocoder({ city: '上海' });
      geocoder.getLocation(address, function (status, result) {
        if (status === 'complete' && result && result.geocodes && result.geocodes.length) {
          const g = result.geocodes[0];
          resolve({ lng: g.location.lng, lat: g.location.lat, name: '', address: g.formattedAddress || '' });
        } else {
          resolve(null);
        }
      });
    });
  }

  function searchPlaces(keyword) {
    return new Promise(function (resolve) {
      if (!placeSearcher) placeSearcher = new AMap.PlaceSearch({ city: '上海', pageSize: 8, pageIndex: 1 });
      placeSearcher.search(keyword, function (status, result) {
        if (status === 'complete' && result && result.poiList && result.poiList.pois) {
          resolve(result.poiList.pois);
        } else {
          resolve([]);
        }
      });
    });
  }

  function onAddressInput() {
    clearTimeout(searchTimer);
    const value = $('addressInput').value.trim();
    if (value.length < 2) {
      $('placeResults').innerHTML = '';
      return;
    }
    searchTimer = setTimeout(async function () {
      const pois = await searchPlaces(value);
      if ($('addressInput').value.trim() !== value) return;
      showPlaceResults(pois);
    }, 350);
  }

  function showPlaceResults(pois) {
    lastPlaceResults = pois;
    if (!pois.length) {
      $('placeResults').innerHTML = '';
      return;
    }
    $('placeResults').innerHTML = pois.map(function (p, i) {
      return '<button class="place-result" data-index="' + i + '" type="button">' +
        '<span class="place-result-name">' + App.escapeHtml(p.name) + '</span>' +
        '<span class="place-result-addr">' + App.escapeHtml(p.address || '') + '</span>' +
      '</button>';
    }).join('');
  }

  function onPlacePick(e) {
    const btn = e.target.closest('.place-result');
    if (!btn) return;
    const p = lastPlaceResults[Number(btn.dataset.index)];
    if (!p) return;
    if (!$('nameInput').value.trim()) $('nameInput').value = p.name;
    $('addressInput').value = p.address || p.name;
    setCoords(p.location.lng, p.location.lat);
    $('placeResults').innerHTML = '';
    toast('已定位：' + p.name);
  }

  async function onGeocode() {
    const address = $('addressInput').value.trim();
    if (!address) {
      toast('请先填写地址', true);
      return;
    }
    $('geocodeBtn').disabled = true;
    $('geocodeBtn').textContent = '定位中…';
    const loc = await geocode(address);
    $('geocodeBtn').disabled = false;
    $('geocodeBtn').textContent = '定位';
    if (!loc) {
      toast('没有找到这个地址', true);
      return;
    }
    setCoords(loc.lng, loc.lat);
    if (loc.address) $('addressInput').value = loc.address;
    $('placeResults').innerHTML = '';
    toast(loc.name ? '已定位：' + loc.name : '已定位');
  }

  async function savePlace() {
    const name = $('nameInput').value.trim();
    if (!name) {
      toast('请填写名称', true);
      return;
    }
    const type = getType();
    if (currentLng == null || currentLat == null) {
      const address = $('addressInput').value.trim();
      if (address) {
        const loc = await geocode(address);
        if (loc) setCoords(loc.lng, loc.lat);
      }
    }
    if (currentLng == null || currentLat == null) {
      toast('请先定位地址或在地图上点选坐标', true);
      return;
    }
    const category = type === 'work' ? '' : ($('categoryInput').value.trim() || '其他');
    const data = {
      name: name,
      type: type,
      category: category,
      address: $('addressInput').value.trim(),
      note: $('noteInput').value.trim(),
      color: type === 'work' ? App.WORK_COLOR : currentColor,
      lng: currentLng,
      lat: currentLat,
      photos: draftPhotos.slice()
    };
    if (editingId) {
      const idx = places.findIndex(function (p) { return p.id === editingId; });
      if (idx > -1) places[idx] = Object.assign({}, places[idx], data);
    } else {
      places.push(Object.assign({ id: App.uid(), sample: false, sort: places.length }, data));
    }
    const ok = await saveAndRefresh();
    if (ok) resetForm();
  }

  async function saveAndRefresh() {
    const status = $('syncStatus');
    status.textContent = '保存中…';
    try {
      const cloud = await App.savePlaces(places);
      status.textContent = cloud ? '已同步云端' : '已保存到本机';
      updateCount();
      renderList();
      renderMarkers();
      toast('已保存');
    } catch (e) {
      status.textContent = '保存失败';
      toast(e.message || '保存失败，请重试', true);
      if (e && e.status === 401) {
        sessionStorage.removeItem('pudong_admin_token');
        $('loginError').textContent = '登录已过期，请重新登录';
        $('loginScreen').hidden = false;
        $('editor').hidden = true;
      }
      return false;
    }
    return true;
  }

  function resetForm() {
    editingId = null;
    $('formTitle').textContent = '新增地点';
    $('nameInput').value = '';
    $('categoryInput').value = '';
    $('addressInput').value = '';
    $('noteInput').value = '';
    draftPhotos = [];
    renderPhotos();
    $('placeResults').innerHTML = '';
    $('cancelBtn').hidden = true;
    $('typePlace').checked = true;
    currentLng = null;
    currentLat = null;
    currentColor = '#2563eb';
    $('coordText').textContent = '坐标：未设置';
    onTypeChange();
    updateEditMarker();
    setPickMode(false);
  }

  function startEdit(id) {
    const p = places.find(function (x) { return x.id === id; });
    if (!p) return;
    editingId = p.id;
    $('formTitle').textContent = '编辑地点';
    $('nameInput').value = p.name;
    (p.type === 'work' ? $('typeWork') : $('typePlace')).checked = true;
    onTypeChange();
    $('categoryInput').value = p.category || '';
    $('addressInput').value = p.address || '';
    $('noteInput').value = p.note || '';
    draftPhotos = Array.isArray(p.photos) ? p.photos.slice() : [];
    renderPhotos();
    currentColor = p.type === 'work' ? App.WORK_COLOR : (p.color || '#2563eb');
    renderSwatches();
    $('cancelBtn').hidden = false;
    if (p.lng != null && p.lat != null) {
      setCoords(p.lng, p.lat);
    } else {
      currentLng = null;
      currentLat = null;
      $('coordText').textContent = '坐标：未设置';
      updateEditMarker();
    }
    const panel = document.querySelector('.form-panel');
    if (panel) panel.scrollTop = 0;
    if (map) {
      map.setZoomAndCenter(12, [p.lng || map.getCenter().lng, p.lat || map.getCenter().lat]);
    }
  }

  function onListClick(e) {
    const item = e.target.closest('.admin-item');
    if (!item) return;
    const id = item.dataset.id;
    if (e.target.closest('.edit')) {
      startEdit(id);
      return;
    }
    if (e.target.closest('.delete')) {
      if (confirm('确定删除这个地点吗？')) {
        places = places.filter(function (p) { return p.id !== id; });
        if (editingId === id) resetForm();
        saveAndRefresh();
      }
    }
  }

  function renderList() {
    const q = $('adminSearch').value.trim().toLowerCase();
    const filtered = places.filter(function (p) {
      return !q || (p.name + ' ' + (p.address || '') + ' ' + (p.note || '')).toLowerCase().indexOf(q) > -1;
    });
    $('adminList').innerHTML = filtered.map(function (p) {
      const color = p.type === 'work' ? App.WORK_COLOR : (p.color || '#2563eb');
      const tag = p.type === 'work' ? '工作地点' : (p.category || '未分类');
      return '<div class="admin-item" data-id="' + p.id + '">' +
        '<span class="dot" style="background:' + color + '"></span>' +
        '<div class="admin-main">' +
          '<div class="place-name">' + App.escapeHtml(p.name) + '</div>' +
          '<div class="place-meta">' + App.escapeHtml(tag) +
            (p.address ? ' · ' + App.escapeHtml(p.address) : '') + '</div>' +
          (p.note ? '<div class="place-note">' + App.escapeHtml(p.note) + '</div>' : '') +
        '</div>' +
        '<button class="btn btn-primary btn-small edit" type="button">编辑</button>' +
        '<button class="btn btn-ghost btn-small delete" type="button">删除</button>' +
      '</div>';
    }).join('') || '<div class="empty">暂无地点</div>';
  }

  function updateCount() {
    $('countText').textContent = '（' + places.length + '）';
  }

  function exportData() {
    const blob = new Blob([JSON.stringify(places, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'pudong-map-data.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }

  function importData(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function () {
      try {
        const data = JSON.parse(reader.result);
        if (!Array.isArray(data)) throw new Error('格式不正确');
        if (!confirm('导入会替换当前所有地点，确定继续吗？')) return;
        places = data.map(function (p) {
          return {
            id: p.id || App.uid(),
            name: p.name || '',
            type: p.type === 'work' ? 'work' : 'place',
            category: p.category || '',
            address: p.address || '',
            lng: p.lng,
            lat: p.lat,
            note: p.note || '',
            color: p.color || '',
            photos: Array.isArray(p.photos) ? p.photos : [],
            sample: false,
            sort: p.sort || 0
          };
        });
        saveAndRefresh();
      } catch (err) {
        toast('导入失败：文件不是有效的数据备份', true);
      }
    };
    reader.readAsText(file);
  }

  function openBulk() {
    $('bulkText').value = '';
    $('bulkProgress').textContent = '';
    $('bulkModal').hidden = false;
  }

  function closeBulk() {
    $('bulkModal').hidden = true;
  }

  async function runBulk() {
    const lines = $('bulkText').value.split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
    if (!lines.length) return;
    $('bulkOk').disabled = true;
    let okCount = 0;
    let failCount = 0;
    for (let i = 0; i < lines.length; i++) {
      const parts = lines[i].split(/[,，]/).map(function (s) { return s.trim(); });
      const name = parts[0];
      const address = parts[1] || '';
      const note = parts[2] || '';
      const category = parts[3] || '其他';
      $('bulkProgress').textContent = '正在处理 ' + (i + 1) + '/' + lines.length + '：' + name;
      if (!name || !address) {
        failCount++;
        continue;
      }
      const loc = await geocode(address);
      if (!loc) {
        failCount++;
        continue;
      }
      places.push({
        id: App.uid(),
        name: name,
        type: 'place',
        category: category,
        address: address,
        note: note,
        lng: loc.lng,
        lat: loc.lat,
        color: App.CATEGORY_COLORS[category] || '#2563eb',
        sample: false,
        sort: places.length
      });
      okCount++;
      await delay(150);
    }
    await saveAndRefresh();
    $('bulkProgress').textContent = '完成：成功 ' + okCount + ' 个，失败 ' + failCount + ' 个';
    $('bulkOk').disabled = false;
    if (failCount === 0) closeBulk();
  }

  function deleteSamples() {
    const count = places.filter(function (p) { return p.sample; }).length;
    if (!count) {
      toast('没有示例地点');
      return;
    }
    if (!confirm('确定删除全部 ' + count + ' 个示例地点吗？')) return;
    places = places.filter(function (p) { return !p.sample; });
    saveAndRefresh();
  }

  function delay(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  function toast(msg, isError) {
    const t = $('toast');
    t.textContent = msg;
    t.classList.toggle('error', !!isError);
    t.hidden = false;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(function () { t.hidden = true; }, 2600);
  }

  init();
})();
