(function(){
'use strict';

const STORE_KEY = 'neon-ledger-v1';
const SETTINGS_KEY = 'neon-ledger-settings-v1';
const CATEGORIES = ['餐饮','交通','购物','娱乐','居住','医疗','其他'];
const ACCOUNTS = ['微信','支付宝','银行卡','现金','其他'];
const CAT_COLORS = {
  '餐饮':'#ff2d95','交通':'#00f0ff','购物':'#f9f002','娱乐':'#b967ff',
  '居住':'#39ff88','医疗':'#ff6b35','其他':'#8a8f98'
};
const CAT_ICONS = {
  '餐饮':'🍜','交通':'🚕','购物':'🛍️','娱乐':'🎮','居住':'🏠','医疗':'💊','其他':'📦'
};
const ACCT_COLORS = {
  '微信':'#00f0ff','支付宝':'#b967ff','银行卡':'#f9f002','现金':'#39ff88','其他':'#8a8f98'
};
const THEMES = [
  { id:'cyber', c1:'#00f0ff', c2:'#ff2d95', name:'赛博' },
  { id:'toxic', c1:'#b4ff39', c2:'#00ff9d', name:'毒液' },
  { id:'sunset', c1:'#ff9d2d', c2:'#ff2d55', name:'落日' },
  { id:'violet', c1:'#b967ff', c2:'#00f0ff', name:'紫电' }
];

let records = [];
let settings = null;
let selectedMonth = currentMonth();
let editingId = null;
let lastAddedId = null;
let search = '';
let filterCategory = '';
let donutMode = 'category';
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
function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, function(c){
    return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c];
  });
}

function defaultSettings(){
  return {
    budget: 3000,
    theme: 'cyber',
    presets: [
      { id: 'p1', amount: 25, category: '餐饮', account: '微信', note: '午饭' },
      { id: 'p2', amount: 15, category: '餐饮', account: '微信', note: '奶茶' },
      { id: 'p3', amount: 3, category: '交通', account: '支付宝', note: '地铁' },
      { id: 'p4', amount: 20, category: '交通', account: '微信', note: '打车' }
    ]
  };
}

function load(){
  try { records = JSON.parse(localStorage.getItem(STORE_KEY)) || []; }
  catch (e) { records = []; }
  sortRecords();
}
function sortRecords(){
  records.sort(function(a, b){ return (b.date + b.time).localeCompare(a.date + a.time); });
}
function save(){ sortRecords(); localStorage.setItem(STORE_KEY, JSON.stringify(records)); }
function loadSettings(){
  settings = defaultSettings();
  try {
    const s = JSON.parse(localStorage.getItem(SETTINGS_KEY));
    if (s && typeof s === 'object'){
      settings = Object.assign(defaultSettings(), s);
      if (!Array.isArray(settings.presets)) settings.presets = defaultSettings().presets;
    }
  } catch (e) {}
}
function saveSettings(){ localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); }

function shiftMonth(ym, delta){
  const parts = ym.split('-').map(Number);
  const d = new Date(parts[0], parts[1] - 1 + delta, 1);
  return d.getFullYear() + '-' + pad(d.getMonth() + 1);
}
function daysInMonth(ym){
  const parts = ym.split('-').map(Number);
  return new Date(parts[0], parts[1], 0).getDate();
}
function daysElapsed(){
  if (selectedMonth === currentMonth()) return Number(todayStr().slice(8, 10));
  return daysInMonth(selectedMonth);
}

function monthRecords(){ return records.filter(function(r){ return monthKey(r.date) === selectedMonth; }); }
function sumOf(list, type){
  return list.filter(function(r){ return r.type === type; })
    .reduce(function(s, r){ return s + Number(r.amount || 0); }, 0);
}
function monthExpense(){ return sumOf(monthRecords(), 'expense'); }
function monthIncome(){ return sumOf(monthRecords(), 'income'); }
function todayExpense(){
  return records.filter(function(r){ return r.date === todayStr() && r.type !== 'income'; })
    .reduce(function(s, r){ return s + Number(r.amount || 0); }, 0);
}

