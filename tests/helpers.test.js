const {
  getWindDirection,
  getUVLabel,
  getConditionLabel,
  getMostCommonCondition,
  formatTime,
  determineWeatherCondition,
  getWeatherMessage,
} = require('../helpers');

// ── getWindDirection ──────────────────────────────────────────────────────────

describe('getWindDirection', () => {
  test('0 degrees = N', () => expect(getWindDirection(0)).toBe('N'));
  test('45 degrees = NE', () => expect(getWindDirection(45)).toBe('NE'));
  test('90 degrees = E', () => expect(getWindDirection(90)).toBe('E'));
  test('135 degrees = SE', () => expect(getWindDirection(135)).toBe('SE'));
  test('180 degrees = S', () => expect(getWindDirection(180)).toBe('S'));
  test('225 degrees = SW', () => expect(getWindDirection(225)).toBe('SW'));
  test('270 degrees = W', () => expect(getWindDirection(270)).toBe('W'));
  test('315 degrees = NW', () => expect(getWindDirection(315)).toBe('NW'));
  test('360 degrees wraps to N', () => expect(getWindDirection(360)).toBe('N'));
  test('22 degrees rounds to N', () => expect(getWindDirection(22)).toBe('N'));
  test('23 degrees rounds to NE', () => expect(getWindDirection(23)).toBe('NE'));
});

// ── getUVLabel ────────────────────────────────────────────────────────────────

describe('getUVLabel', () => {
  test('0 = LOW',  () => expect(getUVLabel(0)).toBe('LOW'));
  test('2 = LOW',  () => expect(getUVLabel(2)).toBe('LOW'));
  test('3 = MOD',  () => expect(getUVLabel(3)).toBe('MOD'));
  test('5 = MOD',  () => expect(getUVLabel(5)).toBe('MOD'));
  test('6 = HIGH', () => expect(getUVLabel(6)).toBe('HIGH'));
  test('7 = HIGH', () => expect(getUVLabel(7)).toBe('HIGH'));
  test('8 = V.HI', () => expect(getUVLabel(8)).toBe('V.HI'));
  test('10 = V.HI',() => expect(getUVLabel(10)).toBe('V.HI'));
  test('11 = EXT', () => expect(getUVLabel(11)).toBe('EXT'));
});

// ── getConditionLabel ─────────────────────────────────────────────────────────

describe('getConditionLabel', () => {
  test('Thunderstorm = STRM', () => expect(getConditionLabel('Thunderstorm')).toBe('STRM'));
  test('Rain = RAIN',         () => expect(getConditionLabel('Rain')).toBe('RAIN'));
  test('Drizzle = RAIN',      () => expect(getConditionLabel('Drizzle')).toBe('RAIN'));
  test('Snow = SNOW',         () => expect(getConditionLabel('Snow')).toBe('SNOW'));
  test('Clouds = CLD',        () => expect(getConditionLabel('Clouds')).toBe('CLD'));
  test('Clear = CLR',         () => expect(getConditionLabel('Clear')).toBe('CLR'));
  test('Mist = MIST',         () => expect(getConditionLabel('Mist')).toBe('MIST'));
  test('Fog = MIST',          () => expect(getConditionLabel('Fog')).toBe('MIST'));
  test('Haze = VAR',          () => expect(getConditionLabel('Haze')).toBe('VAR'));
  test('case-insensitive',    () => expect(getConditionLabel('RAIN')).toBe('RAIN'));
});

// ── getMostCommonCondition ────────────────────────────────────────────────────

describe('getMostCommonCondition', () => {
  test('single item returns that item', () =>
    expect(getMostCommonCondition(['Rain'])).toBe('Rain'));

  test('majority wins', () =>
    expect(getMostCommonCondition(['Rain', 'Rain', 'Clear'])).toBe('Rain'));

  test('tie returns first alphabetically in counts order', () =>
    expect(['Rain', 'Clear']).toContain(getMostCommonCondition(['Rain', 'Clear'])));

  test('empty array returns Clear fallback', () =>
    expect(getMostCommonCondition([])).toBe('Clear'));
});

// ── formatTime ────────────────────────────────────────────────────────────────

describe('formatTime', () => {
  test('midnight formats as 12:00AM', () => {
    const d = new Date('2024-01-01T00:00:00');
    expect(formatTime(d.getTime() / 1000)).toBe('12:00AM');
  });

  test('noon formats as 12:00PM', () => {
    const d = new Date('2024-01-01T12:00:00');
    expect(formatTime(d.getTime() / 1000)).toBe('12:00PM');
  });

  test('6:32 AM formats correctly', () => {
    const d = new Date('2024-01-01T06:32:00');
    expect(formatTime(d.getTime() / 1000)).toBe('6:32AM');
  });

  test('minutes are zero-padded', () => {
    const d = new Date('2024-01-01T14:05:00');
    expect(formatTime(d.getTime() / 1000)).toBe('2:05PM');
  });
});

// ── determineWeatherCondition ─────────────────────────────────────────────────

const makeData = (temp, mainCondition) => ({
  main: { temp },
  weather: [{ main: mainCondition }],
});

describe('determineWeatherCondition', () => {
  test('Rain → rainy regardless of temperature', () =>
    expect(determineWeatherCondition(makeData(20, 'Rain'), false)).toBe('rainy'));

  test('Thunderstorm → rainy', () =>
    expect(determineWeatherCondition(makeData(22, 'Thunderstorm'), false)).toBe('rainy'));

  test('temp < 15 and clear → cold', () =>
    expect(determineWeatherCondition(makeData(10, 'Clear'), false)).toBe('cold'));

  test('night with warm clear sky → night', () =>
    expect(determineWeatherCondition(makeData(20, 'Clear'), true)).toBe('night'));

  test('Clouds at 20°C daytime → cloudy', () =>
    expect(determineWeatherCondition(makeData(20, 'Clouds'), false)).toBe('cloudy'));

  test('Clear at 22°C daytime → sunny', () =>
    expect(determineWeatherCondition(makeData(22, 'Clear'), false)).toBe('sunny'));
});

// ── getWeatherMessage ─────────────────────────────────────────────────────────

describe('getWeatherMessage', () => {
  test('cold night', () =>
    expect(getWeatherMessage(10, 'clear', true)).toBe('Cold night out there...'));

  test('warm night', () =>
    expect(getWeatherMessage(20, 'clear', true)).toBe('Lovely night...'));

  test('thunderstorm', () =>
    expect(getWeatherMessage(18, 'thunderstorm', false)).toBe('Storm incoming!'));

  test('cold rain', () =>
    expect(getWeatherMessage(10, 'rain', false)).toBe('Cold and raining...'));

  test('warm rain', () =>
    expect(getWeatherMessage(20, 'rain', false)).toBe("It's raining today!"));

  test('hot day > 28', () =>
    expect(getWeatherMessage(30, 'clear', false)).toBe('Hot one today!'));

  test('nice day', () =>
    expect(getWeatherMessage(22, 'clear', false)).toBe('Nice day out there!'));
});
