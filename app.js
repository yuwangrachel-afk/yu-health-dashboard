const DATA = window.HEALTH_DATA;
const YEARS = ["2025", "2026"];

const metricCopy = {
  steps: ["步数", "steps"],
  walkingRunningDistance: ["步行/跑步距离", "km"],
  activeEnergy: ["活动能量", "Cal"],
  basalEnergy: ["基础能量", "Cal"],
  exerciseMinutes: ["运动分钟", "min"],
  standMinutes: ["站立分钟", "min"],
  flightsClimbed: ["爬楼", "floors"],
  timeInDaylight: ["日照时间", "min"],
  swimmingDistance: ["游泳距离", "km"],
  swimmingStrokes: ["游泳划水", "strokes"],
  cyclingDistance: ["骑行距离", "km"],
  heartRate: ["心率", "bpm"],
  restingHeartRate: ["静息心率", "bpm"],
  walkingHeartRate: ["步行心率", "bpm"],
  hrv: ["心率变异性", "ms"],
  respiratoryRate: ["呼吸频率", "breaths/min"],
  oxygenSaturation: ["血氧饱和度", "%"],
  vo2Max: ["VO2 max", "mL/kg/min"],
  heartRateRecovery: ["1 分钟心率恢复", "bpm"],
  sleepingWristTemp: ["睡眠腕温", "degC"],
  walkingSpeed: ["步速", "km/hr"],
  stepLength: ["步长", "cm"],
  doubleSupport: ["双脚支撑时间", "%"],
  walkingAsymmetry: ["步态不对称", "%"],
  walkingSteadiness: ["步行稳定性", "%"],
  sixMinuteWalkDistance: ["6 分钟步行距离", "m"],
  bodyMass: ["体重", "kg"],
  bmi: ["BMI", ""],
  bodyFat: ["体脂率", "%"],
  leanBodyMass: ["瘦体重", "kg"],
};

const colors = {
  primary: "#17765b",
  blue: "#2c5f96",
  rose: "#a13f55",
  amber: "#a96f1b",
  violet: "#6454a4",
  slate: "#667069",
};

let currentYear = "2026";

function ydata() {
  return DATA.years[currentYear];
}

function metric(key) {
  return ydata().metrics[key] || null;
}

function fmt(value, unit = "", digits = 0) {
  if (value == null || Number.isNaN(value)) return "No data";
  const abs = Math.abs(value);
  let fixed = digits;
  if (abs < 10 && unit !== "steps") fixed = Math.max(digits, 1);
  if (abs < 1) fixed = Math.max(fixed, 2);
  const number = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: fixed,
    minimumFractionDigits: fixed && abs < 10 ? 1 : 0,
  }).format(value);
  return `${number}${unit ? ` ${unit}` : ""}`;
}

