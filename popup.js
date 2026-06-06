/**
 * SKYCAST — popup.js
 * Depends on helpers.js (loaded before this script in popup.html).
 */

// ── Configuration ─────────────────────────────────────────────────────────────

const CONFIG = Object.freeze({
  NIGHT_START_HOUR:      18,
  NIGHT_END_HOUR:         6,
  FEELS_LIKE_THRESHOLD_C: 3,
  GEO_TIMEOUT_MS:         10000,
  GEO_MAX_AGE_MS:         300000, // 5 minutes
  MS_TO_KMH:              3.6,
  FORECAST_HOURLY_SLOTS:  4,
  FORECAST_DAY_COUNT:     3,
});

// ── Storage abstraction ───────────────────────────────────────────────────────
// Works in both Chrome extension context (chrome.storage.sync) and
// local development server context (localStorage).

const Storage = {
  get(key, callback) {
    if (typeof chrome !== 'undefined' && chrome.storage?.sync) {
      chrome.storage.sync.get([key], result => callback(result[key] ?? null));
    } else {
      callback(localStorage.getItem(`skycast_${key}`));
    }
  },
  set(key, value, callback) {
    if (typeof chrome !== 'undefined' && chrome.storage?.sync) {
      chrome.storage.sync.set({ [key]: value }, () => callback?.());
    } else {
      localStorage.setItem(`skycast_${key}`, value);
      callback?.();
    }
  },
};

// ── Entry point ───────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  Storage.get('apiKey', apiKey => {
    if (!apiKey) {
      showSetupOverlay();
      return;
    }
    initGeolocation(apiKey);
  });

  document.getElementById('setupSaveBtn')
    ?.addEventListener('click', handleSetupSave);
  document.getElementById('setupKeyInput')
    ?.addEventListener('keydown', e => { if (e.key === 'Enter') handleSetupSave(); });
});

// ── Setup overlay ─────────────────────────────────────────────────────────────

function showSetupOverlay(errorMessage = null) {
  const overlay = document.getElementById('setupOverlay');
  if (!overlay) return;
  overlay.hidden = false;
  if (errorMessage) {
    const errEl = document.getElementById('setupError');
    if (errEl) {
      errEl.textContent = errorMessage;
      errEl.hidden = false;
    }
  }
}

function handleSetupSave() {
  const key = document.getElementById('setupKeyInput')?.value.trim();
  if (!key) return;
  Storage.set('apiKey', key, () => {
    document.getElementById('setupOverlay').hidden = true;
    initGeolocation(key);
  });
}

// ── Geolocation ───────────────────────────────────────────────────────────────

function initGeolocation(apiKey) {
  if (!('geolocation' in navigator)) {
    displayError('Geolocation not available');
    return;
  }
  navigator.geolocation.getCurrentPosition(
    position => fetchAllWeatherData(position, apiKey),
    handleGeoError,
    {
      enableHighAccuracy: false,
      timeout:            CONFIG.GEO_TIMEOUT_MS,
      maximumAge:         CONFIG.GEO_MAX_AGE_MS,
    }
  );
}

// ── API fetching ──────────────────────────────────────────────────────────────

async function fetchJSON(url) {
  const response = await fetch(url);
  if (!response.ok) {
    const err = new Error(`HTTP ${response.status}`);
    err.status = response.status;
    throw err;
  }
  return response.json();
}

async function fetchAllWeatherData(position, apiKey) {
  const { latitude: lat, longitude: lon } = position.coords;
  const base   = 'https://api.openweathermap.org/data/2.5';
  const params = `lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`;

  const [weatherRes, forecastRes, aqiRes, uvRes] = await Promise.allSettled([
    fetchJSON(`${base}/weather?${params}`),
    fetchJSON(`${base}/forecast?${params}`),
    fetchJSON(`${base}/air_pollution?${params}`),
    fetchJSON(`${base}/uvi?${params}`),
  ]);

  if (weatherRes.status === 'rejected') {
    if (weatherRes.reason?.status === 401) {
      showSetupOverlay('Invalid API key — please update it.');
    } else {
      displayError('Failed to load weather');
    }
    return;
  }

  updateWeatherDisplay(weatherRes.value);
  if (forecastRes.status === 'fulfilled') {
    updateHourlyStrip(forecastRes.value);
    updateForecastRow(forecastRes.value);
  }
  if (aqiRes.status === 'fulfilled') updateAQI(aqiRes.value);
  if (uvRes.status === 'fulfilled')  updateUV(uvRes.value);
}

// ── Main weather display ──────────────────────────────────────────────────────