/* ===== render ===== */
function renderMonthNav(){
  const parts = selectedMonth.split('-').map(Number);
  $('monthLabel').textContent = parts[0] + '年' + parts[1] + '月';
}
function renderStats(){
  const me = monthExpense(), mi = monthIncome();
  $('monthExpense').textContent = fmt(me);
  $('monthIncome').textContent = '¥' + fmt(mi);
  $('todayExpense').textContent = '¥' + fmt(todayExpense());
  $('monthCount').textContent = monthRecords().length;
  $('dailyAvg').textContent = '¥' + fmt(me / Math.max(1, daysElapsed()));
  const budget = Number(settings.budget) || 0;
  const pct = budget > 0 ? Math.min(100, Math.round(me / budget * 100)) : 0;
  $('budgetBar').style.width = pct + '%';
  $('budgetText').textContent = budget > 0 ? ('预算 ¥' + fmt(budget) + ' · 已用 ' + pct + '%') : '未设置预算（在设置里可设）';
  const over = budget > 0 && me > budget;
  const warn = budget > 0 && !over && me / budget >= 0.8;
  $('budgetWrap').className = 'budget-bar' + (over ? ' over' : (warn ? ' warn' : ''));
}
function renderPresets(){
  const el = $('presetChips');
  el.innerHTML = settings.presets.map(function(p){
    return '<button class="preset-chip" data-id="' + p.id + '">' +
      (CAT_ICONS[p.category] || '📦') + ' ' + escapeHtml(p.note || p.category) + ' ¥' + fmt(p.amount) + '</button>';
  }).join('') || '<span class="hint">暂无快捷预设，记一笔时勾选「保存为快捷预设」即可添加</span>';
}function renderCharts(){
  const mrecs = monthRecords();
  const expense = mrecs.filter(function(r){ return r.type !== 'income'; });
  const expenseTotal = expense.reduce(function(s, r){ return s + Number(r.amount || 0); }, 0);

  let donut = [];
  if (donutMode === 'account'){
    const by = {};
    expense.forEach(function(r){ const k = r.account || '其他'; by[k] = (by[k] || 0) + Number(r.amount || 0); });
    donut = Object.keys(by).map(function(k){ return { label: k, value: by[k], color: ACCT_COLORS[k] || '#8a8f98' }; });
  } else {
    const by = {};
    expense.forEach(function(r){ const k = r.category || '其他'; by[k] = (by[k] || 0) + Number(r.amount || 0); });
    donut = Object.keys(by).map(function(k){ return { label: k, value: by[k], color: CAT_COLORS[k] || '#8a8f98' }; });
  }
  donut.sort(function(a, b){ return b.value - a.value; });
  Charts.drawDonut($('donut'), donut);
  $('donutTotal').textContent = '¥' + fmt(expenseTotal);
  $('legend').innerHTML = donut.length
    ? donut.map(function(d){
        return '<div class="legend-item"><i style="background:' + d.color + ';color:' + d.color + '"></i><span>' + escapeHtml(d.label) + '</span><b>¥' + fmt(d.value) + '</b></div>';
      }).join('')
    : '<div class="empty-mini">暂无支出</div>';

  const dim = daysInMonth(selectedMonth);
  const dense = dim > 12;
  const days = [];
  for (let d = 1; d <= dim; d++){
    const key = selectedMonth + '-' + pad(d);
    const v = expense.filter(function(r){ return r.date === key; })
      .reduce(function(s, r){ return s + Number(r.amount || 0); }, 0);
    const showLabel = dense ? (d === 1 || d % 5 === 0 || d === dim) : true;
    days.push({ label: showLabel ? String(d) : '', value: v });
  }
  Charts.drawBars($('bars'), days, { dense: dense });

  const byAcct = {};
  expense.forEach(function(r){ const k = r.account || '其他'; byAcct[k] = (byAcct[k] || 0) + Number(r.amount || 0); });
  const totalAcct = Object.keys(byAcct).reduce(function(s, k){ return s + byAcct[k]; }, 0) || 1;
  $('acctBreakdown').innerHTML = Object.keys(byAcct).map(function(k){
    const v = byAcct[k];
    const pct = Math.round(v / totalAcct * 100);
    const color = ACCT_COLORS[k] || '#8a8f98';
    return '<div class="ab-row"><span class="ab-name">' + escapeHtml(k) + '</span>' +
      '<div class="ab-track"><div class="ab-fill" style="width:' + pct + '%;background:' + color + ';box-shadow:0 0 8px ' + color + '"></div></div>' +
      '<b class="ab-val">¥' + fmt(v) + '</b></div>';
  }).join('') || '<div class="empty-mini">暂无支出</div>';
}
function renderFilters(){
  $('catFilter').innerHTML =
    '<button class="chip' + (filterCategory === '' ? ' active' : '') + '" data-cat="">全部</button>' +
    CATEGORIES.map(function(c){
      return '<button class="chip' + (filterCategory === c ? ' active' : '') + '" data-cat="' + c + '">' + c + '</button>';
    }).join('');
}
function listRecords(){
  let list = monthRecords();
  if (filterCategory) list = list.filter(function(r){ return r.type !== 'income' && r.category === filterCategory; });
  if (search){
    const q = search.toLowerCase();
    list = list.filter(function(r){
      return (String(r.note) + ' ' + r.category + ' ' + r.account + ' ' + r.date + ' ' + r.time).toLowerCase().indexOf(q) !== -1;
    });
  }
  return list;
}
function renderList(){
  const list = listRecords();
  $('listCount').textContent = list.length;
  const ul = $('recordList');
  const empty = $('empty');
  if (!list.length){ ul.innerHTML = ''; empty.style.display = 'block'; return; }
  empty.style.display = 'none';
  ul.innerHTML = list.map(function(r){
    const isExp = r.type !== 'income';
    const icon = isExp ? (CAT_ICONS[r.category] || '📦') : '💰';
    const color = isExp ? (CAT_COLORS[r.category] || '#8a8f98') : '#39ff88';
    return '<li class="record" data-id="' + r.id + '">' +
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
function render(){
  renderMonthNav(); renderStats(); renderPresets(); renderCharts(); renderFilters(); renderList();
}

/* ===== modal ===== */
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
function resetOcrUi(){
  $('ocrStatus').innerHTML = '';
  $('ocrPreview').classList.add('hidden');
  $('ocrPreview').removeAttribute('src');
}
function openModal(){
  editingId = null;
  form.type = 'expense'; setType('expense');
  form.category = '餐饮'; form.account = '微信';
  renderChips();
  $('fAmount').value = '';
  $('fNote').value = '';
  $('fSavePreset').checked = false;
  const now = new Date();
  $('fDate').value = dateStr(now);
  $('fTime').value = timeStr(now);
  $('modalTitle').textContent = '记一笔 // INPUT';
  resetOcrUi();
  $('modal').classList.remove('hidden');
  setTimeout(function(){ $('fAmount').focus(); }, 60);
}
function openEdit(id){
  const r = records.find(function(x){ return x.id === id; });
  if (!r) return;
  editingId = id;
  form.type = r.type === 'income' ? 'income' : 'expense';
  setType(form.type);
  form.category = r.category; form.account = r.account;
  renderChips();
  $('fAmount').value = r.amount;
  $('fNote').value = r.note || '';
  $('fDate').value = r.date; $('fTime').value = r.time;
  $('fSavePreset').checked = false;
  $('modalTitle').textContent = '编辑记录 // EDIT';
  resetOcrUi();
  $('modal').classList.remove('hidden');
  setTimeout(function(){ $('fAmount').focus(); }, 60);
}
function closeModal(){ $('modal').classList.add('hidden'); }
function saveRecord(){
  const amount = parseFloat($('fAmount').value);
  if (!amount || amount <= 0){ toast('请输入有效金额'); return; }
  const date = $('fDate').value || todayStr();
  const time = $('fTime').value || '12:00';
  const type = form.type;
  const category = type === 'income' ? '收入' : form.category;
  const note = $('fNote').value.trim();
  const roundAmount = Math.round(amount * 100) / 100;

  if (editingId){
    const r = records.find(function(x){ return x.id === editingId; });
    if (r){
      r.type = type; r.category = category; r.account = form.account;
      r.amount = roundAmount; r.note = note; r.date = date; r.time = time;
    }
    editingId = null;
    save(); closeModal(); render(); toast('已保存修改');
    return;
  }
  records.push({
    id: uid(), type: type, category: category, account: form.account,
    amount: roundAmount, note: note, date: date, time: time, createdAt: Date.now()
  });
  if (type === 'expense' && $('fSavePreset').checked){
    addPreset({ amount: roundAmount, category: form.category, account: form.account, note: note });
  }
  save(); closeModal(); render();
  toast(type === 'expense' ? '已记录支出 ¥' + fmt(amount) : '已记录收入 ¥' + fmt(amount));
}
function deleteRecord(id){
  const idx = records.findIndex(function(r){ return r.id === id; });
  if (idx === -1) return;
  const removed = records.splice(idx, 1)[0];
  save(); render();
  toast('已删除 · 点击撤销', function(){
    records.push(removed); save(); render(); toast('已恢复');
  });
}

/* quick add */
function addPreset(p){
  const exists = settings.presets.some(function(x){
    return x.amount === p.amount && x.category === p.category && x.note === p.note;
  });
  if (!exists) settings.presets.push({ id: uid(), amount: p.amount, category: p.category, account: p.account || '微信', note: p.note || '' });
  saveSettings();
}
function quickAdd(id){
  const p = settings.presets.find(function(x){ return x.id === id; });
  if (!p) return;
  const now = new Date();
  const rec = {
    id: uid(), type: 'expense', category: p.category, account: p.account,
    amount: Number(p.amount) || 0, note: p.note || '',
    date: dateStr(now), time: timeStr(now), createdAt: Date.now()
  };
  records.push(rec); lastAddedId = rec.id;
  save(); render();
  toast('已记 ' + (p.note || p.category) + ' ¥' + fmt(p.amount) + ' · 点击撤销', undoLast);
}
function undoLast(){
  if (!lastAddedId) return;
  records = records.filter(function(r){ return r.id !== lastAddedId; });
  lastAddedId = null;
  save(); render(); toast('已撤销');
}

/* toast */
let toastTimer;
function toast(msg, onTap){
  let el = document.querySelector('.toast');
  if (!el){
    el = document.createElement('div');
    el.className = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.onclick = onTap || null;
  el.classList.toggle('action', !!onTap);
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function(){ el.classList.remove('show'); }, onTap ? 4000 : 1800);
}

/* ===== theme ===== */
function applyTheme(){ document.body.setAttribute('data-theme', settings.theme || 'cyber'); }
function renderThemeSwatches(){
  $('themeList').innerHTML = THEMES.map(function(t){
    return '<button class="swatch' + (settings.theme === t.id ? ' active' : '') + '" data-theme="' + t.id + '" style="--s1:' + t.c1 + ';--s2:' + t.c2 + '" title="' + t.name + '"></button>';
  }).join('');
}
function renderSettingsPresets(){
  $('presetList').innerHTML = settings.presets.map(function(p){
    return '<li class="preset-item"><span>' + (CAT_ICONS[p.category] || '📦') + ' ' + escapeHtml(p.note || p.category) + ' ¥' + fmt(p.amount) + '</span>' +
      '<button class="preset-del" data-id="' + p.id + '">✕</button></li>';
  }).join('') || '<li class="hint">暂无预设，记一笔时勾选「保存为快捷预设」即可添加</li>';
}/* ===== export / import ===== */
function download(blob, filename){
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(function(){ URL.revokeObjectURL(url); }, 500);
}
function exportJson(){
  download(new Blob([JSON.stringify(records, null, 2)], { type: 'application/json' }),
    'neon-ledger-backup-' + todayStr() + '.json');
  toast('已导出备份 JSON');
}
function exportCsv(){
  const header = ['日期', '时间', '类型', '分类', '账户', '金额', '备注'];
  const lines = [header.join(',')];
  records.forEach(function(r){
    lines.push([r.date, r.time, r.type === 'income' ? '收入' : '支出', r.category, r.account, r.amount, String(r.note || '').replace(/,/g, '，')].join(','));
  });
  download(new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' }),
    'neon-ledger-' + selectedMonth + '.csv');
  toast('已导出 CSV');
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
}/* ===== OCR ===== */
function normDigits(s){
  return String(s)
    .replace(/[０-９]/g, function(ch){ return String.fromCharCode(ch.charCodeAt(0) - 0xFEE0); })
    .replace(/，/g, ',');
}
function numOf(line){
  const s = normDigits(line);
  let m = s.match(/[¥￥]\s*(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?)/);
  if (!m) m = s.match(/(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?)/);
  if (!m) return null;
  return parseFloat(m[1].replace(/,/g, ''));
}
function cleanMerchant(s){
  return String(s).replace(/[（(].*?[)）]/g, '').replace(/[:：]/g, '').trim();
}
function parseOcrText(text){
  const lines = String(text).split(/\r?\n/).map(function(s){ return s.trim(); }).filter(Boolean);
  let amount = null;
  function scan(re){
    for (let i = 0; i < lines.length; i++){
      if (re.test(lines[i])){
        let v = numOf(lines[i]);
        if (!v || v <= 0) v = numOf(lines[i + 1] || '');
        if (v && v > 0) return v;
      }
    }
    return null;
  }
  amount = scan(/实付|付款金额|交易金额|支付金额|应付|合计|总计|总额|消费金额|应付款/);
  if (amount == null) amount = scan(/金额/);
  if (amount == null){
    for (let i = 0; i < lines.length; i++){
      const m = normDigits(lines[i]).match(/[-]?\s*[¥￥]\s*(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?)/);
      if (m){ const v = parseFloat(m[1].replace(/,/g, '')); if (v > 0){ amount = v; break; } }
    }
  }
  if (amount == null){
    for (let i = 0; i < lines.length; i++){
      const m = normDigits(lines[i]).match(/^[-]?\s*[¥￥]?\s*(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?)\s*元?\s*$/);
      if (m){ const v = parseFloat(m[1].replace(/,/g, '')); if (v > 0){ amount = v; break; } }
    }
  }
  let merchant = '';
  const merchantKw = /收款方|收款单位|商户全称|商户名称|商户|交易对方|收款账户|付款给|商家|收款人/;
  for (let i = 0; i < lines.length; i++){
    if (merchantKw.test(lines[i])){
      const next = lines[i + 1];
      if (next && /[\u4e00-\u9fa5]/.test(next) && next.length <= 30){ merchant = cleanMerchant(next); break; }
      const inline = lines[i].replace(merchantKw, '').trim();
      if (inline && inline.length >= 2){ merchant = cleanMerchant(inline); break; }
    }
  }
  if (!merchant){
    const skip = /支付|微信|支付宝|账单|金额|时间|单号|成功|失败|状态|方式|凭证|交易|退款|商家订单|订单|明细|详情|当前|关闭|返回|已完成|查看|更多/;
    for (let i = 0; i < lines.length; i++){
      const t = lines[i].replace(/[^\u4e00-\u9fa5A-Za-z0-9·&()（）\- ]/g, '').trim();
      if (t.length >= 2 && t.length <= 24 && /[\u4e00-\u9fa5]/.test(t) && !skip.test(t)){
        merchant = t; break;
      }
    }
  }
  return {
    amount: amount != null ? Math.round(amount * 100) / 100 : null,
    merchant: merchant.slice(0, 24),
    category: merchant ? inferCategory(merchant + ' ' + String(text)) : '其他',
    account: inferAccount(String(text))
  };
}
function canvasBlob(c){
  return new Promise(function(resolve){
    c.toBlob(function(b){ resolve(b); }, 'image/png');
  });
}
function startOcr(file){
  if (typeof Tesseract === 'undefined'){
    toast('OCR 引擎未加载，请检查网络后重试');
    return;
  }
  const status = $('ocrStatus');
  status.innerHTML = '<span class="ocr-loading">正在加载图片…</span>';
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = function(){
    $('ocrPreview').src = url;
    $('ocrPreview').classList.remove('hidden');
    runTiles(img);
  };
  img.onerror = function(){ status.innerHTML = '<span class="ocr-fail">图片加载失败，请重试</span>'; };
  img.src = url;

  function runTiles(img){
    const W = img.naturalWidth, H = img.naturalHeight;
    const TILE = 2400, OVERLAP = 150;
    const tiles = [];
    if (H <= TILE){
      tiles.push(file);
    } else {
      let y = 0;
      while (y < H){
        const h = Math.min(TILE, H - y);
        const c = document.createElement('canvas');
        c.width = W; c.height = h;
        c.getContext('2d').drawImage(img, 0, y, W, h, 0, 0, W, h);
        tiles.push(canvasBlob(c));
        y += h;
        if (y >= H) break;
        y = Math.max(0, y - OVERLAP);
      }
    }
    status.innerHTML = '<span class="ocr-loading">识别中… 0%</span>';
    const texts = [];
    let done = 0;
    const total = tiles.length;
    function recognizeOne(tile, idx){
      return Tesseract.recognize(tile, 'chi_sim+eng', {
        logger: function(m){
          if (m.status === 'recognizing text'){
            const pct = Math.round((done + m.progress) / total * 100);
            status.innerHTML = '<span class="ocr-loading">识别中… ' + pct + '%</span>';
          }
        }
      }).then(function(res){
        texts[idx] = res.data.text || '';
        done++;
      });
    }
    let chain = Promise.resolve();
    for (let i = 0; i < total; i++){
      chain = chain.then(function(){ return recognizeOne(tiles[i], i); });
    }
    chain.then(function(){
      const text = texts.join('\n');
      const p = parseOcrText(text);
      if (p.amount == null){
        status.innerHTML = '<span class="ocr-fail">未识别到金额。建议截取该笔交易的详情页（而非整页长截图）再试，或手动填写金额</span>';
        return;
      }
      setType('expense');
      form.category = p.category;
      form.account = p.account;
      renderChips();
      $('fAmount').value = p.amount;
      $('fNote').value = p.merchant || '';
      status.innerHTML = '<span class="ocr-ok">✓ 已识别：¥' + fmt(p.amount) + (p.merchant ? ' · ' + escapeHtml(p.merchant) : '') + '（请核对后保存）</span>';
    }).catch(function(e){
      status.innerHTML = '<span class="ocr-fail">识别失败：' + escapeHtml(e && e.message ? e.message : '未知错误') + '</span>';
    });
  }
}
/* ===== sample & clear ===== */
function loadSample(){
  if (records.length && !confirm('已存在数据，是否追加示例数据？')) return;
  const cats = CATEGORIES;
  const accs = ['微信', '支付宝', '银行卡'];
  const notes = ['午饭', '奶茶', '地铁', '打车', '电影票', '话费充值', '超市采购', '外卖', '咖啡', '游戏充值'];
  const now = new Date();
  let added = 0;
  for (let i = 0; i < 36; i++){
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - Math.floor(Math.random() * 14));
    records.push({
      id: uid(),
      type: 'expense',
      category: cats[Math.floor(Math.random() * cats.length)],
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

/* ===== background particles ===== */
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

/* ===== events ===== */
function bindEvents(){
  $('btnPrev').addEventListener('click', function(){ selectedMonth = shiftMonth(selectedMonth, -1); render(); });
  $('btnNext').addEventListener('click', function(){ selectedMonth = shiftMonth(selectedMonth, 1); render(); });
  $('btnToday').addEventListener('click', function(){ selectedMonth = currentMonth(); render(); });

  document.querySelectorAll('.donut-tab').forEach(function(t){
    t.addEventListener('click', function(){
      document.querySelectorAll('.donut-tab').forEach(function(x){ x.classList.remove('active'); });
      t.classList.add('active');
      donutMode = t.dataset.mode;
      renderCharts();
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

  $('presetChips').addEventListener('click', function(e){
    const b = e.target.closest('.preset-chip');
    if (b) quickAdd(b.dataset.id);
  });

  $('recordList').addEventListener('click', function(e){
    const del = e.target.closest('.rec-del');
    if (del){ deleteRecord(del.dataset.id); return; }
    const rec = e.target.closest('.record');
    if (rec) openEdit(rec.dataset.id);
  });

  $('searchInput').addEventListener('input', function(){ search = $('searchInput').value; renderList(); });
  $('catFilter').addEventListener('click', function(e){
    const c = e.target.closest('.chip');
    if (c){ filterCategory = c.dataset.cat; renderFilters(); renderList(); }
  });

  $('btnOcr').addEventListener('click', function(){ $('ocrInput').click(); });
  $('ocrInput').addEventListener('change', function(e){
    if (e.target.files[0]) startOcr(e.target.files[0]);
    e.target.value = '';
  });

  $('btnSettings').addEventListener('click', function(){
    $('setBudget').value = settings.budget;
    renderSettingsPresets();
    renderThemeSwatches();
    $('settings').classList.remove('hidden');
  });
  $('btnCloseSettings').addEventListener('click', function(){ $('settings').classList.add('hidden'); });
  $('settings').addEventListener('click', function(e){ if (e.target === $('settings')) $('settings').classList.add('hidden'); });

  $('btnSaveBudget').addEventListener('click', function(){
    const v = parseFloat($('setBudget').value);
    settings.budget = v && v > 0 ? v : 0;
    saveSettings(); renderStats();
    toast(settings.budget > 0 ? '预算已设为 ¥' + fmt(settings.budget) : '已关闭预算');
  });

  $('themeList').addEventListener('click', function(e){
    const s = e.target.closest('.swatch');
    if (s){ settings.theme = s.dataset.theme; saveSettings(); applyTheme(); renderThemeSwatches(); }
  });

  $('presetList').addEventListener('click', function(e){
    const b = e.target.closest('.preset-del');
    if (!b) return;
    settings.presets = settings.presets.filter(function(p){ return p.id !== b.dataset.id; });
    saveSettings(); renderSettingsPresets(); renderPresets();
  });

  $('btnImport').addEventListener('click', function(){ $('fileInput').click(); });
  $('fileInput').addEventListener('change', function(e){
    if (e.target.files[0]) importCsv(e.target.files[0]);
    e.target.value = '';
  });
  $('btnExportJson').addEventListener('click', exportJson);
  $('btnExportCsv').addEventListener('click', exportCsv);
  $('btnSample').addEventListener('click', loadSample);
  $('btnClear').addEventListener('click', clearAll);
}

function init(){
  load();
  loadSettings();
  applyTheme();
  bindEvents();
  renderChips();
  renderFilters();
  renderSettingsPresets();
  renderThemeSwatches();
  $('setBudget').value = settings.budget;
  initBg();
  render();
  if ('serviceWorker' in navigator && location.protocol !== 'file:'){
    navigator.serviceWorker.register('sw.js').catch(function(){});
  }
}

document.addEventListener('DOMContentLoaded', init);
})();