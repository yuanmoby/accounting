(function(){
'use strict';

function drawDonut(canvas, items){
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth || 240, h = canvas.clientHeight || 240;
  canvas.width = w * dpr; canvas.height = h * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  const cx = w / 2, cy = h / 2;
  const r = Math.min(w, h) / 2 - 12;
  const ring = Math.max(10, r * 0.42);
  const rr = r - ring / 2;
  const total = items.reduce(function(s, i){ return s + Number(i.value || 0); }, 0);
  if (!total){
    ctx.beginPath();
    ctx.arc(cx, cy, rr, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(0,240,255,0.16)';
    ctx.lineWidth = ring;
    ctx.stroke();
    return;
  }
  let start = -Math.PI / 2;
  items.forEach(function(it){
    const val = Number(it.value || 0);
    if (val <= 0) return;
    const angle = val / total * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(cx, cy, rr, start, start + angle - 0.015);
    ctx.strokeStyle = it.color || '#8a8f98';
    ctx.lineWidth = ring;
    ctx.lineCap = 'butt';
    ctx.shadowColor = it.color || '#8a8f98';
    ctx.shadowBlur = 14;
    ctx.stroke();
    ctx.shadowBlur = 0;
    start += angle;
  });
}

function roundRect(ctx, x, y, w, h, r){
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawBars(canvas, data){
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth || 320, h = canvas.clientHeight || 160;
  canvas.width = w * dpr; canvas.height = h * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  const padL = 8, padR = 8, padT = 14, padB = 26;
  const chartW = w - padL - padR, chartH = h - padT - padB;
  const values = data.map(function(d){ return Number(d.value || 0); });
  const max = Math.max.apply(null, values.concat([1]));
  ctx.strokeStyle = 'rgba(0,240,255,0.08)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 3; i++){
    const y = padT + chartH * (i / 3);
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(w - padR, y); ctx.stroke();
  }
  const bw = chartW / data.length;
  const barW = Math.min(28, bw * 0.55);
  data.forEach(function(d, i){
    const x = padL + bw * i + (bw - barW) / 2;
    const v = Number(d.value || 0);
    const bh = Math.max(2, v / max * chartH);
    const y = padT + chartH - bh;
    const g = ctx.createLinearGradient(0, y, 0, padT + chartH);
    g.addColorStop(0, '#00f0ff');
    g.addColorStop(1, '#ff2d95');
    ctx.fillStyle = g;
    ctx.shadowColor = 'rgba(0,240,255,0.5)';
    ctx.shadowBlur = 8;
    roundRect(ctx, x, y, barW, bh, 4);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#6f8a9c';
    ctx.font = '10px Consolas, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(d.label, x + barW / 2, h - 9);
    if (v > 0){
      ctx.fillStyle = '#d8f3ff';
      ctx.fillText('¥' + v.toFixed(0), x + barW / 2, y - 6);
    }
  });
}

window.Charts = { drawDonut: drawDonut, drawBars: drawBars };
})();