function dateRange() {
  const r = ydata().range;
  const out = [];
  let d = new Date(`${r.first}T00:00:00`);
  const end = new Date(`${r.last}T00:00:00`);
  while (d <= end) {
    out.push(d.toISOString().slice(0, 10));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

function metricDaily(key) {
  const m = metric(key);
  if (!m) return [];
  const days = m.days || {};
  return dateRange().map((date) => ({ date, value: days[date] ?? null }));
}

function sleepDaily(field) {
  const stages = ydata().sleep.byNightStages || {};
  return dateRange().map((date) => ({ date, value: stages[date]?.[field] ?? null }));
}

function workoutDaily(field) {
  const days = ydata().workouts.byDay || {};
  return dateRange().map((date) => ({ date, value: days[date]?.[field] ?? 0 }));
}

function swimHeartRateDaily(field = "avg") {
  const days = ydata().swimming?.heartRate?.days || {};
  return dateRange().map((date) => ({ date, value: days[date]?.[field] ?? null }));
}

function swimEfficiencyDaily(mode = "distancePerStrokeM") {
  const distance = metric("swimmingDistance")?.days || {};
  const strokes = metric("swimmingStrokes")?.days || {};
  return dateRange().map((date) => {
    const km = distance[date];
    const strokeCount = strokes[date];
    if (!km || !strokeCount) return { date, value: null };
    const value = mode === "strokesPerKm" ? strokeCount / km : (km * 1000) / strokeCount;
    return { date, value };
  });
}

function swimSpeedHeartPairs() {
  const sessions = ydata().swimming?.sessions || [];
  return sessions.map((session) => {
    if (!session.speedPerHeartRate || !session.speedKmh || !session.avgHeartRate) return null;
    return {
      index: session.index,
      date: session.date,
      value: session.speedPerHeartRate,
      speed: session.speedKmh,
      heartRate: session.avgHeartRate,
      distanceKm: session.distanceKm,
      durationMin: session.durationMin,
      heartRateSamples: session.heartRateSamples,
    };
  }).filter(Boolean);
}

function definedValues(series) {
  return series.map((p) => p.value).filter((v) => v != null && Number.isFinite(v));
}

function stats(series) {
  const values = definedValues(series);
  if (!values.length) return { avg: null, min: null, max: null, count: 0, latest: null, latestDate: null };
  const latestPoint = [...series].reverse().find((p) => p.value != null && Number.isFinite(p.value));
  return {
    avg: values.reduce((a, b) => a + b, 0) / values.length,
    min: Math.min(...values),
    max: Math.max(...values),
    count: values.length,
    latest: latestPoint?.value ?? null,
    latestDate: latestPoint?.date ?? null,
  };
}

function sumDaily(series) {
  return definedValues(series).reduce((a, b) => a + b, 0);
}

function setRangeCopy() {
  const r = ydata().range;
  document.getElementById("rangeCopy").textContent =
    `来源：${DATA.sourceFile}。当前查看 ${currentYear}：${r.first} - ${r.last}，共 ${r.days} 天；图表优先展示每日记录。`;
}

function renderSummary() {
  const sleep = ydata().sleep;
  const workout = ydata().workouts;
  const cards = [
    ["记录范围", `${ydata().range.days} days`, `${ydata().range.first} - ${ydata().range.last}`],
    ["日均步数", fmt(stats(metricDaily("steps")).avg, "steps"), `${stats(metricDaily("steps")).count} days with data`],
    ["平均睡眠", fmt(sleep.avgHours, "hr", 1), `${sleep.nights} nights · efficiency ${fmt(sleep.efficiency, "%", 1)}`],
    ["深睡 / REM", `${fmt(sleep.avgStageHours?.Deep, "hr", 1)} / ${fmt(sleep.avgStageHours?.REM, "hr", 1)}`, "average per sleep night"],
    ["静息心率", fmt(metric("restingHeartRate")?.avg, "bpm"), `latest ${fmt(metric("restingHeartRate")?.latest, "bpm")} · ${metric("restingHeartRate")?.latestDate || "n/a"}`],
    ["HRV", fmt(metric("hrv")?.avg, "ms"), `latest ${fmt(metric("hrv")?.latest, "ms")} · ${metric("hrv")?.latestDate || "n/a"}`],
    ["VO2 max", fmt(metric("vo2Max")?.avg, "mL/kg/min"), `latest ${fmt(metric("vo2Max")?.latest, "mL/kg/min")} · ${metric("vo2Max")?.latestDate || "n/a"}`],
    ["运动总时长", fmt(workout.durationMin / 60, "hr", 1), `${workout.count} sessions · ${Object.keys(workout.byDay || {}).length} workout days`],
  ];
  document.getElementById("summaryCards").innerHTML = cards.map(([label, value, foot]) => `
    <article class="stat-card">
      <div class="stat-top"><div class="stat-label">${label}</div></div>
      <div class="stat-value">${value}</div>
      <div class="stat-foot">${foot}</div>
    </article>
  `).join("");
}

function renderChart(hostId, specs) {
  const host = document.getElementById(hostId);
  host.innerHTML = "";
  specs.forEach((spec) => {
    const series = spec.series();
    const s = stats(series);
    const card = document.createElement("div");
    card.className = "chart-card";
    card.innerHTML = `
      <div class="chart-title-row">
        <h3>${spec.title}</h3>
        <span>${spec.caption || "daily"}</span>
      </div>
      <canvas aria-label="${spec.title} daily chart"></canvas>
      <div class="chart-tooltip" role="status" aria-live="polite"></div>
      <div class="legend">
        <span><i style="background:${spec.color || colors.primary}"></i>${currentYear}</span>
        <span>avg ${fmt(s.avg, spec.unit, spec.digits ?? 0)}</span>
        <span>max ${fmt(s.max, spec.unit, spec.digits ?? 0)}</span>
        <span>${s.count} days</span>
      </div>
    `;
    host.appendChild(card);
    drawDailyChart(card.querySelector("canvas"), series, spec.color || colors.primary, spec.unit, spec.digits ?? 0, card.querySelector(".chart-tooltip"), {
      emphasizedPoints: Boolean(spec.emphasizedPoints),
    });
  });
}

function drawDailyChart(canvas, series, color, unit = "", digits = 0, tooltip = null, options = {}) {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.round(rect.width * dpr));
  canvas.height = Math.max(1, Math.round(rect.height * dpr));
  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);
  const width = rect.width;
  const height = rect.height;
  const values = definedValues(series);
  const scale = niceScale(values);
  ctx.font = "11px system-ui";
  const yLabels = scale.ticks.map((v) => axisLabel(v, unit, digits));
  const leftWidth = Math.max(44, ...yLabels.map((label) => ctx.measureText(label).width + 10));
  const pad = { top: 16, right: 10, bottom: 30, left: Math.min(78, leftWidth) };
  const span = scale.max - scale.min || 1;

  function pointAt(index) {
    const p = series[index];
    if (!p || p.value == null || !Number.isFinite(p.value)) return null;
    return {
      ...p,
      index,
      x: pad.left + ((width - pad.left - pad.right) * index) / Math.max(1, series.length - 1),
      y: pad.top + (height - pad.top - pad.bottom) * (1 - (p.value - scale.min) / span),
    };
  }

  function render(activeIndex = null) {
    ctx.clearRect(0, 0, width, height);
    ctx.lineWidth = 1;
    ctx.textBaseline = "middle";
    scale.ticks.forEach((tick, i) => {
      const y = pad.top + (height - pad.top - pad.bottom) * (1 - (tick - scale.min) / span);
      ctx.strokeStyle = i === scale.ticks.length - 1 ? "#cfd8d0" : "#dfe6de";
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(width - pad.right, y);
      ctx.stroke();
      ctx.fillStyle = "#667069";
      ctx.textAlign = "right";
      ctx.fillText(yLabels[i], pad.left - 8, y);
    });
    ctx.strokeStyle = "#b9c5bc";
    ctx.beginPath();
    ctx.moveTo(pad.left, pad.top);
    ctx.lineTo(pad.left, height - pad.bottom);
    ctx.stroke();
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#78837c";
    const monthMarks = [];
    series.forEach((p, i) => {
      if (p.date.endsWith("-01")) monthMarks.push([i, p.date.slice(5, 7)]);
    });
    monthMarks.forEach(([i, month]) => {
      const x = pad.left + ((width - pad.left - pad.right) * i) / Math.max(1, series.length - 1);
      ctx.fillText(month, x - 5, height - 8);
    });

    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    let started = false;
    series.forEach((p, i) => {
      const pt = pointAt(i);
      if (!pt) {
        started = false;
        return;
      }
      if (!started) {
        ctx.moveTo(pt.x, pt.y);
        started = true;
      } else {
        ctx.lineTo(pt.x, pt.y);
      }
    });
    ctx.stroke();

    if (series.length <= 80 || options.emphasizedPoints) {
      series.forEach((p, i) => {
        const pt = pointAt(i);
        if (!pt) return;
        ctx.fillStyle = color;
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = options.emphasizedPoints ? 2.4 : 0;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, options.emphasizedPoints ? 5.5 : 3, 0, Math.PI * 2);
        ctx.fill();
        if (options.emphasizedPoints) ctx.stroke();
      });
    }

    const active = activeIndex == null ? null : pointAt(activeIndex);
    if (active) {
      ctx.strokeStyle = "rgba(23, 32, 26, 0.45)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(active.x, pad.top);
      ctx.lineTo(active.x, height - pad.bottom);
      ctx.stroke();
      ctx.fillStyle = "#ffffff";
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(active.x, active.y, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }

  function nearestIndex(rawIndex) {
    const clamped = Math.max(0, Math.min(series.length - 1, rawIndex));
    if (pointAt(clamped)) return clamped;
    for (let offset = 1; offset <= 10; offset++) {
      if (pointAt(clamped - offset)) return clamped - offset;
      if (pointAt(clamped + offset)) return clamped + offset;
    }
    return null;
  }

  function showTooltip(index) {
    if (!tooltip) return;
    const pt = pointAt(index);
    if (!pt) {
      tooltip.classList.remove("visible");
      return;
    }
    tooltip.innerHTML = `<strong>${pt.date}</strong><span>${fmt(pt.value, unit, digits)}</span>`;
    tooltip.classList.add("visible");
    const left = canvas.offsetLeft + pt.x + 12;
    const top = canvas.offsetTop + pt.y - 38;
    const maxLeft = canvas.offsetLeft + width - tooltip.offsetWidth - 8;
    tooltip.style.left = `${Math.max(8, Math.min(left, maxLeft))}px`;
    tooltip.style.top = `${Math.max(8, top)}px`;
  }

  render();

  canvas.addEventListener("mousemove", (event) => {
    const bounds = canvas.getBoundingClientRect();
    const x = event.clientX - bounds.left;
    const ratio = (x - pad.left) / Math.max(1, width - pad.left - pad.right);
    const index = nearestIndex(Math.round(ratio * (series.length - 1)));
    if (index == null) {
      render();
      tooltip?.classList.remove("visible");
      return;
    }
    render(index);
    showTooltip(index);
  });

  canvas.addEventListener("mouseleave", () => {
    render();
    tooltip?.classList.remove("visible");
  });
}

function renderSwimSpeedHeartChart(hostId) {
  const host = document.getElementById(hostId);
  const points = swimSpeedHeartPairs();
  const ratioStats = stats(points);
  const card = document.createElement("div");
  card.className = "chart-card";
  card.innerHTML = `
    <div class="chart-title-row">
      <h3>每次游泳：速度 / 平均心率</h3>
      <span>session ratio</span>
    </div>
    <canvas aria-label="每次游泳速度除以平均心率 chart"></canvas>
    <div class="chart-tooltip" role="status" aria-live="polite"></div>
    <div class="legend">
      <span><i style="background:${colors.rose}"></i>${currentYear}</span>
      <span>avg ${fmt(ratioStats.avg, "km/hr/bpm", 4)}</span>
      <span>max ${fmt(ratioStats.max, "km/hr/bpm", 4)}</span>
      <span>${points.length} sessions</span>
    </div>
  `;
  host.appendChild(card);
  drawSessionRatioChart(card.querySelector("canvas"), points, card.querySelector(".chart-tooltip"));
}

function drawSessionRatioChart(canvas, points, tooltip) {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.round(rect.width * dpr));
  canvas.height = Math.max(1, Math.round(rect.height * dpr));
  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);
  const width = rect.width;
  const height = rect.height;
  const yScale = niceScale(points.map((p) => p.value));
  const maxIndex = Math.max(...points.map((p) => p.index), 1);
  ctx.font = "11px system-ui";
  const yLabels = yScale.ticks.map((v) => trimNumber(v, 4));
  const leftWidth = Math.max(48, ...yLabels.map((label) => ctx.measureText(label).width + 10));
  const pad = { top: 18, right: 18, bottom: 42, left: Math.min(82, leftWidth) };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  function xOf(index) {
    return pad.left + plotW * ((index - 1) / Math.max(1, maxIndex - 1));
  }

  function yOf(value) {
    return pad.top + plotH * (1 - (value - yScale.min) / Math.max(1e-9, yScale.max - yScale.min));
  }

  function render(active = null) {
    ctx.clearRect(0, 0, width, height);
    ctx.lineWidth = 1;
    ctx.textBaseline = "middle";
    yScale.ticks.forEach((tick) => {
      const y = yOf(tick);
      ctx.strokeStyle = "#dfe6de";
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(width - pad.right, y);
      ctx.stroke();
      ctx.fillStyle = "#667069";
      ctx.textAlign = "right";
      ctx.fillText(trimNumber(tick, 4), pad.left - 8, y);
    });
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    sessionTicks(maxIndex).forEach((tick) => {
      const x = xOf(tick);
      ctx.strokeStyle = "#eef2ed";
      ctx.beginPath();
      ctx.moveTo(x, pad.top);
      ctx.lineTo(x, height - pad.bottom);
      ctx.stroke();
      ctx.fillStyle = "#667069";
      ctx.fillText(`#${tick}`, x, height - 16);
    });
    ctx.strokeStyle = "#b9c5bc";
    ctx.beginPath();
    ctx.moveTo(pad.left, pad.top);
    ctx.lineTo(pad.left, height - pad.bottom);
    ctx.lineTo(width - pad.right, height - pad.bottom);
    ctx.stroke();
    ctx.fillStyle = "#667069";
    ctx.textAlign = "left";
    ctx.fillText("swim session", pad.left, height - 4);
    ctx.save();
    ctx.translate(12, pad.top + 92);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("speed / avg HR", 0, 0);
    ctx.restore();

    ctx.strokeStyle = colors.rose;
    ctx.lineWidth = 2;
    ctx.beginPath();
    points.forEach((p, i) => {
      const x = xOf(p.index);
      const y = yOf(p.value);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    points.forEach((p) => {
      ctx.fillStyle = colors.rose;
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.arc(xOf(p.index), yOf(p.value), 5.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    });

    if (active) {
      const x = xOf(active.index);
      const y = yOf(active.value);
      ctx.strokeStyle = "rgba(23, 32, 26, 0.35)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, pad.top);
      ctx.lineTo(x, height - pad.bottom);
      ctx.moveTo(pad.left, y);
      ctx.lineTo(width - pad.right, y);
      ctx.stroke();
      ctx.fillStyle = "#ffffff";
      ctx.strokeStyle = colors.rose;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, y, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }

  function nearest(clientX, clientY) {
    const bounds = canvas.getBoundingClientRect();
    const x = clientX - bounds.left;
    const y = clientY - bounds.top;
    let best = null;
    let bestDist = Infinity;
    points.forEach((p) => {
      const dx = xOf(p.index) - x;
      const dy = yOf(p.value) - y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < bestDist) {
        best = p;
        bestDist = dist;
      }
    });
    return bestDist <= 28 ? best : null;
  }

  function showTooltip(point) {
    if (!point) {
      tooltip.classList.remove("visible");
      return;
    }
    const x = xOf(point.index);
    const y = yOf(point.value);
    tooltip.innerHTML = `
      <strong>#${point.index} · ${point.date}</strong>
      <span>${fmt(point.value, "km/hr/bpm", 4)}</span>
      <small>${fmt(point.speed, "km/hr", 1)} / ${fmt(point.heartRate, "bpm", 0)}</small>
      <small>${fmt(point.distanceKm, "km", 1)} · ${fmt(point.durationMin, "min", 0)} · HR n=${point.heartRateSamples}</small>
    `;
    tooltip.classList.add("visible");
    const left = canvas.offsetLeft + x + 12;
    const top = canvas.offsetTop + y - 42;
    const maxLeft = canvas.offsetLeft + width - tooltip.offsetWidth - 8;
    tooltip.style.left = `${Math.max(8, Math.min(left, maxLeft))}px`;
    tooltip.style.top = `${Math.max(8, top)}px`;
  }

  render();
  canvas.addEventListener("mousemove", (event) => {
    const point = nearest(event.clientX, event.clientY);
    render(point);
    showTooltip(point);
  });
  canvas.addEventListener("mouseleave", () => {
    render();
    tooltip.classList.remove("visible");
  });
}

function sessionTicks(maxIndex) {
  if (maxIndex <= 8) return Array.from({ length: maxIndex }, (_, i) => i + 1);
  const step = niceNumber(maxIndex / 6);
  const ticks = [1];
  for (let v = step; v < maxIndex; v += step) {
    const rounded = Math.round(v);
    if (rounded > 1 && rounded < maxIndex && !ticks.includes(rounded)) ticks.push(rounded);
  }
  if (!ticks.includes(maxIndex)) ticks.push(maxIndex);
  return ticks;
}

function niceScale(values) {
  if (!values.length) {
    return { min: 0, max: 1, ticks: [0, 0.5, 1] };
  }
  let rawMin = Math.min(...values);
  let rawMax = Math.max(...values);
  if (rawMin === rawMax) {
    const bump = Math.abs(rawMax || 1) * 0.1;
    rawMin -= bump;
    rawMax += bump;
  }
  if (rawMin > 0 && rawMin / rawMax < 0.72) rawMin = 0;
  const targetTicks = 4;
  const step = niceNumber((rawMax - rawMin) / (targetTicks - 1));
  const min = Math.floor(rawMin / step) * step;
  const max = Math.ceil(rawMax / step) * step;
  const ticks = [];
  for (let v = min; v <= max + step * 0.5; v += step) {
    ticks.push(Number(v.toFixed(10)));
  }
  return { min, max, ticks };
}

function niceNumber(value) {
  const exponent = Math.floor(Math.log10(value || 1));
  const fraction = value / Math.pow(10, exponent);
  let niceFraction = 1;
  if (fraction <= 1) niceFraction = 1;
  else if (fraction <= 2) niceFraction = 2;
  else if (fraction <= 5) niceFraction = 5;
  else niceFraction = 10;
  return niceFraction * Math.pow(10, exponent);
}

function axisLabel(value, unit, digits) {
  const abs = Math.abs(value);
  if (abs >= 1000000) return `${trimNumber(value / 1000000, 1)}M`;
  if (abs >= 10000) return `${trimNumber(value / 1000, 0)}k`;
  if (abs >= 1000 && unit === "steps") return `${trimNumber(value / 1000, 0)}k`;
  if (unit === "degC") return trimNumber(value, 1);
  if (unit === "%" || abs < 10) return trimNumber(value, Math.max(1, digits));
  return trimNumber(value, 0);
}

function trimNumber(value, digits) {
  return Number(value.toFixed(digits)).toLocaleString("en-US");
}

function renderSleep() {
  const sleep = ydata().sleep;
  const totalStage = ["Core", "Deep", "REM", "Unspecified", "Awake"].reduce((sum, k) => sum + (sleep.stages[k] || 0), 0) || 1;
  document.getElementById("sleepPanel").innerHTML = `
    <div class="detail-grid">
      ${detail("睡眠夜数", `${sleep.nights}`, `${sleep.totalHours.toLocaleString()} total hours`)}
      ${detail("平均每晚", fmt(sleep.avgHours, "hr", 1), "asleep only, excludes awake/in bed")}
      ${detail("睡眠效率", fmt(sleep.efficiency, "%", 1), "asleep / asleep + awake")}
      ${detail("平均清醒", fmt(sleep.avgStageHours?.Awake, "hr", 1), "per tracked night")}
      ${detail("Core", `${fmt(sleep.avgStageHours?.Core, "hr", 1)} · ${fmt(sleep.stagePercentages?.Core, "%", 1)}`, "average and share")}
      ${detail("Deep", `${fmt(sleep.avgStageHours?.Deep, "hr", 1)} · ${fmt(sleep.stagePercentages?.Deep, "%", 1)}`, "average and share")}
      ${detail("REM", `${fmt(sleep.avgStageHours?.REM, "hr", 1)} · ${fmt(sleep.stagePercentages?.REM, "%", 1)}`, "average and share")}
      ${detail("最长 / 最短", `${fmt(sleep.longestNight?.hours, "hr", 1)} / ${fmt(sleep.shortestNight?.hours, "hr", 1)}`, `${sleep.longestNight?.date || "n/a"} · ${sleep.shortestNight?.date || "n/a"}`)}
    </div>
    <div class="sleep-track" aria-label="${currentYear} sleep stage shares">
      ${stage("Core", sleep.stages.Core, totalStage)}
      ${stage("Deep", sleep.stages.Deep, totalStage)}
      ${stage("REM", sleep.stages.REM, totalStage)}
      ${stage("Unspecified", sleep.stages.Unspecified, totalStage)}
      ${stage("Awake", sleep.stages.Awake, totalStage)}
    </div>
    <div class="legend">
      <span><i class="stage-core"></i>Core ${fmt(sleep.stages.Core, "hr", 0)}</span>
      <span><i class="stage-deep"></i>Deep ${fmt(sleep.stages.Deep, "hr", 0)}</span>
      <span><i class="stage-rem"></i>REM ${fmt(sleep.stages.REM, "hr", 0)}</span>
      <span><i class="stage-unspecified"></i>Unspecified ${fmt(sleep.stages.Unspecified, "hr", 0)}</span>
      <span><i class="stage-awake"></i>Awake ${fmt(sleep.stages.Awake, "hr", 0)}</span>
    </div>
    <div class="chart-grid sleep-chart-grid" id="sleepCharts"></div>
  `;
  renderChart("sleepCharts", [
    { title: "每日睡眠时长", unit: "hr", digits: 1, color: colors.blue, series: () => sleepDaily("totalAsleep") },
    { title: "每日睡眠效率", unit: "%", digits: 1, color: colors.primary, series: () => sleepDaily("efficiency") },
    { title: "每日深睡", unit: "hr", digits: 1, color: colors.violet, series: () => sleepDaily("Deep") },
    { title: "每日 REM", unit: "hr", digits: 1, color: colors.amber, series: () => sleepDaily("REM") },
    { title: "每日清醒", unit: "hr", digits: 1, color: colors.rose, series: () => sleepDaily("Awake") },
    { title: "睡眠腕温", unit: "degC", digits: 2, color: colors.slate, series: () => metricDaily("sleepingWristTemp") },
  ]);
}

function detail(label, value, note) {
  return `<div class="detail-card"><span>${label}</span><strong>${value}</strong><small>${note}</small></div>`;
}

function stage(name, value, total) {
  const cls = name === "Core" ? "stage-core" : name === "Deep" ? "stage-deep" : name === "REM" ? "stage-rem" : name === "Awake" ? "stage-awake" : "stage-unspecified";
  return `<div class="${cls}" style="width:${Math.max(1.5, (value / total) * 100)}%"></div>`;
}

function renderMetricRows(hostId, keys, mode = "avg") {
  const host = document.getElementById(hostId);
  host.innerHTML = "";
  keys.forEach((key) => {
    const m = metric(key);
    const [label, unit] = metricCopy[key] || [key, ""];
    const value = mode === "latest" ? m?.latest : m?.avg;
    const row = document.createElement("div");
    row.className = "metric-row";
    row.innerHTML = `
      <div>
        <div class="metric-name">${label}</div>
        <small class="muted">${m ? `${m.count || m.activeDays || 0} records/days · latest ${m.latestDate || "n/a"}` : "No data"}</small>
      </div>
      <div class="metric-value">${fmt(value, unit, key === "bodyMass" ? 1 : 0)}</div>
    `;
    host.appendChild(row);
  });
}

function renderWorkouts() {
  const w = ydata().workouts;
  const types = Object.entries(w.types || {});
  const max = Math.max(...types.map(([, v]) => v.durationMin), 1);
  document.getElementById("workoutPanel").innerHTML = `
    <div class="detail-grid">
      ${detail("运动次数", w.count, `${Object.keys(w.byDay || {}).length} workout days`)}
      ${detail("总时长", fmt(w.durationMin / 60, "hr", 1), `${fmt(w.durationMin / Math.max(1, w.count), "min", 0)} per session`)}
      ${detail("游泳", fmt(metric("swimmingDistance")?.total, "km", 1), `${fmt(metric("swimmingStrokes")?.total, "strokes", 0)}`)}
      ${detail("骑行", fmt(metric("cyclingDistance")?.total, "km", 1), `${metric("cyclingDistance")?.activeDays || 0} days`)}
    </div>
    <div class="chart-grid one" id="workoutCharts"></div>
    <div class="workout-list">
      ${types.map(([name, v]) => `
        <div class="workout-row">
          <strong>${workoutName(name)}</strong>
          <div class="bar"><span style="width:${(v.durationMin / max) * 100}%"></span></div>
          <span>${v.count} · ${fmt(v.durationMin / 60, "hr", 1)}</span>
        </div>
      `).join("")}
    </div>
  `;
  renderChart("workoutCharts", [
    { title: "每日运动时长", unit: "min", color: colors.primary, series: () => workoutDaily("durationMin") },
  ]);
}

function workoutName(name) {
  return name.replace(/([a-z])([A-Z])/g, "$1 $2");
}

function renderSwimming() {
  const distance = metric("swimmingDistance");
  const strokes = metric("swimmingStrokes");
  const swimWorkout = ydata().workouts.types?.Swimming || { count: 0, durationMin: 0 };
  const swim = ydata().swimming || {};
  const efficiency = swim.efficiency || {};
  const swimHr = swim.heartRate || {};
  const distancePerSwimDay = distance?.total && distance?.activeDays ? distance.total / distance.activeDays : null;
  const strokesPerSwimDay = strokes?.total && strokes?.activeDays ? strokes.total / strokes.activeDays : null;
  const strokesPerKm = efficiency.strokesPerKm ?? (distance?.total ? strokes?.total / distance.total : null);
  const avgSessionMin = swimWorkout.count ? swimWorkout.durationMin / swimWorkout.count : null;
  const estimatedPace = efficiency.paceMinPerKm ?? (distance?.total ? swimWorkout.durationMin / distance.total : null);
  const distanceSeries = metricDaily("swimmingDistance");
  const strokeSeries = metricDaily("swimmingStrokes");
  const efficiencySeries = swimEfficiencyDaily("distancePerStrokeM");
  const swimHrSeries = swimHeartRateDaily("avg");
  const bestDistance = stats(distanceSeries);
  const bestStrokes = stats(strokeSeries);
  const bestEfficiency = stats(efficiencySeries);
  const swimHrStats = stats(swimHrSeries);

  document.getElementById("swimPanel").innerHTML = `
    <div class="detail-grid">
      ${detail("游泳总距离", fmt(distance?.total, "km", 1), `${distance?.activeDays || 0} swim days · ${distance?.count || 0} distance records`)}
      ${detail("平均游泳日距离", fmt(distancePerSwimDay, "km", 1), `best ${fmt(bestDistance.max, "km", 1)} · ${bestDistance.latestDate || "n/a"}`)}
      ${detail("游泳训练", `${swimWorkout.count} sessions`, `${fmt(swimWorkout.durationMin / 60, "hr", 1)} total · ${fmt(avgSessionMin, "min", 0)} avg`)}
      ${detail("估算配速", fmt(estimatedPace, "min/km", 0), "workout minutes / swim distance")}
      ${detail("划水总数", fmt(strokes?.total, "strokes", 0), `${strokes?.activeDays || 0} stroke days`)}
      ${detail("平均游泳日划水", fmt(strokesPerSwimDay, "strokes", 0), `best ${fmt(bestStrokes.max, "strokes", 0)}`)}
      ${detail("每次划水推进", fmt(efficiency.distancePerStrokeM, "m/stroke", 2), `best daily ${fmt(bestEfficiency.max, "m/stroke", 2)}`)}
      ${detail("划水密度", fmt(strokesPerKm, "strokes/km", 0), "lower can indicate longer distance per stroke")}
      ${detail("游泳平均心率", fmt(swimHr.avg, "bpm", 0), `${swimHr.count || 0} HR samples · ${Object.keys(swimHr.days || {}).length} days`)}
      ${detail("游泳心率范围", `${fmt(swimHr.min, "bpm", 0)} - ${fmt(swimHr.max, "bpm", 0)}`, `daily avg max ${fmt(swimHrStats.max, "bpm", 0)}`)}
      ${detail("划水频率", fmt(efficiency.strokeRatePerMin, "strokes/min", 1), "strokes / workout minutes")}
      ${detail("最近记录", fmt(distance?.latest, "km", 2), `${distance?.latestDate || "n/a"} · ${fmt(strokes?.latest, "strokes", 0)}`)}
    </div>
    <div class="chart-grid" id="swimCharts"></div>
    <div class="insight-grid swim-insights">
      ${swimInsight("训练频率", `当前年份记录到 ${distance?.activeDays || 0} 个游泳距离日、${swimWorkout.count} 次游泳训练。若想看游泳习惯是否稳定，优先观察每日距离图中是否集中在少数月份。`)}
      ${swimInsight("训练容量", `游泳总距离 ${fmt(distance?.total, "km", 1)}，平均游泳日 ${fmt(distancePerSwimDay, "km", 1)}。单日最高 ${fmt(bestDistance.max, "km", 1)}，可以作为容量峰值参考。`)}
      ${swimInsight("技术效率", `平均每次划水推进约 ${fmt(efficiency.distancePerStrokeM, "m/stroke", 2)}，划水密度约 ${fmt(strokesPerKm, "strokes/km", 0)}。在相近速度和泳姿下，推进距离上升通常代表效率更好。`)}
      ${swimInsight("游泳心率", `游泳期间平均心率 ${fmt(swimHr.avg, "bpm", 0)}，记录范围 ${fmt(swimHr.min, "bpm", 0)} - ${fmt(swimHr.max, "bpm", 0)}。水中光学心率可能有误差，适合看趋势。`)}
      ${swimInsight("强度与效率", `可把每日心率和每次划水推进距离一起看：如果心率相近但推进距离提高，说明技术效率可能改善；如果心率升高但距离没有增加，可能是强度或疲劳上升。`)}
      ${swimInsight("恢复与安排", `估算每次游泳 ${fmt(avgSessionMin, "min", 0)}，配速 ${fmt(estimatedPace, "min/km", 0)}。如果游泳日后 HRV 明显下降或静息心率升高，可把强度日和恢复日错开观察。`)}
    </div>
  `;
  renderChart("swimCharts", [
    { title: "每日游泳距离", unit: "km", digits: 1, color: colors.blue, emphasizedPoints: true, series: () => distanceSeries },
    { title: "每日游泳划水次数", unit: "strokes", color: colors.primary, emphasizedPoints: true, series: () => strokeSeries },
    { title: "每日划水效率", unit: "m/stroke", digits: 2, color: colors.violet, emphasizedPoints: true, series: () => efficiencySeries },
    { title: "游泳期间平均心率", unit: "bpm", color: colors.rose, emphasizedPoints: true, series: () => swimHrSeries },
  ]);
  renderSwimSpeedHeartChart("swimCharts");
}

function swimInsight(title, body) {
  return `<article class="insight"><strong>${title}</strong><p>${body}</p></article>`;
}

function renderInsights() {
  const sleep = ydata().sleep;
  const steps = stats(metricDaily("steps"));
  const heart = metric("restingHeartRate");
  const gait = metric("walkingSteadiness");
  const swimDistance = metric("swimmingDistance");
  const cards = [
    ["数据范围", `${currentYear} 当前有 ${ydata().range.days} 天范围数据；每日图中断开的地方代表当天没有该项记录。`],
    ["睡眠", `平均 ${fmt(sleep.avgHours, "hr", 1)}，效率 ${fmt(sleep.efficiency, "%", 1)}；Deep 占 ${fmt(sleep.stagePercentages?.Deep, "%", 1)}，REM 占 ${fmt(sleep.stagePercentages?.REM, "%", 1)}。`],
    ["活动", `日均步数 ${fmt(steps.avg, "steps")}，最高单日 ${fmt(steps.max, "steps")}；距离、活动能量和运动分钟可在每日曲线里看波动。`],
    ["游泳", `游泳总距离 ${fmt(swimDistance?.total, "km", 1)}，${swimDistance?.activeDays || 0} 个游泳日；专项模块里可看距离、划水和估算配速。`],
    ["恢复", `静息心率平均 ${fmt(heart?.avg, "bpm")}，HRV 平均 ${fmt(metric("hrv")?.avg, "ms")}；这些是恢复状态参考，不等同于医学结论。`],
    ["步态", `步行稳定性平均 ${fmt(gait?.avg, "%")}，步态不对称平均 ${fmt(metric("walkingAsymmetry")?.avg, "%", 1)}，建议结合具体不适和训练记录解读。`],
    ["身体组成", `身体组成记录较少，最新体重 ${fmt(metric("bodyMass")?.latest, "kg", 1)}，更适合看长期趋势，不适合按天判断。`],
  ];
  document.getElementById("insights").innerHTML = cards.map(([title, body]) => `
    <article class="insight"><strong>${title}</strong><p>${body}</p></article>
  `).join("");
}

function renderAll() {
  setRangeCopy();
  renderSummary();
  renderChart("activityCharts", [
    { title: "每日步数", unit: "steps", series: () => metricDaily("steps") },
    { title: "每日步行/跑步距离", unit: "km", digits: 1, color: colors.blue, series: () => metricDaily("walkingRunningDistance") },
    { title: "每日活动能量", unit: "Cal", color: colors.amber, series: () => metricDaily("activeEnergy") },
    { title: "每日运动分钟", unit: "min", color: colors.rose, series: () => metricDaily("exerciseMinutes") },
    { title: "每日站立分钟", unit: "min", color: colors.violet, series: () => metricDaily("standMinutes") },
    { title: "每日日照时间", unit: "min", color: colors.slate, series: () => metricDaily("timeInDaylight") },
  ]);
  renderSleep();
  renderChart("heartPanel", [
    { title: "每日平均心率", unit: "bpm", color: colors.rose, series: () => metricDaily("heartRate") },
    { title: "每日静息心率", unit: "bpm", color: colors.blue, series: () => metricDaily("restingHeartRate") },
    { title: "每日 HRV", unit: "ms", color: colors.primary, series: () => metricDaily("hrv") },
    { title: "每日呼吸频率", unit: "breaths/min", color: colors.violet, series: () => metricDaily("respiratoryRate") },
    { title: "每日血氧", unit: "%", color: colors.slate, series: () => metricDaily("oxygenSaturation") },
    { title: "VO2 max 记录", unit: "mL/kg/min", color: colors.amber, series: () => metricDaily("vo2Max") },
  ]);
  renderChart("mobilityCharts", [
    { title: "每日步速", unit: "km/hr", digits: 1, color: colors.blue, series: () => metricDaily("walkingSpeed") },
    { title: "每日步长", unit: "cm", color: colors.primary, series: () => metricDaily("stepLength") },
    { title: "每日双脚支撑时间", unit: "%", digits: 1, color: colors.amber, series: () => metricDaily("doubleSupport") },
    { title: "每日步态不对称", unit: "%", digits: 1, color: colors.rose, series: () => metricDaily("walkingAsymmetry") },
    { title: "每日步行稳定性", unit: "%", digits: 1, color: colors.violet, series: () => metricDaily("walkingSteadiness") },
    { title: "6 分钟步行距离", unit: "m", color: colors.slate, series: () => metricDaily("sixMinuteWalkDistance") },
  ]);
  renderWorkouts();
  renderSwimming();
  renderMetricRows("bodyPanel", ["bodyMass", "bmi", "bodyFat", "leanBodyMass"], "latest");
  renderInsights();
}

document.querySelectorAll(".seg").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".seg").forEach((b) => b.classList.remove("active"));
    button.classList.add("active");
    currentYear = button.dataset.view;
    renderAll();
  });
});

window.addEventListener("resize", () => {
  clearTimeout(window.__chartResize);
  window.__chartResize = setTimeout(renderAll, 120);
});

renderAll();