function updateWeatherDisplay(data) {
  const temp        = Math.round(data.main.temp);
  const feelsLike   = Math.round(data.main.feels_like);
  const humidity    = data.main.humidity;
  const windSpeed   = Math.round((data.wind?.speed ?? 0) * CONFIG.MS_TO_KMH);
  const windDir     = getWindDirection(data.wind?.deg ?? 0);
  const weatherMain = data.weather[0].main.toLowerCase();
  const hour        = new Date().getHours();
  const isNight     = hour >= CONFIG.NIGHT_START_HOUR || hour < CONFIG.NIGHT_END_HOUR;

  const container = document.getElementById('weatherContainer');
  const condition = determineWeatherCondition(data, isNight);
  const cfg       = WEATHER_CONFIG[condition];

  container.className = `container ${cfg.bgClass}`;
  if (condition === 'sunny') container.classList.add('sunny-theme');

  setText('cityName',      (data.name ?? '').toUpperCase());
  setText('weatherMessage', getWeatherMessage(temp, weatherMain, isNight));
  setText('temperature',   `${temp}°C`);
  setText('humidity',      `Humidity ${humidity}%`);
  setText('wind',          `Wind ${windSpeed}km/h ${windDir}`);

  const feelsLikeEl = document.getElementById('feelsLike');
  if (feelsLikeEl) {
    if (Math.abs(temp - feelsLike) >= CONFIG.FEELS_LIKE_THRESHOLD_C) {
      feelsLikeEl.textContent   = `Feels ${feelsLike}°C`;
      feelsLikeEl.style.display = 'block';
    } else {
      feelsLikeEl.style.display = 'none';
    }
  }

  const sunTimesEl = document.getElementById('sunTimes');
  if (sunTimesEl && data.sys?.sunrise && data.sys?.sunset) {
    sunTimesEl.textContent = `↑ ${formatTime(data.sys.sunrise)}  ↓ ${formatTime(data.sys.sunset)}`;
  }

}

function updateAQI(data) {
  const pm25 = Math.round(data.list?.[0]?.components?.pm2_5 ?? 0);
  setText('aqi', `AQI ${pm25}`);
}

function updateUV(data) {
  const uvi = Math.round(data.value ?? 0);
  setText('uvIndex', `UV ${uvi} (${getUVLabel(uvi)})`);
}

// ── Hourly strip ──────────────────────────────────────────────────────────────

function buildHourlySlot(slot) {
  const d    = new Date(slot.dt * 1000);
  const h    = d.getHours();
  const time = `${h % 12 || 12}${h >= 12 ? 'PM' : 'AM'}`;
  const temp = Math.round(slot.main.temp);
  const cond = getConditionLabel(slot.weather[0].main);
  return createElement('div', 'hourly-slot', [
    createElement('span', 'hour-time',  time),
    createElement('span', 'hour-label', cond),
    createElement('span', 'hour-temp',  `${temp}°`),
  ]);
}

function updateHourlyStrip(data) {
  const strip = document.getElementById('hourlyStrip');
  if (!strip) return;
  strip.replaceChildren(
    ...data.list.slice(0, CONFIG.FORECAST_HOURLY_SLOTS).map(buildHourlySlot)
  );
}

// ── 3-day forecast row ────────────────────────────────────────────────────────

function buildForecastDay(day, dayName) {
  const high  = Math.round(Math.max(...day.highs));
  const low   = Math.round(Math.min(...day.lows));
  const label = getConditionLabel(getMostCommonCondition(day.conditions));
  return createElement('div', 'forecast-day', [
    createElement('span', 'day-name',  dayName),
    createElement('span', 'day-label', label),
    createElement('span', 'day-range', `${high}°/${low}°`),
  ]);
}

function updateForecastRow(data) {
  const row = document.getElementById('forecastRow');
  if (!row) return;

  const todayStr = new Date().toDateString();
  const DAY_NAMES = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const dayMap = {};

  data.list.forEach(item => {
    const d   = new Date(item.dt * 1000);
    const key = d.toDateString();
    if (key === todayStr) return;
    if (!dayMap[key]) dayMap[key] = { highs: [], lows: [], conditions: [], date: d };
    dayMap[key].highs.push(item.main.temp_max);
    dayMap[key].lows.push(item.main.temp_min);
    dayMap[key].conditions.push(item.weather[0].main);
  });

  const days = Object.values(dayMap).slice(0, CONFIG.FORECAST_DAY_COUNT);
  row.replaceChildren(
    ...days.map(day => buildForecastDay(day, DAY_NAMES[day.date.getDay()]))
  );
}

// ── Error handling ────────────────────────────────────────────────────────────

function handleGeoError(error) {
  if (!error) { displayError('Location unavailable'); return; }
  switch (error.code) {
    case error.PERMISSION_DENIED:
      setText('weatherMessage', 'Location access denied');
      break;
    case error.POSITION_UNAVAILABLE:
      setText('weatherMessage', 'Location unavailable — run via localhost');
      break;
    case error.TIMEOUT:
      setText('weatherMessage', 'Location timed out');
      break;
    default:
      setText('weatherMessage', 'Location error');
  }
  addRetryButton();
}

function addRetryButton() {
  if (document.getElementById('locationRetryBtn')) return;
  const btn = document.createElement('button');
  btn.id        = 'locationRetryBtn';
  btn.className = 'retry-btn';
  btn.textContent = 'Retry';
  btn.addEventListener('click', () => setTimeout(() => window.location.reload(), 300));
  document.body.appendChild(btn);
}

function displayError(message) {
  setText('weatherMessage', message);
}

// ── DOM utilities ─────────────────────────────────────────────────────────────

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function createElement(tag, className, content) {
  const el = document.createElement(tag);
  el.className = className;
  if (typeof content === 'string') {
    el.textContent = content;
  } else if (Array.isArray(content)) {
    el.append(...content);
  }
  return el;
}

// ── Public refresh ────────────────────────────────────────────────────────────

window.refreshWeather = function () {
  Storage.get('apiKey', apiKey => {
    if (apiKey && 'geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        pos => fetchAllWeatherData(pos, apiKey),
        handleGeoError
      );
    }
  });
};
