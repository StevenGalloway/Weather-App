/**
 * SKYCAST — helpers.js
 * Pure helper functions with no DOM or browser API dependencies.
 * Separated so they can be imported by Jest tests without a browser context.
 */

const WEATHER_CONFIG = Object.freeze({
  cold:   { frames: 7, animationPath: 'Animations/cold/Frame',    bgClass: 'cold-bg'   },
  cloudy: { frames: 6, animationPath: 'Animations/cloudy/Cloudy', bgClass: 'cloudy-bg' },
  rainy:  { frames: 4, animationPath: 'Animations/rainy/rain',    bgClass: 'rainy-bg'  },
  sunny:  { frames: 6, animationPath: 'Animations/sunny/fun',     bgClass: 'sunny-bg'  },
  night:  { frames: 6, animationPath: 'Animations/sunny/fun',     bgClass: 'night-bg'  },
});

/**
 * Determine a display weather condition key from API data.
 * @param {object} data   - OpenWeatherMap /weather response
 * @param {boolean} isNight
 * @returns {'cold'|'rainy'|'night'|'cloudy'|'sunny'}
 */
function determineWeatherCondition(data, isNight) {
  const temp = data.main.temp;
  const main = data.weather[0].main.toLowerCase();
  if (main.includes('thunder') || main.includes('rain')) return 'rainy';
  if (temp < 15)                                          return 'cold';
  if (isNight)                                            return 'night';
  if (main.includes('drizzle') || main.includes('cloud')) return 'cloudy';
  return 'sunny';
}

/**
 * Return a human-readable weather status message.
 * @param {number}  temp
 * @param {string}  weatherMain - lowercased main condition string
 * @param {boolean} isNight
 */
function getWeatherMessage(temp, weatherMain, isNight) {
  if (isNight)                         return temp < 15 ? 'Cold night out there...' : 'Lovely night...';
  if (weatherMain.includes('thunder')) return 'Storm incoming!';
  if (weatherMain.includes('rain'))    return temp < 15 ? 'Cold and raining...' : "It's raining today!";
  if (weatherMain.includes('cloud'))   return temp < 15 ? 'Cold and cloudy...' : 'Cloudy skies today...';
  if (temp < 15)                       return "Bundle up, it's cold!";
  if (temp > 28)                       return 'Hot one today!';
  return 'Nice day out there!';
}

/**
 * Return the most frequently occurring string in an array.
 * @param {string[]} conditions
 * @returns {string}
 */
function getMostCommonCondition(conditions) {
  if (!conditions.length) return 'Clear';
  const counts = {};
  conditions.forEach(c => { counts[c] = (counts[c] || 0) + 1; });
  return Object.keys(counts).reduce((a, b) => counts[a] >= counts[b] ? a : b);
}

/**
 * Map an OpenWeatherMap main condition string to a short display label.
 * @param {string} main
 * @returns {string}
 */
function getConditionLabel(main) {
  const m = main.toLowerCase();
  if (m.includes('thunder'))                        return 'STRM';
  if (m.includes('rain') || m.includes('drizzle'))  return 'RAIN';
  if (m.includes('snow'))                           return 'SNOW';
  if (m.includes('cloud'))                          return 'CLD';
  if (m.includes('clear'))                          return 'CLR';
  if (m.includes('mist') || m.includes('fog'))      return 'MIST';
  return 'VAR';
}

/**
 * Map a UV index value to a risk label.
 * @param {number} uvi
 * @returns {string}
 */
function getUVLabel(uvi) {
  if (uvi <= 2)  return 'LOW';
  if (uvi <= 5)  return 'MOD';
  if (uvi <= 7)  return 'HIGH';
  if (uvi <= 10) return 'V.HI';
  return 'EXT';
}

/**
 * Convert wind degrees to an 8-point compass direction.
 * @param {number} deg - 0–360
 * @returns {string}
 */
function getWindDirection(deg) {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return dirs[Math.round(deg / 45) % 8];
}

/**
 * Format a Unix timestamp as a 12-hour clock string (e.g. "6:32AM").
 * @param {number} unix - seconds since epoch
 * @returns {string}
 */
function formatTime(unix) {
  const d    = new Date(unix * 1000);
  const h    = d.getHours();
  const m    = d.getMinutes().toString().padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${m}${ampm}`;
}

// Node.js / Jest compatibility — no-op in browser context
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    WEATHER_CONFIG,
    determineWeatherCondition,
    getWeatherMessage,
    getMostCommonCondition,
    getConditionLabel,
    getUVLabel,
    getWindDirection,
    formatTime,
  };
}
