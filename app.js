(function(){
'use strict';

const STORE_KEY = 'neon-ledger-v1';
const CATEGORIES = ['餐饮','交通','购物','娱乐','居住','医疗','其他'];
const ACCOUNTS = ['微信','支付宝','银行卡','现金','其他'];
const CAT_COLORS = {
  '餐饮':'#ff2d95','交通':'#00f0ff','购物':'#f9f002','娱乐':'#b967ff',
  '居住':'#39ff88','医疗':'#ff6b35','其他':'#8a8f98'
};
const CAT_ICONS = {
  '餐饮':'🍜','交通':'🚕','购物':'🛍️','娱乐':'🎮','居住':'🏠','医疗':'💊','其他':'📦'
};

let records = [];
let range = 'today';
let form = { type: 'expense', category: '餐饮', account: '微信' };

const $ = function(id){ return document.getElementById(id); };

function uid(){ return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
function pad(n){ return String(n).padStart(2, '0'); }
function dateStr(d){ return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
function timeStr(d){ return pad(d.getHours()) + ':' + pad(d.getMinutes()); }
function todayStr(){ return dateStr(new Date()); }
function monthKey(date){ return String(date).slice(0, 7); }
function currentMonth(){ return dateStr(new Date()).slice(0, 7); }
function fmt(n){ return Number(n || 0).toFixed(2); }

function load(){
  try { records = JSON.parse(localStorage.getItem(STORE_KEY)) || []; }
  catch (e) { records = []; }
  records.sort(function(a, b){ return (b.date + b.time).localeCompare(a.date + a.time); });
}
function save(){ localStorage.setItem(STORE_KEY, JSON.stringify(records)); }

function filtered(){
  const t = todayStr(), m = currentMonth();
  if (range === 'today') return records.filter(function(r){ return r.date === t; });
  if (range === 'month') return records.filter(function(r){ return monthKey(r.date) === m; });
  return records;
}
function sumOf(list, type){
  return list.filter(function(r){ return r.type === type; })
    .reduce(function(s, r){ return s + Number(r.amount || 0); }, 0);
}

function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, function(c){
    return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c];
  });
}

function renderStats(){
  const m = currentMonth(), t = todayStr();
  const monthRecs = records.filter(function(r){ return monthKey(r.date) === m; });
  $('monthExpense').textContent = fmt(sumOf(monthRecs, 'expense'));
  $('monthIncome').textContent = '¥' + fmt(sumOf(monthRecs, 'income'));
  $('todayExpense').textContent = '¥' + fmt(sumOf(monthRecs.filter(function(r){ return r.date === t; }), 'expense'));
  $('monthCount').textContent = monthRecs.length;
}

function renderList(){
  const list = filtered();
  $('listCount').textContent = list.length;
  const ul = $('recordList');
  const empty = $('empty');
  if (!list.length){ ul.innerHTML = ''; empty.style.display = 'block'; return; }
  empty.style.display = 'none';
  ul.innerHTML = list.map(function(r){
    const isExp = r.type !== 'income';
    const icon = isExp ? (CAT_ICONS[r.category] || '📦') : '💰';
    const color = isExp ? (CAT_COLORS[r.category] || '#8a8f98') : '#39ff88';
    return '<li class="record">' +
      '<div class="rec-icon" style="color:' + color + ';border:1px solid ' + color + '55;box-shadow:0 0 8px ' + color + '44">' + icon + '</div>' +
      '<div class="rec-main">' +
        '<div class="rec-cat">' + escapeHtml(r.category || '其他') + (r.note ? ' · ' + escapeHtml(r.note) : '') + '</div>' +
        '<div class="rec-meta"><span>' + escapeHtml(r.account || '其他') + '</span><span>' + r.date + ' ' + r.time + '</span></div>' +
      '</div>' +
      '<div class="rec-amount ' + (isExp ? 'exp' : 'inc') + '">' + (isExp ? '-' : '+') + '¥' + fmt(r.amount) + '</div>' +
      '<button class="rec-del" data-id="' + r.id + '" title="删除">✕</button>' +
    '</li>';
  }).join('');
}

function renderCharts(){
  const list = filtered();
  const expense = list.filter(function(r){ return r.type !== 'income'; });
  const byCat = {};
  expense.forEach(function(r){
    const k = r.category || '其他';
    byCat[k] = (byCat[k] || 0) + Number(r.amount || 0);
  });
  const donut = Object.keys(byCat).map(function(k){
    return { label: k, value: byCat[k], color: CAT_COLORS[k] || '#8a8f98' };
  });
  donut.sort(function(a, b){ return b.value - a.value; });
  Charts.drawDonut($('donut'), donut);
  $('donutTotal').textContent = '¥' + fmt(expense.reduce(function(s, r){ return s + Number(r.amount || 0); }, 0));
  $('legend').innerHTML = donut.length
    ? donut.map(function(d){
        return '<div class="legend-item"><i style="background:' + d.color + ';color:' + d.color + '"></i><span>' + d.label + '</span><b>¥' + fmt(d.value) + '</b></div>';
      }).join('')
    : '<div class="empty-mini">暂无支出</div>';

  const days = [];
  const now = new Date();
  for (let i = 6; i >= 0; i--){
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const key = dateStr(d);
    const v = expense.filter(function(r){ return r.date === key; })
      .reduce(function(s, r){ return s + Number(r.amount || 0); }, 0);
    days.push({ label: (d.getMonth() + 1) + '/' + d.getDate(), value: v });
  }
  Charts.drawBars($('bars'), days);
}

function render(){ renderStats(); renderCharts(); renderList(); }

/* modal */
function setType(t){
  form.type = t;
  document.querySelectorAll('.seg-btn').forEach(function(b){
    const active = b.dataset.type === t;
    b.classList.toggle('active', active);
    b.classList.toggle('exp', active && t === 'expense');
    b.classList.toggle('inc', active && t === 'income');
  });
}
function renderChips(){
  $('fCategory').innerHTML = CATEGORIES.map(function(c){
    return '<button class="chip' + (form.category === c ? ' active' : '') + '" data-cat="' + c + '">' + c + '</button>';
  }).join('');
  $('fAccount').innerHTML = ACCOUNTS.map(function(a){
    return '<button class="chip' + (form.account === a ? ' active' : '') + '" data-acc="' + a + '">' + a + '</button>';
  }).join('');
}
function openModal(){
  $('modal').classList.remove('hidden');
  setType(form.type);
  renderChips();
  $('fAmount').value = '';
  $('fNote').value = '';
  const now = new Date();
  $('fDate').value = dateStr(now);
  $('fTime').value = timeStr(now);
  setTimeout(function(){ $('fAmount').focus(); }, 60);
}
function closeModal(){ $('modal').classList.add('hidden'); }
function saveRecord(){
  const amount = parseFloat($('fAmount').value);
  if (!amount || amount <= 0){ toast('请输入有效金额'); return; }
  records.push({
    id: uid(),
    type: form.type,
    category: form.type === 'income' ? '收入' : form.category,
    account: form.account,
    amount: Math.round(amount * 100) / 100,
    note: $('fNote').value.trim(),
    date: $('fDate').value || todayStr(),
    time: $('fTime').value || '12:00',
    createdAt: Date.now()
  });
  save(); closeModal(); render();
  toast(form.type === 'expense' ? '已记录支出 ¥' + fmt(amount) : '已记录收入 ¥' + fmt(amount));
}
function deleteRecord(id){
  records = records.filter(function(r){ return r.id !== id; });
  save(); render(); toast('已删除');
}

/* toast */
let toastTimer;
function toast(msg){
  let el = document.querySelector('.toast');
  if (!el){
    el = document.createElement('div');
    el.className = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function(){ el.classList.remove('show'); }, 1800);
}

/* export / import */
function exportJson(){
  const blob = new Blob([JSON.stringify(records, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'neon-ledger-backup-' + dateStr(new Date()) + '.json';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(function(){ URL.revokeObjectURL(url); }, 500);
  toast('已导出备份');
}
function normalizeRecord(x){
  return {
    id: x.id || uid(),
    type: x.type === 'income' ? 'income' : 'expense',
    category: x.category || '其他',
    account: x.account || '其他',
    amount: Number(x.amount) || 0,
    note: x.note || '',
    date: String(x.date).slice(0, 10),
    time: x.time || '12:00',
    createdAt: x.createdAt || Date.now()
  };
}
function importJson(file){
  readFileText(file).then(function(text){
    const arr = JSON.parse(text);
    if (!Array.isArray(arr)){ toast('JSON 格式不正确'); return; }
    let count = 0;
    arr.forEach(function(x){
      if (x && x.amount && x.date){ records.push(normalizeRecord(x)); count++; }
    });
    save(); render(); toast('导入成功 ' + count + ' 条');
  }).catch(function(){ toast('导入失败'); });
}

/* CSV parsing */
function readFileText(file){
  return file.arrayBuffer().then(function(buf){
    let text = new TextDecoder('utf-8').decode(buf);
    if (text.indexOf('\uFFFD') !== -1){
      try { text = new TextDecoder('gbk').decode(buf); } catch (e) {}
    }
    return text.replace(/^\uFEFF/, '');
  });
}
function parseCsvRows(text){
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++){
    const c = text[i];
    if (inQuotes){
      if (c === '"'){
        if (text[i + 1] === '"'){ field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ','){ row.push(field); field = ''; }
      else if (c === '\n' || c === '\r'){
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(field); rows.push(row); row = []; field = '';
      } else field += c;
    }
  }
  if (field !== '' || row.length){ row.push(field); rows.push(row); }
  return rows;
}
function detectColumns(rows){
  for (let i = 0; i < Math.min(rows.length, 40); i++){
    const r = rows[i];
    if (!r || r.length < 3) continue;
    const hasTime = r.some(function(c){ return /交易时间|付款时间|交易创建时间|入账时间|交易日期/.test(c); });
    const hasAmount = r.some(function(c){ return /金额/.test(c); });
    if (hasTime && hasAmount) return { headerIndex: i, row: r };
  }
  return null;
}
function mapColumns(header){
  const map = {};
  header.forEach(function(c, idx){
    if (/交易时间|付款时间|交易创建时间|入账时间|交易日期/.test(c)) map.time = idx;
    else if (/金额/.test(c)) map.amount = idx;
    else if (/收.?支|收支方向/.test(c)) map.direction = idx;
    else if (/商品名称|商品|交易对方|摘要|交易说明/.test(c)) map.subject = idx;
    else if (/支付方式|收.?付款方式|交易来源|交易渠道|卡号/.test(c)) map.account = idx;
    else if (/交易类型|业务类型/.test(c)) map.type = idx;
  });
  return map;
}
function parseDate(str){
  let s = String(str).replace(/[./年]/g, '-').replace(/月/g, '-').replace(/日/g, '').replace(/\s+/g, ' ').trim();
  const m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
  if (m) return { date: m[1] + '-' + pad(m[2]) + '-' + pad(m[3]), time: m[4] ? pad(m[4]) + ':' + pad(m[5] || '0') : '00:00' };
  const m2 = s.replace(/-/g, '').match(/^(\d{4})(\d{2})(\d{2})/);
  if (m2) return { date: m2[1] + '-' + m2[2] + '-' + m2[3], time: '00:00' };
  return null;
}
function inferCategory(s){
  if (/外卖|美团|饿了么|餐|饭|咖啡|奶茶|麦当劳|肯德基|星巴克|面|粥|烧烤|火锅|零食/.test(s)) return '餐饮';
  if (/滴滴|出租|地铁|公交|高铁|火车|机票|加油|停车|共享|单车|出行|12306|网约车/.test(s)) return '交通';
  if (/淘宝|天猫|京东|拼多多|唯品会|超市|便利店|商场|百货|购买|购物/.test(s)) return '购物';
  if (/电影|游戏|KTV|演出|票|会员|视频|音乐|steam|bilibili|腾讯视频|爱奇艺|优酷/.test(s)) return '娱乐';
  if (/房租|物业|水电|燃气|宽带|话费|电费|水费|供暖/.test(s)) return '居住';
  if (/医院|药|诊所|挂号|体检|门诊/.test(s)) return '医疗';
  return '其他';
}
function inferAccount(s){
  if (/微信|零钱/.test(s)) return '微信';
  if (/支付宝|余额宝|花呗/.test(s)) return '支付宝';
  if (/招商|工商|建设|农业|中国银行|交通|中信|浦发|兴业|民生|广发|光大|华夏|邮储|储蓄|信用卡|银行卡|银联/.test(s)) return '银行卡';
  if (/现金/.test(s)) return '现金';
  return '其他';
}
function rowToRecord(row, map){
  if (map.time == null || map.amount == null) return null;
  const timeRaw = String(row[map.time] || '').trim().replace(/"/g, '');
  const amountRaw = String(row[map.amount] || '').trim().replace(/[￥¥,，"'\s]/g, '');
  if (!timeRaw || !amountRaw) return null;
  const dt = parseDate(timeRaw);
  if (!dt) return null;
  let num = parseFloat(amountRaw);
  if (isNaN(num) || num === 0) return null;
  let type = 'expense';
  if (map.direction != null){
    const d = String(row[map.direction] || '').trim();
    if (/收入|入账/.test(d)) type = 'income';
    else if (/支出/.test(d)) type = 'expense';
    else if (/不计收支|中性/.test(d)) return null;
  } else {
    type = num < 0 ? 'expense' : 'income';
  }
  num = Math.abs(num);
  const subject = map.subject != null ? String(row[map.subject] || '') : '';
  const typeText = map.type != null ? String(row[map.type] || '') : '';
  const acctRaw = map.account != null ? String(row[map.account] || '') : '';
  return {
    id: uid(),
    type: type,
    category: type === 'income' ? '收入' : inferCategory(subject + ' ' + typeText),
    account: inferAccount(acctRaw),
    amount: Math.round(num * 100) / 100,
    note: subject.slice(0, 40),
    date: dt.date,
    time: dt.time,
    createdAt: Date.now()
  };
}
function importCsv(file){
  const name = file.name.toLowerCase();
  if (name.endsWith('.json')){ importJson(file); return; }
  readFileText(file).then(function(text){
    const rows = parseCsvRows(text);
    const det = detectColumns(rows);
    if (!det){ toast('未识别到账单表头'); return; }
    const map = mapColumns(det.row);
    let count = 0;
    for (let i = det.headerIndex + 1; i < rows.length; i++){
      const rec = rowToRecord(rows[i], map);
      if (rec){ records.push(rec); count++; }
    }
    if (!count){ toast('没有解析到有效记录'); return; }
    save(); render(); toast('导入成功 ' + count + ' 条');
  }).catch(function(){ toast('读取文件失败'); });
}

/* sample & clear */
function loadSample(){
  if (records.length && !confirm('已存在数据，是否追加示例数据？')) return;
  const cats = CATEGORIES;
  const accs = ['微信', '支付宝', '银行卡'];
  const notes = ['午饭', '奶茶', '地铁', '打车', '电影票', '话费充值', '超市采购', '外卖', '咖啡', '游戏充值'];
  const now = new Date();
  let added = 0;
  for (let i = 0; i < 36; i++){
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - Math.floor(Math.random() * 14));
    const cat = cats[Math.floor(Math.random() * cats.length)];
    records.push({
      id: uid(),
      type: 'expense',
      category: cat,
      account: accs[Math.floor(Math.random() * accs.length)],
      amount: Math.round((Math.random() * 180 + 8) * 100) / 100,
      note: notes[Math.floor(Math.random() * notes.length)],
      date: dateStr(d),
      time: pad(Math.floor(Math.random() * 24)) + ':' + pad(Math.floor(Math.random() * 60)),
      createdAt: Date.now()
    });
    added++;
  }
  save(); render(); toast('已载入 ' + added + ' 条示例');
}
function clearAll(){
  if (!records.length){ toast('暂无数据'); return; }
  if (confirm('确定清空全部数据？此操作不可恢复，建议先导出备份。')){
    records = []; save(); render(); toast('已清空');
  }
}

/* background particles */
function initBg(){
  const c = $('bg');
  if (!c) return;
  const ctx = c.getContext('2d');
  let w, h;
  function resize(){ w = c.width = window.innerWidth; h = c.height = window.innerHeight; }
  resize();
  window.addEventListener('resize', resize);
  const N = Math.min(70, Math.floor(window.innerWidth / 18));
  const pts = [];
  for (let i = 0; i < N; i++){
    pts.push({
      x: Math.random() * w, y: Math.random() * h,
      r: Math.random() * 1.6 + 0.4, s: Math.random() * 0.3 + 0.08,
      a: Math.random() * 0.5 + 0.2,
      hue: Math.random() < 0.5 ? '0,240,255' : '255,45,149'
    });
  }
  (function tick(){
    ctx.clearRect(0, 0, w, h);
    pts.forEach(function(p){
      p.y -= p.s;
      if (p.y < -5){ p.y = h + 5; p.x = Math.random() * w; }
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(' + p.hue + ',' + p.a + ')';
      ctx.fill();
    });
    requestAnimationFrame(tick);
  })();
}

function bindEvents(){
  document.querySelectorAll('.tab').forEach(function(t){
    t.addEventListener('click', function(){
      document.querySelectorAll('.tab').forEach(function(x){ x.classList.remove('active'); });
      t.classList.add('active');
      range = t.dataset.range;
      render();
    });
  });
  $('btnAdd').addEventListener('click', openModal);
  $('btnCancel').addEventListener('click', closeModal);
  $('btnSave').addEventListener('click', saveRecord);
  $('fAmount').addEventListener('keydown', function(e){ if (e.key === 'Enter') saveRecord(); });
  $('modal').addEventListener('click', function(e){ if (e.target === $('modal')) closeModal(); });
  document.querySelectorAll('.seg-btn').forEach(function(b){
    b.addEventListener('click', function(){ setType(b.dataset.type); });
  });
  $('fCategory').addEventListener('click', function(e){
    const c = e.target.closest('.chip');
    if (c){ form.category = c.dataset.cat; renderChips(); }
  });
  $('fAccount').addEventListener('click', function(e){
    const a = e.target.closest('.chip');
    if (a){ form.account = a.dataset.acc; renderChips(); }
  });
  $('recordList').addEventListener('click', function(e){
    const btn = e.target.closest('.rec-del');
    if (btn) deleteRecord(btn.dataset.id);
  });

  $('btnSettings').addEventListener('click', function(){ $('settings').classList.remove('hidden'); });
  $('btnCloseSettings').addEventListener('click', function(){ $('settings').classList.add('hidden'); });
  $('settings').addEventListener('click', function(e){ if (e.target === $('settings')) $('settings').classList.add('hidden'); });
  $('btnImport').addEventListener('click', function(){ $('fileInput').click(); });
  $('fileInput').addEventListener('change', function(e){
    if (e.target.files[0]) importCsv(e.target.files[0]);
    e.target.value = '';
  });
  $('btnExport').addEventListener('click', exportJson);
  $('btnSample').addEventListener('click', loadSample);
  $('btnClear').addEventListener('click', clearAll);
}

function init(){
  load();
  bindEvents();
  renderChips();
  initBg();
  render();
  if ('serviceWorker' in navigator && location.protocol !== 'file:'){
    navigator.serviceWorker.register('sw.js').catch(function(){});
  }
}

document.addEventListener('DOMContentLoaded', init);
})();