/* 公共工具：数据存取、高德加载、格式转换 */
(function () {
  'use strict';

  const C = window.MAP_CONFIG || {};
  const LS_KEY = 'pudong_map_places_v1';
  const TOKEN_KEY = 'pudong_admin_token';
  const REFRESH_KEY = 'pudong_refresh_token';
  const SHARED = {};

  SHARED.CATEGORY_COLORS = {
    '美食': '#f59e0b',
    '景点': '#10b981',
    '购物': '#ec4899',
    '交通': '#8b5cf6',
    '医院': '#ef4444',
    '学校': '#14b8a6',
    '健身': '#f97316',
    '娱乐': '#06b6d4',
    '其他': '#64748b'
  };

  SHARED.WORK_COLOR = '#111827';
  SHARED.ALL_COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6', '#14b8a6', '#f97316', '#06b6d4', '#64748b'];
  SHARED.DEFAULT_CATEGORIES = ['美食', '景点', '购物', '交通', '医院', '学校', '健身', '娱乐', '其他'];

  SHARED.uid = function () {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (ch) {
      const v = (Math.random() * 16) | 0;
      return (ch === 'x' ? v : (v & 0x3) | 0x8).toString(16);
    });
  };

  SHARED.escapeHtml = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  };

  SHARED.formatDistance = function (m) {
    const km = Number(m || 0) / 1000;
    return km >= 1 ? km.toFixed(1) + ' 公里' : Math.round(Number(m || 0)) + ' 米';
  };

  SHARED.formatTime = function (sec) {
    const min = Math.round(Number(sec || 0) / 60);
    if (min < 60) return min + ' 分钟';
    return Math.floor(min / 60) + ' 小时 ' + (min % 60) + ' 分钟';
  };

  function samplePlaces() {
    return [
      {
        id: '10000000-0000-4000-8000-000000000001',
        name: '东方明珠',
        type: 'place',
        category: '景点',
        address: '浦东新区世纪大道1号',
        lng: 121.4998,
        lat: 31.2397,
        note: '示例地点，可在管理页删除或修改',
        color: '#10b981',
        sample: true,
        sort: 0
      },
      {
        id: '10000000-0000-4000-8000-000000000002',
        name: '世纪公园',
        type: 'place',
        category: '景点',
        address: '浦东新区锦绣路1001号',
        lng: 121.5536,
        lat: 31.2158,
        note: '示例：周末跑步',
        color: '#10b981',
        sample: true,
        sort: 1
      },
      {
        id: '10000000-0000-4000-8000-000000000003',
        name: '上海科技馆',
        type: 'place',
        category: '景点',
        address: '浦东新区世纪大道2000号',
        lng: 121.5402,
        lat: 31.2208,
        note: '',
        color: '#10b981',
        sample: true,
        sort: 2
      },
      {
        id: '10000000-0000-4000-8000-000000000004',
        name: '张江高科办公室',
        type: 'work',
        category: '',
        address: '浦东新区祖冲之路1559号',
        lng: 121.5963,
        lat: 31.2030,
        note: '示例工作地点',
        color: '#111827',
        sample: true,
        sort: 3
      },
      {
        id: '10000000-0000-4000-8000-000000000005',
        name: '金桥办公室',
        type: 'work',
        category: '',
        address: '浦东新区新金桥路27号',
        lng: 121.6265,
        lat: 31.2538,
        note: '示例工作地点',
        color: '#111827',
        sample: true,
        sort: 4
      }
    ];
  }

  function localLoad() {
    const raw = localStorage.getItem(LS_KEY);
    if (raw === null) return null;
    try {
      return JSON.parse(raw);
    } catch (e) {
      return [];
    }
  }

  function localSave(list) {
    localStorage.setItem(LS_KEY, JSON.stringify(list));
  }

  SHARED.isCloudConfigured = function () {
    return !!(C.supabase && C.supabase.url && C.supabase.anonKey);
  };

  function supabaseHeaders(token) {
    return {
      'apikey': C.supabase.anonKey,
      'Authorization': 'Bearer ' + (token || C.supabase.anonKey),
      'Content-Type': 'application/json'
    };
  }

  async function cloudLoad() {
    const res = await fetch(C.supabase.url + '/rest/v1/places?select=*&order=sort_order.asc', {
      headers: supabaseHeaders()
    });
    if (!res.ok) throw new Error('云端读取失败 ' + res.status);
    const rows = await res.json();
    return (rows || []).map(function (r) {
      return {
        id: r.id,
        name: r.name || '',
        type: r.type === 'work' ? 'work' : 'place',
        category: r.category || '',
        address: r.address || '',
        lng: r.lng,
        lat: r.lat,
        note: r.note || '',
        color: r.color || '',
        photos: Array.isArray(r.photos) ? r.photos : [],
        sample: false,
        sort: r.sort_order || 0
      };
    });
  }

  SHARED.loadPlaces = async function () {
    if (SHARED.isCloudConfigured()) {
      try {
        const rows = await cloudLoad();
        localSave(rows);
        return rows;
      } catch (e) {
        const fallback = localLoad();
        return fallback === null ? samplePlaces() : fallback;
      }
    }
    const local = localLoad();
    if (local === null) {
      const seed = samplePlaces();
      localSave(seed);
      return seed;
    }
    return local;
  };

  function apiError(res) {
    const e = new Error('云端请求失败 ' + res.status);
    e.status = res.status;
    return e;
  }

  async function refreshCloudSession() {
    const refreshToken = sessionStorage.getItem(REFRESH_KEY);
    if (!refreshToken) throw new Error('登录已过期，请重新登录');
    const res = await fetch(C.supabase.url + '/auth/v1/token?grant_type=refresh_token', {
      method: 'POST',
      headers: { 'apikey': C.supabase.anonKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken })
    });
    if (!res.ok) throw new Error('登录已过期，请重新登录');
    const data = await res.json();
    sessionStorage.setItem(TOKEN_KEY, data.access_token);
    if (data.refresh_token) sessionStorage.setItem(REFRESH_KEY, data.refresh_token);
    return data.access_token;
  }

  async function cloudUpsert(list, token) {
    const body = list.map(function (p, i) {
      return {
        id: p.id,
        name: p.name || '',
        type: p.type === 'work' ? 'work' : 'place',
        category: p.category || '',
        address: p.address || '',
        lng: p.lng == null ? null : p.lng,
        lat: p.lat == null ? null : p.lat,
        note: p.note || '',
        color: p.color || '',
        photos: Array.isArray(p.photos) ? p.photos : [],
        sort_order: i
      };
    });
    const upsertRes = await fetch(C.supabase.url + '/rest/v1/places?on_conflict=id', {
      method: 'POST',
      headers: Object.assign(supabaseHeaders(token), { 'Prefer': 'resolution=merge-duplicates' }),
      body: JSON.stringify(body)
    });
    if (!upsertRes.ok) throw apiError(upsertRes);

    const existing = await cloudLoad();
    const ids = {};
    list.forEach(function (p) { ids[p.id] = true; });
    for (let i = 0; i < existing.length; i++) {
      if (!ids[existing[i].id]) {
        const delRes = await fetch(
          C.supabase.url + '/rest/v1/places?id=eq.' + encodeURIComponent(existing[i].id),
          { method: 'DELETE', headers: supabaseHeaders(token) }
        );
        if (!delRes.ok) throw apiError(delRes);
      }
    }
    localSave(list);
    return true;
  }

  SHARED.savePlaces = async function (list) {
    if (SHARED.isCloudConfigured()) {
      let token = sessionStorage.getItem(TOKEN_KEY);
      if (!token) throw new Error('尚未登录云端');
      try {
        return await cloudUpsert(list, token);
      } catch (e) {
        if (e.status === 401) {
          token = await refreshCloudSession();
          return await cloudUpsert(list, token);
        }
        throw e;
      }
    }
    localSave(list);
    return false;
  };

  SHARED.cloudLogin = async function (password) {
    const res = await fetch(C.supabase.url + '/auth/v1/token?grant_type=password', {
      method: 'POST',
      headers: { 'apikey': C.supabase.anonKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: C.supabase.adminEmail, password: password })
    });
    if (!res.ok) throw new Error('云端登录失败，请检查密码');
    const data = await res.json();
    sessionStorage.setItem(TOKEN_KEY, data.access_token);
    if (data.refresh_token) sessionStorage.setItem(REFRESH_KEY, data.refresh_token);
  };

  SHARED.tryLogin = async function (password) {
    if (SHARED.isCloudConfigured()) {
      await SHARED.cloudLogin(password);
      return true;
    }
    return sha256Hex(password) === C.localAdminPasswordHash;
  };

  SHARED.uploadPhoto = async function (file) {
    if (!SHARED.isCloudConfigured()) throw new Error('云端未配置，暂时不能上传图片');
    let token = sessionStorage.getItem(TOKEN_KEY);
    if (!token) throw new Error('尚未登录云端');
    try {
      return await uploadPhotoOnce(file, token);
    } catch (e) {
      if (e.status === 401) {
        token = await refreshCloudSession();
        return await uploadPhotoOnce(file, token);
      }
      throw e;
    }
  };

  async function uploadPhotoOnce(file, token) {
    const blob = await resizeImage(file);
    const ext = blob.type === 'image/png' ? 'png' : 'jpg';
    const objectPath = 'place-photos/' + SHARED.uid() + '.' + ext;
    const res = await fetch(C.supabase.url + '/storage/v1/object/' + objectPath, {
      method: 'POST',
      headers: {
        'apikey': C.supabase.anonKey,
        'Authorization': 'Bearer ' + token,
        'Content-Type': blob.type || 'image/jpeg'
      },
      body: blob
    });
    if (!res.ok) throw apiError(res);
    return C.supabase.url + '/storage/v1/object/public/' + objectPath;
  }

  SHARED.deletePhoto = async function (publicUrl) {
    let token = sessionStorage.getItem(TOKEN_KEY);
    if (!token) return;
    try {
      await deletePhotoOnce(publicUrl, token);
    } catch (e) {
      if (e.status === 401) {
        token = await refreshCloudSession();
        await deletePhotoOnce(publicUrl, token);
      } else {
        throw e;
      }
    }
  };

  async function deletePhotoOnce(publicUrl, token) {
    const marker = '/storage/v1/object/public/';
    const idx = String(publicUrl || '').indexOf(marker);
    if (idx === -1) return;
    const objectPath = String(publicUrl).slice(idx + marker.length);
    const res = await fetch(C.supabase.url + '/storage/v1/object/' + objectPath, {
      method: 'DELETE',
      headers: {
        'apikey': C.supabase.anonKey,
        'Authorization': 'Bearer ' + token
      }
    });
    if (!res.ok) throw apiError(res);
  }

  function resizeImage(file) {
    return new Promise(function (resolve, reject) {
      const isPng = file.type === 'image/png';
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = function () {
        let w = img.naturalWidth || img.width;
        let h = img.naturalHeight || img.height;
        const max = 1400;
        if (w > max || h > max) {
          const ratio = Math.min(max / w, max / h);
          w = Math.round(w * ratio);
          h = Math.round(h * ratio);
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!isPng) {
          ctx.fillStyle = '#fff';
          ctx.fillRect(0, 0, w, h);
        }
        ctx.drawImage(img, 0, 0, w, h);
        canvas.toBlob(function (blob) {
          URL.revokeObjectURL(url);
          if (blob) resolve(blob);
          else reject(new Error('图片处理失败'));
        }, isPng ? 'image/png' : 'image/jpeg', 0.85);
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error('图片读取失败'));
      };
      img.src = url;
    });
  }

  async function sha256Hex(text) {
    const data = new TextEncoder().encode(text);
    const buf = await crypto.subtle.digest('SHA-256', data);
    return Array.prototype.map.call(new Uint8Array(buf), function (b) {
      return b.toString(16).padStart(2, '0');
    }).join('');
  }

  SHARED.loadAmap = function (callback) {
    if (window.AMap) {
      useAmapPlugins(callback);
      return;
    }
    const version = C.amapSecurityCode ? '2.0' : '1.4.15';
    if (C.amapSecurityCode) {
      window._AMapSecurityConfig = { securityJsCode: C.amapSecurityCode };
    }
    const s = document.createElement('script');
    s.src = 'https://webapi.amap.com/maps?v=' + version + '&key=' + encodeURIComponent(C.amapKey);
    s.onerror = showMapError;
    document.head.appendChild(s);

    let tries = 0;
    const timer = setInterval(function () {
      if (window.AMap) {
        clearInterval(timer);
        useAmapPlugins(callback);
      } else if (++tries > 100) {
        clearInterval(timer);
        showMapError();
      }
    }, 100);
  };

  function showMapError() {
    const box = document.getElementById('mapError');
    if (box) box.hidden = false;
  }

  function useAmapPlugins(callback) {
    AMap.plugin(
      ['AMap.Driving', 'AMap.Transfer', 'AMap.Riding', 'AMap.Geocoder', 'AMap.PlaceSearch'],
      function () { callback(); }
    );
  }

  window.App = SHARED;
})();
