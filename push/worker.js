/* خادم إشعارات ومض آرك — فَلَق وسهم وخُطى. ملف واحد جاهز للصق في Cloudflare. */
/* فَلَق | FALAQ — محرك الحسابات الفلكية (بدون إنترنت)
   مواقيت الصلاة، الشمس، القمر، القبلة، المنازل، التقويم الهجري */
(function (root) {
  'use strict';
  const PI = Math.PI, rad = PI / 180, deg = 180 / PI;
  const dsin = d => Math.sin(d * rad), dcos = d => Math.cos(d * rad), dtan = d => Math.tan(d * rad);
  const dasin = x => Math.asin(x) * deg, dacos = x => Math.acos(x) * deg;
  const datan2 = (y, x) => Math.atan2(y, x) * deg, dacot = x => Math.atan(1 / x) * deg;
  const fix = (a, b) => { a = a - b * Math.floor(a / b); return a < 0 ? a + b : a; };
  const fixAngle = a => fix(a, 360), fixHour = h => fix(h, 24);
  const DAY = 864e5;

  const KAABA = { lat: 21.422487, lng: 39.826206 };

  /* ---------- طرق الحساب ---------- */
  const METHODS = {
    umm_alqura: { name: 'أم القرى — السعودية', fajr: 18.5, isha: { min: 90 }, ramadanIsha: 120 },
    mwl:        { name: 'رابطة العالم الإسلامي', fajr: 18, isha: 17 },
    egypt:      { name: 'الهيئة المصرية العامة للمساحة', fajr: 19.5, isha: 17.5 },
    gulf:       { name: 'منطقة الخليج', fajr: 19.5, isha: { min: 90 } },
    kuwait:     { name: 'الكويت', fajr: 18, isha: 17.5 },
    qatar:      { name: 'قطر', fajr: 18, isha: { min: 90 } },
    dubai:      { name: 'الإمارات', fajr: 18.2, isha: 18.2 },
    turkey:     { name: 'تركيا — رئاسة الشؤون الدينية', fajr: 18, isha: 17, adj: { sunrise: -7, dhuhr: 5, asr: 4, maghrib: 7 } },
    karachi:    { name: 'جامعة العلوم الإسلامية — كراتشي', fajr: 18, isha: 18 },
    isna:       { name: 'أمريكا الشمالية (ISNA)', fajr: 15, isha: 15 }
  };

  function julian(y, m, d) {
    if (m <= 2) { y -= 1; m += 12; }
    const A = Math.floor(y / 100), B = 2 - A + Math.floor(A / 4);
    return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + B - 1524.5;
  }

  function sunPosition(jd) {
    const D = jd - 2451545.0;
    const g = fixAngle(357.529 + 0.98560028 * D);
    const q = fixAngle(280.459 + 0.98564736 * D);
    const L = fixAngle(q + 1.915 * dsin(g) + 0.020 * dsin(2 * g));
    const e = 23.439 - 0.00000036 * D;
    const RA = datan2(dcos(e) * dsin(L), dcos(L)) / 15;
    const eqt = q / 15 - fixHour(RA);
    const decl = dasin(dsin(e) * dsin(L));
    return { declination: decl, equation: eqt };
  }

  /* مواقيت الصلاة ليوم (y,m,d) — تُرجع كائنات Date حقيقية (لحظات مطلقة) */
  function prayerTimes(y, m, d, lat, lng, opt) {
    opt = opt || {};
    const method = METHODS[opt.method] || METHODS.umm_alqura;
    const asrFactor = opt.asr === 2 ? 2 : 1;
    const jDate = julian(y, m, d) - lng / (15 * 24);

    const midDay = t => fixHour(12 - sunPosition(jDate + t).equation);
    const sunAngleTime = (angle, t, ccw) => {
      const decl = sunPosition(jDate + t).declination;
      const noon = midDay(t);
      const T = dacos((-dsin(angle) - dsin(decl) * dsin(lat)) / (dcos(decl) * dcos(lat))) / 15;
      return noon + (ccw ? -T : T);
    };
    const asrTime = (factor, t) => {
      const decl = sunPosition(jDate + t).declination;
      const angle = -dacot(factor + dtan(Math.abs(lat - decl)));
      return sunAngleTime(angle, t);
    };

    let T = { fajr: 5, sunrise: 6, dhuhr: 12, asr: 13, sunset: 18, isha: 18 };
    const ishaAngle = typeof method.isha === 'number';
    for (let i = 0; i < 2; i++) {
      T = {
        fajr: sunAngleTime(method.fajr, T.fajr / 24, true),
        sunrise: sunAngleTime(0.833, T.sunrise / 24, true),
        dhuhr: midDay(T.dhuhr / 24),
        asr: asrTime(asrFactor, T.asr / 24),
        sunset: sunAngleTime(0.833, T.sunset / 24),
        isha: ishaAngle ? sunAngleTime(method.isha, T.isha / 24) : T.sunset
      };
    }
    // إلى توقيت UTC
    for (const k in T) T[k] += -lng / 15;

    // العروض العالية: الطريقة الزاوية
    const night = fixHour(T.sunrise - T.sunset);
    const portion = a => a / 60 * night;
    if (isNaN(T.fajr) || fixHour(T.sunrise - T.fajr) > portion(method.fajr)) T.fajr = T.sunrise - portion(method.fajr);
    if (ishaAngle && (isNaN(T.isha) || fixHour(T.isha - T.sunset) > portion(method.isha))) T.isha = T.sunset + portion(method.isha);
    if (!ishaAngle) {
      const mins = (opt.ramadan && method.ramadanIsha) ? method.ramadanIsha : method.isha.min;
      T.isha = T.sunset + mins / 60;
    }
    T.maghrib = T.sunset;

    const adj = Object.assign({}, method.adj || {});
    const user = opt.adjust || {};
    const base = Date.UTC(y, m - 1, d);
    const out = {};
    ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'].forEach(k => {
      const mins = T[k] * 60 + (adj[k] || 0) + (user[k] || 0);
      // تقريب لأقرب دقيقة
      out[k] = isNaN(mins) ? null : new Date(base + Math.round(mins) * 6e4);
    });
    out.solarNoon = new Date(base + T.dhuhr * 36e5);
    out.sunsetExact = new Date(base + T.sunset * 36e5);
    return out;
  }

  /* ---------- الشمس والقمر (موقع لحظي) ---------- */
  const J1970 = 2440588, J2000 = 2451545, OBL = rad * 23.4397;
  const toJulian = date => date.valueOf() / DAY - 0.5 + J1970;
  const fromJulian = j => new Date((j + 0.5 - J1970) * DAY);
  const toDays = date => toJulian(date) - J2000;
  const raOf = (l, b) => Math.atan2(Math.sin(l) * Math.cos(OBL) - Math.tan(b) * Math.sin(OBL), Math.cos(l));
  const decOf = (l, b) => Math.asin(Math.sin(b) * Math.cos(OBL) + Math.cos(b) * Math.sin(OBL) * Math.sin(l));
  const azimuthRaw = (H, phi, dec) => Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(phi) - Math.tan(dec) * Math.cos(phi));
  const altitudeRaw = (H, phi, dec) => Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H));
  const sidereal = (d, lw) => rad * (280.16 + 360.9856235 * d) - lw;
  const refraction = h => { if (h < 0) h = 0; return 0.0002967 / Math.tan(h + 0.00312536 / (h + 0.08901179)); };

  function sunCoords(d) {
    const M = rad * (357.5291 + 0.98560028 * d);
    const C = rad * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M));
    const L = M + C + rad * 102.9372 + PI;
    return { dec: decOf(L, 0), ra: raOf(L, 0), lon: L };
  }

  function moonCoords(d) {
    const Lp = rad * (218.3165 + 13.17639648 * d);
    const D = rad * (297.8502 + 12.19074912 * d);
    const M = rad * (134.9634 + 13.06499295 * d);
    const F = rad * (93.2721 + 13.22935024 * d);
    const Ms = rad * (357.5291 + 0.98560028 * d);
    const s = Math.sin, c = Math.cos;
    const l = Lp + rad * (6.289 * s(M) + 1.274 * s(2 * D - M) + 0.658 * s(2 * D) + 0.214 * s(2 * M)
      - 0.186 * s(Ms) - 0.059 * s(2 * D - 2 * M) - 0.057 * s(2 * D - M - Ms) + 0.053 * s(2 * D + M)
      + 0.046 * s(2 * D - Ms) + 0.041 * s(M - Ms) - 0.035 * s(D) - 0.031 * s(M + Ms)
      - 0.015 * s(2 * F - 2 * D) + 0.011 * s(M - 4 * D));
    const b = rad * (5.128 * s(F) + 0.281 * s(M + F) + 0.278 * s(M - F) + 0.173 * s(2 * D - F)
      + 0.055 * s(2 * D - M + F) + 0.046 * s(2 * D - M - F) + 0.033 * s(2 * D + F) + 0.017 * s(2 * M + F));
    const dist = 385001 - 20905 * c(M) - 3699 * c(2 * D - M) - 2956 * c(2 * D) - 570 * c(2 * M)
      + 246 * c(2 * M - 2 * D) - 205 * c(Ms - 2 * D) - 171 * c(M + 2 * D) - 152 * c(M + Ms - 2 * D);
    return { ra: raOf(l, b), dec: decOf(l, b), dist, lon: l, lat: b };
  }

  // الزوايا بالدرجات، السمت من الشمال باتجاه عقارب الساعة
  function sunPos(date, lat, lng) {
    const lw = rad * -lng, phi = rad * lat, d = toDays(date), c = sunCoords(d);
    const H = sidereal(d, lw) - c.ra;
    return { azimuth: fixAngle(azimuthRaw(H, phi, c.dec) * deg + 180), altitude: altitudeRaw(H, phi, c.dec) * deg };
  }

  function moonPos(date, lat, lng) {
    const lw = rad * -lng, phi = rad * lat, d = toDays(date), c = moonCoords(d);
    const H = sidereal(d, lw) - c.ra;
    let h = altitudeRaw(H, phi, c.dec);
    const pa = Math.atan2(Math.sin(H), Math.tan(phi) * Math.cos(c.dec) - Math.sin(c.dec) * Math.cos(H));
    h += refraction(h);
    return { azimuth: fixAngle(azimuthRaw(H, phi, c.dec) * deg + 180), altitude: h * deg, distance: c.dist, parallacticAngle: pa };
  }

  function moonIllumination(date) {
    const d = toDays(date), s = sunCoords(d), m = moonCoords(d), sdist = 149598000;
    const phi = Math.acos(Math.sin(s.dec) * Math.sin(m.dec) + Math.cos(s.dec) * Math.cos(m.dec) * Math.cos(s.ra - m.ra));
    const inc = Math.atan2(sdist * Math.sin(phi), m.dist - sdist * Math.cos(phi));
    const angle = Math.atan2(Math.cos(s.dec) * Math.sin(s.ra - m.ra),
      Math.sin(s.dec) * Math.cos(m.dec) - Math.cos(s.dec) * Math.sin(m.dec) * Math.cos(s.ra - m.ra));
    const elong = fixAngle((m.lon - s.lon) * deg); // 0 = محاق، 180 = بدر
    return { fraction: (1 + Math.cos(inc)) / 2, elongation: elong, waxing: elong < 180, brightLimbAngle: angle };
  }

  // أوقات شروق وغروب القمر في نافذة 24 ساعة تبدأ من start
  function moonTimes(start, lat, lng) {
    const hc = 0.133 * rad;
    const alt = t => moonPos(new Date(start.valueOf() + t * 36e5), lat, lng).altitude * rad - hc;
    let h0 = alt(0), rise = null, set = null, ye = 0;
    for (let i = 1; i <= 24; i += 2) {
      const h1 = alt(i), h2 = alt(i + 1);
      const a = (h0 + h2) / 2 - h1, b = (h2 - h0) / 2, xe = -b / (2 * a);
      ye = (a * xe + b) * xe + h1;
      const dd = b * b - 4 * a * h1;
      let roots = 0, x1 = 0, x2 = 0;
      if (dd >= 0) {
        const dx = Math.sqrt(dd) / (Math.abs(a) * 2);
        x1 = xe - dx; x2 = xe + dx;
        if (Math.abs(x1) <= 1) roots++;
        if (Math.abs(x2) <= 1) roots++;
        if (x1 < -1) x1 = x2;
      }
      if (roots === 1) { if (h0 < 0) rise = i + x1; else set = i + x1; }
      else if (roots === 2) { rise = i + (ye < 0 ? x2 : x1); set = i + (ye < 0 ? x1 : x2); }
      if (rise !== null && set !== null) break;
      h0 = h2;
    }
    const at = h => h === null ? null : new Date(start.valueOf() + h * 36e5);
    return { rise: at(rise), set: at(set), alwaysUp: rise === null && set === null && ye > 0, alwaysDown: rise === null && set === null && ye <= 0 };
  }

  /* ---------- أطوار القمر (ميوس، الفصل 49) ---------- */
  function phaseJDE(k, type) { // type: 0 محاق، 1 تربيع أول، 2 بدر، 3 تربيع ثاني
    k = k + type / 4;
    const T = k / 1236.85;
    let jde = 2451550.09766 + 29.530588861 * k + 0.00015437 * T * T - 0.00000015 * T * T * T;
    const E = 1 - 0.002516 * T - 0.0000074 * T * T;
    const M = rad * fixAngle(2.5534 + 29.1053567 * k - 0.0000014 * T * T);
    const Mp = rad * fixAngle(201.5643 + 385.81693528 * k + 0.0107582 * T * T);
    const F = rad * fixAngle(160.7108 + 390.67050284 * k - 0.0016118 * T * T);
    const Om = rad * fixAngle(124.7746 - 1.56375588 * k + 0.0020672 * T * T);
    const s = Math.sin, c = Math.cos;
    let corr;
    if (type === 0) {
      corr = -0.40720 * s(Mp) + 0.17241 * E * s(M) + 0.01608 * s(2 * Mp) + 0.01039 * s(2 * F) + 0.00739 * E * s(Mp - M)
        - 0.00514 * E * s(Mp + M) + 0.00208 * E * E * s(2 * M) - 0.00111 * s(Mp - 2 * F) - 0.00057 * s(Mp + 2 * F)
        + 0.00056 * E * s(2 * Mp + M) - 0.00042 * s(3 * Mp) + 0.00042 * E * s(M + 2 * F) + 0.00038 * E * s(M - 2 * F)
        - 0.00024 * E * s(2 * Mp - M) - 0.00017 * s(Om) - 0.00007 * s(Mp + 2 * M) + 0.00004 * s(2 * Mp - 2 * F) + 0.00004 * s(3 * M);
    } else if (type === 2) {
      corr = -0.40614 * s(Mp) + 0.17302 * E * s(M) + 0.01614 * s(2 * Mp) + 0.01043 * s(2 * F) + 0.00734 * E * s(Mp - M)
        - 0.00515 * E * s(Mp + M) + 0.00209 * E * E * s(2 * M) - 0.00111 * s(Mp - 2 * F) - 0.00057 * s(Mp + 2 * F)
        + 0.00056 * E * s(2 * Mp + M) - 0.00042 * s(3 * Mp) + 0.00042 * E * s(M + 2 * F) + 0.00038 * E * s(M - 2 * F)
        - 0.00024 * E * s(2 * Mp - M) - 0.00017 * s(Om) - 0.00007 * s(Mp + 2 * M) + 0.00004 * s(2 * Mp - 2 * F) + 0.00004 * s(3 * M);
    } else {
      corr = -0.62801 * s(Mp) + 0.17172 * E * s(M) - 0.01183 * E * s(Mp + M) + 0.00862 * s(2 * Mp) + 0.00804 * s(2 * F)
        + 0.00454 * E * s(Mp - M) + 0.00204 * E * E * s(2 * M) - 0.00180 * s(Mp - 2 * F) - 0.00070 * s(Mp + 2 * F)
        - 0.00040 * s(3 * Mp) - 0.00034 * E * s(2 * Mp - M) + 0.00032 * E * s(M + 2 * F) + 0.00032 * E * s(M - 2 * F)
        - 0.00028 * E * E * s(Mp + 2 * M) + 0.00027 * E * s(2 * Mp + M) - 0.00017 * s(Om);
      const W = 0.00306 - 0.00038 * E * c(M) + 0.00026 * c(Mp) - 0.00002 * c(Mp - M) + 0.00002 * c(Mp + M) + 0.00002 * c(2 * F);
      corr += type === 1 ? W : -W;
    }
    jde += corr;
    const dT = 70 / 86400; // فرق التوقيت الديناميكي التقريبي
    return fromJulian(jde - dT);
  }

  // أقرب الأطوار حول تاريخ معين
  function moonPhases(date) {
    const yearFrac = date.getUTCFullYear() + (date - Date.UTC(date.getUTCFullYear(), 0, 1)) / (365.25 * DAY);
    let k = Math.floor((yearFrac - 2000) * 12.3685) - 2;
    const list = [];
    for (let i = 0; i < 6; i++, k++) for (let t = 0; t < 4; t++) list.push({ type: t, date: phaseJDE(k, t) });
    list.sort((a, b) => a.date - b.date);
    const next = {};
    let lastNew = null;
    list.forEach(p => {
      if (p.date <= date) { if (p.type === 0) lastNew = p.date; }
      else if (!next[p.type]) next[p.type] = p.date;
    });
    return { lastNew, nextNew: next[0], nextFirst: next[1], nextFull: next[2], nextLast: next[3] };
  }

  /* ---------- القبلة ---------- */
  function qibla(lat, lng) {
    const p1 = lat * rad, p2 = KAABA.lat * rad, dl = (KAABA.lng - lng) * rad;
    const brg = fixAngle(Math.atan2(Math.sin(dl), Math.cos(p1) * Math.tan(p2) - Math.sin(p1) * Math.cos(dl)) * deg);
    return { bearing: brg, distance: distanceKm(lat, lng, KAABA.lat, KAABA.lng) };
  }
  function distanceKm(a1, o1, a2, o2) {
    const R = 6371.0088, p1 = a1 * rad, p2 = a2 * rad, dp = (a2 - a1) * rad, dl = (o2 - o1) * rad;
    const h = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
  }

  // أوقات اليوم التي تكون فيها الشمس باتجاه القبلة (أو ظلّ الشيء باتجاهها)
  function sunQiblaTimes(sunrise, sunset, lat, lng, bearing) {
    const res = { toward: null, shadow: null };
    if (!sunrise || !sunset) return res;
    const diff = (a, b) => ((a - b + 540) % 360) - 180;
    let prevT = sunrise.valueOf(), prevA = diff(sunPos(sunrise, lat, lng).azimuth, bearing), prevB = diff(sunPos(sunrise, lat, lng).azimuth, bearing + 180);
    for (let t = prevT + 6e4; t <= sunset.valueOf(); t += 6e4) {
      const az = sunPos(new Date(t), lat, lng).azimuth;
      const a = diff(az, bearing), b = diff(az, bearing + 180);
      if (!res.toward && prevA * a <= 0 && Math.abs(a - prevA) < 90) res.toward = new Date(t);
      if (!res.shadow && prevB * b <= 0 && Math.abs(b - prevB) < 90) res.shadow = new Date(t);
      prevA = a; prevB = b;
    }
    return res;
  }

  // تعامد الشمس على الكعبة (رصد القبلة) — التاريخان القادمان
  function kaabaTransits(fromDate) {
    const out = [];
    for (let yr = fromDate.getUTCFullYear(); yr <= fromDate.getUTCFullYear() + 1 && out.length < 2; yr++) {
      [[4, 1, 5, 20], [6, 1, 7, 15]].forEach(([m1, d1, m2, d2]) => {
        let best = null;
        for (let t = Date.UTC(yr, m1, d1); t <= Date.UTC(yr, m2, d2); t += DAY) {
          const dt = new Date(t);
          const pt = prayerTimes(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate(), KAABA.lat, KAABA.lng, {});
          const alt = sunPos(pt.solarNoon, KAABA.lat, KAABA.lng).altitude;
          if (!best || alt > best.alt) best = { alt, date: pt.solarNoon };
        }
        if (best && best.date > fromDate) out.push(best.date);
      });
    }
    return out.sort((a, b) => a - b).slice(0, 2);
  }

  /* ---------- المنازل والنجوم ---------- */
  const MANSIONS = ['الشرطين', 'البطين', 'الثريا', 'الدبران', 'الهقعة', 'الهنعة', 'الذراع', 'النثرة', 'الطرف', 'الجبهة',
    'الزبرة', 'الصرفة', 'العواء', 'السماك', 'الغفر', 'الزبانا', 'الإكليل', 'القلب', 'الشولة', 'النعائم', 'البلدة',
    'سعد الذابح', 'سعد بلع', 'سعد السعود', 'سعد الأخبية', 'المقدم', 'المؤخر', 'الرشا'];
  // بداية الشرطين مثبّتة على النجوم (متمركزة على نجومها) مع تصحيح المبادرة
  function mansionIndex(lonDeg, date) {
    const yrs = (date - Date.UTC(2000, 0, 1, 12)) / (365.25 * DAY);
    const start = 27.85 + yrs * 0.013969;
    return Math.floor(fixAngle(lonDeg - start) / (360 / 28));
  }
  function moonMansion(date) {
    const d = toDays(date);
    const m = moonCoords(d), s = sunCoords(d);
    return { moon: mansionIndex(m.lon * deg, date), sun: mansionIndex(s.lon * deg, date), moonLon: fixAngle(m.lon * deg), sunLon: fixAngle(s.lon * deg),
      startLon: fixAngle(27.85 + (date - Date.UTC(2000, 0, 1, 12)) / (365.25 * DAY) * 0.013969) };
  }

  // الحساب النجدي — بداية كل نجم (شهر، يوم)
  const STAR_STARTS = [[5, 12], [5, 25], [6, 7], [6, 20], [7, 3], [7, 16], [7, 29], [8, 11], [8, 24], [9, 6], [9, 20], [10, 3], [10, 16],
    [10, 29], [11, 11], [11, 24], [12, 7], [12, 20], [1, 2], [1, 15], [1, 28], [2, 10], [2, 23], [3, 8], [3, 21], [4, 3], [4, 16], [4, 29]];
  const SEASONS = [
    { name: 'الوسم', first: 12, n: 4, desc: 'بداية الأمطار الوسمية واعتدال الجو، وبعد مطره تظهر نباتات البر والفقع.' },
    { name: 'المربعانية', first: 16, n: 3, desc: 'أشد فترات البرد في نجد، يطول فيها الليل ويقصر النهار.' },
    { name: 'الشبط', first: 19, n: 2, desc: 'برد قارس جاف، وقد يتجمد الماء في الليالي الصافية.' },
    { name: 'العقارب', first: 21, n: 3, desc: 'يبدأ البرد بالانكسار مع تقلبات ورياح، ويسري الماء في عود الشجر.' },
    { name: 'الحميمين', first: 24, n: 2, desc: 'بداية الدفء، وتكثر فيه أمطار الربيع والرعد.' },
    { name: 'الذراعين', first: 26, n: 2, desc: 'يزداد الدفء ويقترب الصيف، وتنشط الرياح.' },
    { name: 'الكنة', first: 0, n: 2, desc: 'تستتر الثريا عن الأنظار، ويبدأ الحر بالظهور.' },
    { name: 'القيظ', first: 2, n: 2, desc: 'دخول الصيف الحار مع طلوع الثريا فجراً، ويبدأ نضج الرطب.' },
    { name: 'جمرة القيظ', first: 4, n: 2, desc: 'أشد أيام الصيف حرارة.' },
    { name: 'الكليبين', first: 6, n: 2, desc: 'حر شديد مع رطوبة، وتسكن فيه الرياح.' },
    { name: 'سهيل', first: 8, n: 4, desc: 'طلوع نجم سهيل، تبرد الليالي تدريجياً وينكسر الحر.' }
  ];
  function starStartDate(i, y) { return Date.UTC(y, STAR_STARTS[i][0] - 1, STAR_STARTS[i][1]); }
  // y,m,d = التاريخ المحلي
  function najdiStar(y, m, d) {
    const t = Date.UTC(y, m - 1, d);
    let found = null;
    for (const yy of [y - 1, y]) for (let i = 0; i < 28; i++) {
      const s = starStartDate(i, yy);
      let e = starStartDate((i + 1) % 28, i === 27 ? yy : yy);
      if (e <= s) e = starStartDate((i + 1) % 28, yy + 1);
      if (t >= s && t < e) found = { index: i, start: s, end: e };
    }
    if (!found) return null;
    const day = Math.round((t - found.start) / DAY) + 1, len = Math.round((found.end - found.start) / DAY);
    const si = SEASONS.findIndex(S => { for (let j = 0; j < S.n; j++) if ((S.first + j) % 28 === found.index) return true; return false; });
    const S = SEASONS[si];
    let sStart = null;
    for (const yy of [y - 1, y]) { const s = starStartDate(S.first, yy); if (s <= t && (!sStart || s > sStart)) sStart = s; }
    const sEnd = (() => { const n = SEASONS[(si + 1) % SEASONS.length]; let e = starStartDate(n.first, y - 1); while (e <= sStart) e = starStartDate(n.first, new Date(e).getUTCFullYear() + 1); return e; })();
    return {
      star: MANSIONS[found.index], index: found.index, day, len,
      next: MANSIONS[(found.index + 1) % 28], nextStart: new Date(found.end),
      season: S.name, seasonDesc: S.desc, seasonIndex: si, nextSeasonIndex: (si + 1) % SEASONS.length, seasonDay: Math.round((t - sStart) / DAY) + 1, seasonLen: Math.round((sEnd - sStart) / DAY),
      nextSeason: SEASONS[(si + 1) % SEASONS.length].name, nextSeasonStart: new Date(sEnd)
    };
  }

  /* ---------- الهجري (أم القرى عبر Intl) ---------- */
  let hijriFmt = null;
  function hijri(date, timeZone) {
    try {
      hijriFmt = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura-nu-latn', { day: 'numeric', month: 'numeric', year: 'numeric', timeZone: timeZone || undefined });
      const p = {}; hijriFmt.formatToParts(date).forEach(x => { p[x.type] = x.value; });
      return { day: +p.day, month: +p.month, year: parseInt(p.year, 10) };
    } catch (e) { return null; }
  }
  const HIJRI_MONTHS = ['محرم', 'صفر', 'ربيع الأول', 'ربيع الآخر', 'جمادى الأولى', 'جمادى الآخرة', 'رجب', 'شعبان', 'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة'];

  root.Astro = {
    KAABA, METHODS, MANSIONS, SEASONS, HIJRI_MONTHS,
    prayerTimes, sunPos, moonPos, moonIllumination, moonTimes, moonPhases, phaseJDE,
    qibla, distanceKm, sunQiblaTimes, kaabaTransits, moonMansion, najdiStar, hijri
  };
})(typeof window !== 'undefined' ? window : globalThis);

/* خادم إشعارات ومض آرك — فَلَق وسهم وخُطى
   Cloudflare Worker + قاعدة بيانات D1 + تشغيل مجدول كل دقيقة.
   ينشئ مفاتيح VAPID والجداول بنفسه. الإدارة من admin.wamdarc.com، وتحتاج المتغير السري ADMIN_KEY. */

const ENC = new TextEncoder();
const APPS = ['falaq', 'sahm', 'khuta'];
const KEYS = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'];
const PUSH_HOSTS = [/\.push\.apple\.com$/, /^fcm\.googleapis\.com$/, /^updates\.push\.services\.mozilla\.com$/, /^push\.services\.mozilla\.com$/, /\.notify\.windows\.com$/];
const DAY = 864e5;

const MSG = {
  ar: {
    fajr: ['أذان الفجر', 'حان الآن وقت صلاة الفجر'],
    sunrise: ['الشروق', 'طلعت الشمس وانتهى وقت صلاة الفجر'],
    dhuhr: ['أذان الظهر', 'حان الآن وقت صلاة الظهر'],
    jumuah: ['أذان الجمعة', 'حان الآن وقت صلاة الجمعة'],
    asr: ['أذان العصر', 'حان الآن وقت صلاة العصر'],
    maghrib: ['أذان المغرب', 'حان الآن وقت صلاة المغرب'],
    isha: ['أذان العشاء', 'حان الآن وقت صلاة العشاء'],
    test_falaq: ['فَلَق', 'تم تفعيل الإشعارات، وسيصلك تنبيه عند دخول وقت كل صلاة.'],
    test_sahm: ['سهم', 'تم تفعيل الإشعارات. سيصلك تذكير بحفظ نسخة من أماكنك.'],
    test_khuta: ['خُطى', 'تم تفعيل الإشعارات. سنذكّرك بذكرى رحلاتك وبحفظ نسخة احتياطية.'],
    backup_sahm: ['نسخة احتياطية لأماكنك', 'مرّ شهر على آخر نسخة احتياطية. احفظ نسخة من أماكنك المفضلة حتى لا تضيع.'],
    backup_khuta: ['نسخة احتياطية لرحلاتك', 'مرّ شهر على آخر نسخة احتياطية. صدّر نسخة من رحلاتك وصورك من الإعدادات.'],
    anniv: ['ذكرى رحلة', 'في مثل هذا اليوم بدأت إحدى رحلاتك. افتح خُطى وتذكّرها.'],
    before: ['رحلتك بكرة ✈️', 'رحلة سعيدة! لا تنسَ جوازك وشاحن جوالك.'],
    after: ['أهلاً بعودتك 🏡', 'أضف صور رحلتك ويومياتها قبل ما تنساها.'],
    azkarM: ['أذكار الصباح ☀️', 'ابدأ يومك بأذكار الصباح.'],
    azkarE: ['أذكار المساء 🌙', 'حان وقت أذكار المساء.'],
    kahf: ['سورة الكهف', 'يوم الجمعة: لا تنسَ قراءة سورة الكهف.'],
    white: ['الأيام البيض', 'بكرة أول الأيام البيض (13 و14 و15)، ومن عادته الصيام فليستعد.']
  },
  en: {
    fajr: ['Fajr', 'It is time for Fajr prayer'],
    sunrise: ['Sunrise', 'The sun has risen and Fajr time has ended'],
    dhuhr: ['Dhuhr', 'It is time for Dhuhr prayer'],
    jumuah: ['Jumuah', 'It is time for Jumuah prayer'],
    asr: ['Asr', 'It is time for Asr prayer'],
    maghrib: ['Maghrib', 'It is time for Maghrib prayer'],
    isha: ['Isha', 'It is time for Isha prayer'],
    test_falaq: ['Falaq', 'Notifications are on. You will be notified at the start of each prayer time.'],
    test_sahm: ['Sahm', 'Notifications are on. You will get backup reminders for your places.'],
    test_khuta: ['Khuta', 'Notifications are on. We will remind you of trip anniversaries and backups.'],
    backup_sahm: ['Back up your places', 'It has been a month since your last backup. Save a copy of your places so they are never lost.'],
    backup_khuta: ['Back up your trips', 'It has been a month since your last backup. Export your trips and photos from Settings.'],
    anniv: ['Trip anniversary', 'One of your trips started on this day. Open Khuta to look back.'],
    before: ['Your trip is tomorrow ✈️', 'Have a great trip! Don’t forget your passport and charger.'],
    after: ['Welcome back 🏡', 'Add your trip photos and notes before you forget them.'],
    azkarM: ['Morning adhkar ☀️', 'Start your day with the morning adhkar.'],
    azkarE: ['Evening adhkar 🌙', 'It is time for the evening adhkar.'],
    kahf: ['Surat Al-Kahf', 'It is Friday: remember to read Surat Al-Kahf.'],
    white: ['The White Days', 'The White Days (13th–15th) begin tomorrow, for those who fast them.']
  }
};

/* ---------- أدوات ---------- */
const b64u = buf => { let s = ''; new Uint8Array(buf).forEach(c => { s += String.fromCharCode(c); }); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const ub64 = s => { s = String(s).replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; const b = atob(s); return Uint8Array.from(b, c => c.charCodeAt(0)); };
const concat = (...arr) => { const out = new Uint8Array(arr.reduce((n, a) => n + a.length, 0)); let i = 0; arr.forEach(a => { out.set(a, i); i += a.length; }); return out; };
async function hmac(key, data) {
  const k = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, data));
}
async function sha256hex(s) { return [...new Uint8Array(await crypto.subtle.digest('SHA-256', ENC.encode(s)))].map(b => b.toString(16).padStart(2, '0')).join(''); }
function safeEqual(a, b) {
  a = String(a || ''); b = String(b || '');
  if (!a || !b || a.length !== b.length) return false;
  let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

/* ---------- تشفير الرسالة (RFC 8291 — aes128gcm) ---------- */
async function encryptPayload(p256dh, authSecret, text) {
  const ua = ub64(p256dh), auth = ub64(authSecret);
  const eph = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const asPub = new Uint8Array(await crypto.subtle.exportKey('raw', eph.publicKey));
  const uaKey = await crypto.subtle.importKey('raw', ua, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, eph.privateKey, 256));
  const prkKey = await hmac(auth, shared);
  const ikm = (await hmac(prkKey, concat(ENC.encode('WebPush: info\0'), ua, asPub, new Uint8Array([1])))).slice(0, 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const prk = await hmac(salt, ikm);
  const cek = (await hmac(prk, concat(ENC.encode('Content-Encoding: aes128gcm\0'), new Uint8Array([1])))).slice(0, 16);
  const nonce = (await hmac(prk, concat(ENC.encode('Content-Encoding: nonce\0'), new Uint8Array([1])))).slice(0, 12);
  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, concat(ENC.encode(text), new Uint8Array([2]))));
  const head = new Uint8Array(21);
  head.set(salt, 0); new DataView(head.buffer).setUint32(16, 4096); head[20] = 65;
  return concat(head, asPub, ct);
}

/* ---------- مفاتيح VAPID ---------- */
let VAPID = null;
const JWT_CACHE = new Map();
async function vapid(env) {
  if (VAPID) return VAPID;
  const row = await env.DB.prepare("SELECT v FROM config WHERE k = 'vapid'").first();
  if (row) { VAPID = JSON.parse(row.v); return VAPID; }
  const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const jwk = await crypto.subtle.exportKey('jwk', kp.privateKey);
  const pub = b64u(await crypto.subtle.exportKey('raw', kp.publicKey));
  const v = { jwk: { kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y, d: jwk.d }, pub };
  await env.DB.prepare("INSERT OR IGNORE INTO config (k, v) VALUES ('vapid', ?)").bind(JSON.stringify(v)).run();
  const again = await env.DB.prepare("SELECT v FROM config WHERE k = 'vapid'").first();
  VAPID = JSON.parse(again.v);
  return VAPID;
}
async function vapidHeader(endpoint, keys, subject) {
  const aud = new URL(endpoint).origin, now = Math.floor(Date.now() / 1000);
  const hit = JWT_CACHE.get(aud);
  if (hit && hit.exp - now > 3600) return hit.h;   // توفير: توقيع واحد لكل خدمة إشعارات
  const exp = now + 12 * 3600;
  const h = b64u(ENC.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const c = b64u(ENC.encode(JSON.stringify({ aud, exp, sub: subject })));
  const key = await crypto.subtle.importKey('jwk', keys.jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, ENC.encode(h + '.' + c));
  const header = 'vapid t=' + h + '.' + c + '.' + b64u(sig) + ', k=' + keys.pub;
  JWT_CACHE.set(aud, { h: header, exp });
  return header;
}
async function sendPush(env, row, payload, urgency) {
  const keys = await vapid(env);
  const body = await encryptPayload(row.p256dh, row.auth, JSON.stringify(payload));
  const res = await fetch(row.endpoint, {
    method: 'POST',
    headers: {
      Authorization: await vapidHeader(row.endpoint, keys, env.VAPID_SUBJECT || 'https://wamdarc.com'),
      'Content-Encoding': 'aes128gcm', 'Content-Type': 'application/octet-stream',
      TTL: urgency === 'high' ? '900' : '86400', Urgency: urgency || 'normal'
    },
    body
  });
  return res.status;
}

/* ---------- الوقت المحلي ---------- */
function localYMD(t, tz) {
  const p = {};
  new Intl.DateTimeFormat('en-US', { timeZone: tz, year: 'numeric', month: 'numeric', day: 'numeric' }).formatToParts(new Date(t)).forEach(x => { p[x.type] = x.value; });
  return { y: +p.year, m: +p.month, d: +p.day };
}
function tzOffsetMin(t, tz) {
  const p = {};
  new Intl.DateTimeFormat('en-US', { timeZone: tz, year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' })
    .formatToParts(new Date(t)).forEach(x => { p[x.type] = x.value; });
  return (Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute) - Math.floor(t / 6e4) * 6e4) / 6e4;
}
// لحظة الساعة h:mi بالتوقيت المحلي لليوم y-m-d
function localAt(y, m, d, h, mi, tz) {
  const guess = Date.UTC(y, m - 1, d, h, mi);
  return guess - tzOffsetMin(guess - tzOffsetMin(guess, tz) * 6e4, tz) * 6e4;
}

/* ---------- جداول المواسم والطوالع (نفس جدول سهم: دليل الطوالع للمسند) ---------- */
// [عربي، إنجليزي، شهر البداية، يوم البداية، أدنى حرارة، أعلى حرارة]
const TAWALI = [['الإكليل','Al-Iklil',12,7,9,23],['القلب','Al-Qalb',12,20,7,21],['الشولة','Ash-Shawlah',1,2,7,20],['النعائم','An-Na‘aim',1,15,7,20],
['البلدة','Al-Baldah',1,28,7,21],['سعد الذابح','Sa‘d adh-Dhabih',2,10,8,20],['سعد بلع','Sa‘d Bula‘',2,23,10,23],['سعد السعود','Sa‘d as-Su‘ud',3,8,13,27],
['سعد الأخبية','Sa‘d al-Akhbiyah',3,21,13,26],['المقدم','Al-Muqaddam',4,3,16,30],['المؤخر','Al-Mu’akhkhar',4,16,18,32],['الرشا','Ar-Risha',4,29,20,36],
['الشرطين','Ash-Sharatain',5,12,23,38],['البطين','Al-Butain',5,25,23,40],['الثريا','Ath-Thurayya',6,7,23,41],['الدبران','Ad-Dabaran',6,20,22,36],
['الهقعة','Al-Haq‘ah',7,3,23,39],['الهنعة','Al-Han‘ah',7,16,25,43],['الذراع','Adh-Dhira‘',7,29,24,43],['النثرة','An-Nathrah',8,11,23,42],
['الطرف','At-Tarf',8,24,23,42],['الجبهة','Al-Jabhah',9,6,22,41],['الزبرة','Az-Zubrah',9,20,20,38],['الصرفة','As-Sarfah',10,3,19,36],
['العواء','Al-‘Awwa’',10,16,17,34],['السماك','As-Simak',10,29,15,30],['الغفر','Al-Ghafr',11,11,12,26],['الزبانا','Az-Zubana',11,24,11,25]];
const MAWASIM = [['المربعانية','Al-Murabba‘aniyah',12,7],['الشبط','Ash-Shabat',1,15],['العقارب','Al-‘Aqarib',2,10],['الحميمين','Al-Hamimain',3,21],['الذراعين','Adh-Dhira‘ain',4,16],
['الثريا','Ath-Thurayya',5,12],['التويبع','At-Tuwaiyi‘',6,20],['الجوزاء','Al-Jawza’',7,3],['المرزم','Al-Mirzam',7,29],['الكليبين','Al-Kulaibain',8,11],['سهيل','Suhail',8,24],['الوسم','Al-Wasm',10,16]];

/* ---------- أدوات الأيام ---------- */
const addDays = (ymd, n) => { const t = new Date(Date.UTC(ymd.y, ymd.m - 1, ymd.d + n)); return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate(), wd: t.getUTCDay() }; };
const ymdOf = s => ({ y: +s.slice(0, 4), m: +s.slice(5, 7), d: +s.slice(8, 10) });
const best = list => list.filter(Boolean).sort((a, b) => a.at - b.at)[0] || null;

/* ---------- فَلَق ---------- */
function dayTimes(cfg, ymd) {
  const A = globalThis.Astro;
  const h = A.hijri(new Date(Date.UTC(ymd.y, ymd.m - 1, ymd.d, 12)), 'UTC');
  const T = A.prayerTimes(ymd.y, ymd.m, ymd.d, cfg.lat, cfg.lng, { method: cfg.method, asr: cfg.asr, adjust: cfg.adjust, ramadan: !!(h && h.month === 9) });
  return { T, h };
}
function nextFalaq(cfg, after) {
  const r = cfg.rem || {}, base = addDays(localYMD(after, cfg.tz), 0), c = [];   // اشتراكات الإصدار الأول ما فيها rem
  cfg.prayers = cfg.prayers || {};
  // الأذان، وقبل الأذان، وأذكار الصباح والمساء: نبحث في 3 أيام
  for (let off = 0; off < 3; off++) {
    const day = addDays(base, off), { T } = dayTimes(cfg, day), fri = day.wd === 5;
    const name = k => k === 'dhuhr' && fri ? 'jumuah' : k;
    for (const k of KEYS) {
      if (!T[k]) continue;
      if (cfg.prayers[k]) c.push({ at: T[k].valueOf(), key: name(k) });
      if (r.pre && k !== 'sunrise' && cfg.prayers[k]) c.push({ at: T[k].valueOf() - r.pre * 6e4, key: 'pre', data: { p: name(k), m: r.pre } });
    }
    if (r.azkarM && T.fajr) c.push({ at: T.fajr.valueOf() + 30 * 6e4, key: 'azkarM' });
    if (r.azkarE && T.asr) c.push({ at: T.asr.valueOf() + 30 * 6e4, key: 'azkarE' });
    const n = best(c.filter(e => e.at > after));
    if (n) { c.length = 0; c.push(n); break; }
  }
  // سورة الكهف: الجمعة 10 صباحاً
  if (r.kahf) for (let off = 0; off < 8; off++) {
    const day = addDays(base, off);
    if (day.wd !== 5) continue;
    const at = localAt(day.y, day.m, day.d, 10, 0, cfg.tz);
    if (at > after) { c.push({ at, key: 'kahf' }); break; }
  }
  // الأيام البيض: مساء يوم 12 الهجري، بعد المغرب بنصف ساعة
  if (r.white) for (let off = 0; off < 35; off++) {
    const day = addDays(base, off);
    const h = globalThis.Astro.hijri(new Date(Date.UTC(day.y, day.m - 1, day.d, 12)), 'UTC');
    if (!h || h.day !== 12) continue;
    const { T } = dayTimes(cfg, day);
    const at = T.maghrib.valueOf() + 30 * 6e4;
    if (at > after) { c.push({ at, key: 'white' }); break; }
  }
  return best(c.filter(e => e.at > after));
}

/* ---------- سهم وخُطى: النسخة الاحتياطية ---------- */
function nextBackup(cfg, state, after) {
  if (!cfg.prefs.backup || !cfg.count) return null;
  const base = cfg.lastBackup || cfg.since || after;
  let due = Math.max(base + (cfg.lastBackup ? 30 : 7) * DAY, (state.bk || 0) + 30 * DAY, after);
  // في الساعة 8 مساءً بالتوقيت المحلي
  const L = localYMD(due, cfg.tz);
  let at = localAt(L.y, L.m, L.d, 20, 45, cfg.tz);   // 8:45 مساءً (بعيداً عن تذكيرات الرحلات)
  if (at <= after || at < due - DAY / 2) { const n = addDays(L, 1); at = localAt(n.y, n.m, n.d, 20, 45, cfg.tz); }
  return { at, key: 'backup' };
}

/* ---------- سهم: المواسم والطوالع، الساعة 8 صباحاً يوم الدخول ---------- */
function nextSeason(cfg, after) {
  if (!cfg.prefs.seasons) return null;
  const now = localYMD(after, cfg.tz);
  const c = [];
  for (const y of [now.y, now.y + 1]) TAWALI.forEach((t, i) => {
    const at = localAt(y, t[2], t[3], 8, 0, cfg.tz);
    if (at > after) c.push({ at, key: 'season', data: { t: i, s: MAWASIM.findIndex(m => m[2] === t[2] && m[3] === t[3]) } });
  });
  return best(c);
}

/* ---------- خُطى: الرحلات ---------- */
function nextTrips(cfg, after) {
  const p = cfg.prefs, now = localYMD(after, cfg.tz), today = now.y * 1e4 + now.m * 100 + now.d, c = [];
  const rank = {};
  for (const t of cfg.trips) {
    const s = ymdOf(t.d), sNum = s.y * 1e4 + s.m * 100 + s.d;
    // ذكرى الرحلة: 10 صباحاً، ودقيقتان بين الرحلات التي تشترك في نفس اليوم
    if (p.anniv && sNum < today + 1) {
      const md = 'n' + t.d.slice(5), k = (rank[md] = (rank[md] || 0) + 1) - 1;
      for (let y = Math.max(now.y, s.y + 1); y <= now.y + 1; y++) {
        let d = s.d;
        if (s.m === 2 && d === 29 && !(y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0))) d = 28;
        const at = localAt(y, s.m, d, 10, k * 2, cfg.tz);
        if (at > after) { c.push({ at, key: 'anniv', data: { trip: t.i, years: y - s.y } }); break; }
      }
    }
    // قبل الرحلة: 8 مساءً في اليوم السابق
    if (p.before && sNum > today - 1) {
      const kb = (rank['b' + t.d] = (rank['b' + t.d] || 0) + 1) - 1;
      const b = addDays(s, -1), at = localAt(b.y, b.m, b.d, 19, 30 + kb * 2, cfg.tz);
      if (at > after) c.push({ at, key: 'before', data: { trip: t.i } });
    }
    // بعد العودة: 8 مساءً في اليوم التالي لنهاية الرحلة
    if (p.after && t.e) {
      const ka = (rank['a' + t.e] = (rank['a' + t.e] || 0) + 1) - 1;
      const e = addDays(ymdOf(t.e), 1), at = localAt(e.y, e.m, e.d, 20, 15 + ka * 2, cfg.tz);
      if (at > after && at - after < 400 * DAY) c.push({ at, key: 'after', data: { trip: t.i } });
    }
  }
  return best(c);
}

function nextEvent(app, cfg, state, after) {
  if (app === 'falaq') return nextFalaq(cfg, after);
  if (app === 'sahm') return best([nextBackup(cfg, state, after), nextSeason(cfg, after)]);
  if (app === 'khuta') return best([nextBackup(cfg, state, after), nextTrips(cfg, after)]);
  return null;
}

/* ---------- نص الإشعار ---------- */
function buildPayload(app, key, data, lang) {
  const M = MSG[lang] || MSG.ar, ar = lang !== 'en';
  const base = { lang, kind: key, tag: app + '-' + key };
  if (key === 'pre') {
    const pn = M[data.p] ? M[data.p][0].replace(/^أذان /, '') : data.p;
    return Object.assign(base, ar ? { title: 'باقي ' + data.m + (data.m <= 10 ? ' دقائق' : ' دقيقة') + ' على أذان ' + pn, body: 'استعد للصلاة' } : { title: data.m + ' minutes to ' + M[data.p][0], body: 'Get ready for prayer' });
  }
  if (key === 'season') {
    const t = TAWALI[data.t], s = data.s >= 0 ? MAWASIM[data.s] : null, i = ar ? 0 : 1;
    const temp = (ar ? 'الحرارة المعتادة ' : 'Typical temperature ') + t[4] + '° – ' + t[5] + '°';
    return Object.assign(base, ar
      ? { title: s ? 'دخل موسم ' + s[0] : 'دخل طالع ' + t[0], body: (s ? 'ودخل معه طالع ' + t[0] + '. ' : '') + temp + '.' }
      : { title: s ? s[1] + ' season begins' : t[1] + ' rises today', body: (s ? 'Along with the star ' + t[1] + '. ' : '') + temp + '.' });
  }
  const k = key === 'backup' ? 'backup_' + app : key;
  const m = M[k];
  if (!m) return null;
  Object.assign(base, { title: m[0], body: m[1] }, data || {});
  if (key === 'azkarM') base.url = './#azkar=morning';
  if (key === 'azkarE') base.url = './#azkar=evening';
  if (key === 'white') base.url = './#moon';
  return base;
}

/* ---------- التحقق من المدخلات ---------- */
function cleanCfg(app, c) {
  c = c || {};
  const num = (v, lo, hi) => { v = Number(v); if (!isFinite(v)) throw new Error('bad number'); return Math.min(hi, Math.max(lo, v)); };
  let tz = String(c.tz || 'UTC').slice(0, 64);
  try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); } catch (e) { tz = 'UTC'; }
  const p = c.prefs || {};
  const out = { tz, lang: c.lang === 'en' ? 'en' : 'ar', prefs: {} };
  if (app === 'falaq') {
    out.lat = Math.round(num(c.lat, -90, 90) * 100) / 100;
    out.lng = Math.round(num(c.lng, -180, 180) * 100) / 100;
    out.method = globalThis.Astro.METHODS[c.method] ? c.method : 'umm_alqura';
    out.asr = c.asr === 2 ? 2 : 1;
    out.adjust = {}; out.prayers = {};
    KEYS.forEach(k => { out.adjust[k] = Math.round(num((c.adjust || {})[k] || 0, -30, 30)); out.prayers[k] = !!(c.prayers || {})[k]; });
    const r = c.rem || {};
    out.rem = { pre: [0, 5, 10, 15].includes(+r.pre) ? +r.pre : 0, azkarM: !!r.azkarM, azkarE: !!r.azkarE, kahf: !!r.kahf, white: !!r.white };
  } else {
    out.prefs.backup = p.backup !== false;
    out.count = Math.max(0, Math.min(1e6, Math.floor(Number(c.count) || 0)));
    out.lastBackup = Number(c.lastBackup) > 0 ? Math.min(Number(c.lastBackup), Date.now()) : null;
    out.since = Number(c.since) > 0 ? Math.min(Number(c.since), Date.now()) : Date.now();
  }
  if (app === 'sahm') out.prefs.seasons = !!p.seasons;
  if (app === 'khuta') {
    out.prefs.anniv = p.anniv !== false; out.prefs.before = p.before !== false; out.prefs.after = p.after !== false;
    const okD = v => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ''));
    out.trips = (Array.isArray(c.trips) ? c.trips : []).slice(0, 1000)
      .filter(t => t && /^[\w-]{1,64}$/.test(String(t.i)) && okD(t.d))
      .map(t => ({ i: String(t.i), d: String(t.d), e: okD(t.e) && t.e >= t.d ? String(t.e) : null }))
      .sort((a, b) => a.i < b.i ? -1 : 1);
  }
  return out;
}
function okEndpoint(env, u) {
  try {
    const url = new URL(u);
    if (env.DEV_ALLOW_ANY_ENDPOINT === '1') return true;
    return url.protocol === 'https:' && PUSH_HOSTS.some(r => r.test(url.hostname));
  } catch (e) { return false; }
}

/* ---------- قاعدة البيانات ---------- */
let ready = false;
async function init(env) {
  if (ready) return;
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS subs (id TEXT PRIMARY KEY, endpoint TEXT NOT NULL, p256dh TEXT NOT NULL, auth TEXT NOT NULL, cfg TEXT NOT NULL, next_at INTEGER, next_key TEXT, updated INTEGER)').run();
  // ترقية من الإصدار الأول (فَلَق فقط)
  const cols = (await env.DB.prepare('PRAGMA table_info(subs)').all()).results.map(r => r.name);
  if (!cols.includes('app')) await env.DB.prepare("ALTER TABLE subs ADD COLUMN app TEXT NOT NULL DEFAULT 'falaq'").run();
  if (!cols.includes('state')) await env.DB.prepare("ALTER TABLE subs ADD COLUMN state TEXT NOT NULL DEFAULT '{}'").run();
  if (!cols.includes('next_data')) await env.DB.prepare('ALTER TABLE subs ADD COLUMN next_data TEXT').run();
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS subs_next ON subs (next_at)').run();
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS config (k TEXT PRIMARY KEY, v TEXT)').run();
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS outbox (n INTEGER PRIMARY KEY AUTOINCREMENT, sub_id TEXT NOT NULL, msg INTEGER NOT NULL)').run();
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS messages (n INTEGER PRIMARY KEY AUTOINCREMENT, created INTEGER, apps TEXT, body TEXT, total INTEGER)').run();
  // الإحصائيات: أجهزة مجهولة (معرّف عشوائي يولّده الجهاز نفسه، بدون أي بيانات شخصية)
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS devices (app TEXT NOT NULL, dev TEXT NOT NULL, first INTEGER, last INTEGER, inst INTEGER DEFAULT 0, plat TEXT, ver TEXT, lang TEXT, opens INTEGER DEFAULT 0, PRIMARY KEY (app, dev))').run();
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS devices_last ON devices (last)').run();
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS days (day TEXT NOT NULL, app TEXT NOT NULL, dev TEXT NOT NULL, opens INTEGER DEFAULT 0, PRIMARY KEY (day, app, dev))').run();
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS pages (day TEXT NOT NULL, path TEXT NOT NULL, n INTEGER DEFAULT 0, PRIMARY KEY (day, path))').run();
  ready = true;
}
const nextCols = n => [n ? n.at : Date.now() + 6 * 36e5, n ? n.key : null, n && n.data ? JSON.stringify(n.data) : null];

/* ---------- الواجهة ---------- */
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Max-Age': '86400' };
const json = (o, status) => new Response(JSON.stringify(o), { status: status || 200, headers: Object.assign({ 'Content-Type': 'application/json' }, CORS) });
// توحيد المفتاح: أرقام عربية/فارسية ← إنجليزية، وحذف المسافات
const normKey = k => String(k || '').replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/\s+/g, '');
const isAdmin = (req, env) => !!env.ADMIN_KEY && safeEqual(normKey(decodeURIComponent((req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, ''))), normKey(env.ADMIN_KEY));

async function handle(req, env) {
  const url = new URL(req.url);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (!env.DB) return json({ error: 'D1 database binding "DB" is missing' }, 500);
  await init(env);
  if (req.method === 'GET' && url.pathname === '/vapid') return json({ key: (await vapid(env)).pub });
  if (req.method === 'GET' && url.pathname === '/') return json({ ok: true, service: 'wamdarc-push', apps: APPS });
  if (req.method === 'GET' && url.pathname === '/stats') {
    if (!env.ADMIN_KEY) return json({ error: 'no-key' }, 503);
    { const g = await adminGate(req, env.DB, () => isAdmin(req, env)); if (g !== 'ok') return json({ error: g === 'locked' ? 'locked' : 'unauthorized' }, g === 'locked' ? 429 : 401); }
    const { results } = await env.DB.prepare("SELECT app, COUNT(*) AS n FROM subs GROUP BY app").all();
    const q = await env.DB.prepare('SELECT COUNT(*) AS n FROM outbox').first();
    const hist = (await env.DB.prepare('SELECT created, apps, body, total FROM messages ORDER BY n DESC LIMIT 8').all()).results;
    return json({ apps: results, queued: q ? q.n : 0, perTick: perTick(env), history: hist });
  }
  if (req.method === 'GET' && url.pathname === '/analytics') {
    if (!env.ADMIN_KEY) return json({ error: 'no-key' }, 503);
    { const g = await adminGate(req, env.DB, () => isAdmin(req, env)); if (g !== 'ok') return json({ error: g === 'locked' ? 'locked' : 'unauthorized' }, g === 'locked' ? 429 : 401); }
    return json(await analytics(env));
  }
  if (req.method !== 'POST') return json({ error: 'not found' }, 404);
  const text = await req.text();
  if (text.length > 64000) return json({ error: 'too large' }, 413);
  let body; try { body = JSON.parse(text); } catch (e) { return json({ error: 'bad json' }, 400); }

  if (url.pathname === '/hit') return json(await hit(env, body));
  if (url.pathname === '/subscribe') {
    const app = APPS.includes(body.app) ? body.app : 'falaq';
    const s = body.sub || {};
    if (!s.endpoint || !s.keys || !s.keys.p256dh || !s.keys.auth || !okEndpoint(env, s.endpoint)) return json({ error: 'bad subscription' }, 400);
    let cfg; try { cfg = cleanCfg(app, body.cfg); } catch (e) { return json({ error: 'bad settings' }, 400); }
    const id = await sha256hex(s.endpoint), now = Date.now();
    const old = await env.DB.prepare('SELECT state FROM subs WHERE id = ?').bind(id).first();
    const state = old ? JSON.parse(old.state || '{}') : {};
    const n = nextEvent(app, cfg, state, now + 30e3);
    const [nAt, nKey, nData] = nextCols(n);
    await env.DB.prepare('INSERT INTO subs (id, app, endpoint, p256dh, auth, cfg, state, next_at, next_key, next_data, updated) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11) ON CONFLICT(id) DO UPDATE SET app = ?2, endpoint = ?3, p256dh = ?4, auth = ?5, cfg = ?6, next_at = ?8, next_key = ?9, next_data = ?10, updated = ?11')
      .bind(id, app, s.endpoint, s.keys.p256dh, s.keys.auth, JSON.stringify(cfg), JSON.stringify(state), nAt, nKey, nData, now).run();
    let test = null;
    if (body.test) {
      const m = MSG[cfg.lang]['test_' + app];
      test = await sendPush(env, { endpoint: s.endpoint, p256dh: s.keys.p256dh, auth: s.keys.auth }, { title: m[0], body: m[1], tag: app + '-test', lang: cfg.lang, kind: 'test' }, 'high');
    }
    return json({ ok: true, next: n ? { at: n.at, key: n.key } : null, test });
  }
  if (url.pathname === '/unsubscribe') {
    if (body.endpoint) await env.DB.prepare('DELETE FROM subs WHERE id = ?').bind(await sha256hex(body.endpoint)).run();
    return json({ ok: true });
  }
  if (url.pathname === '/broadcast') {
    if (!env.ADMIN_KEY) return json({ error: 'no-key' }, 503);
    { const g = await adminGate(req, env.DB, () => isAdmin(req, env)); if (g !== 'ok') return json({ error: g === 'locked' ? 'locked' : 'unauthorized' }, g === 'locked' ? 429 : 401); }
    const apps = (Array.isArray(body.apps) ? body.apps : []).filter(a => APPS.includes(a));
    const clip = (s, n) => String(s || '').trim().slice(0, n);
    const msg = { ar: { title: clip(body.ar && body.ar.title, 80), body: clip(body.ar && body.ar.body, 300) }, en: { title: clip(body.en && body.en.title, 80), body: clip(body.en && body.en.body, 300) }, kind: body.kind === 'update' ? 'update' : 'news' };
    if (!msg.en.title) msg.en = msg.ar;
    if (!apps.length || !msg.ar.title) return json({ error: 'missing' }, 400);
    const ph = apps.map(() => '?').join(',');
    const ins = await env.DB.prepare('INSERT INTO messages (created, apps, body, total) VALUES (?, ?, ?, 0)').bind(Date.now(), apps.join(','), JSON.stringify(msg)).run();
    const mid = ins.meta.last_row_id;
    const r = await env.DB.prepare('INSERT INTO outbox (sub_id, msg) SELECT id, ? FROM subs WHERE app IN (' + ph + ')').bind(mid, ...apps).run();
    const total = r.meta.changes || 0;
    await env.DB.prepare('UPDATE messages SET total = ? WHERE n = ?').bind(total, mid).run();
    return json({ ok: true, queued: total, perTick: perTick(env) });
  }
  return json({ error: 'not found' }, 404);
}

/* ---------- الإحصائيات (لكل التطبيقات والموقع) ---------- */
const STAT_APPS = ['site', 'sahm', 'falaq', 'khuta', 'siraj', 'nabd'];
const ONLINE_MS = 150e3;                                     // متصل الآن = آخر نبضة خلال دقيقتين ونص
const ryDay = t => new Date(t + 3 * 36e5).toISOString().slice(0, 10);   // اليوم بتوقيت الرياض
async function hit(env, b) {
  const app = String(b.app || ''), dev = String(b.dev || '');
  if (!/^[a-z]{2,16}$/.test(app) || !/^[a-z0-9]{8,32}$/.test(dev)) return { ok: false };   // أي تطبيق جديد ينقبل بدون تعديل الخادم
  const now = Date.now(), day = ryDay(now), open = b.ev === 'open' ? 1 : 0;
  const inst = b.inst ? 1 : 0;
  const plat = ['ios', 'android', 'desktop'].includes(b.plat) ? b.plat : 'other';
  const ver = String(b.ver || '').slice(0, 12), lang = b.lang === 'en' ? 'en' : 'ar';
  const st = [env.DB.prepare("INSERT INTO devices (app, dev, first, last, inst, plat, ver, lang, opens) VALUES (?1, ?2, ?3, ?3, ?4, ?5, ?6, ?7, ?8) ON CONFLICT(app, dev) DO UPDATE SET last = ?3, inst = MAX(inst, ?4), plat = ?5, ver = CASE WHEN ?6 <> '' THEN ?6 ELSE ver END, lang = ?7, opens = opens + ?8")
    .bind(app, dev, now, inst, plat, ver, lang, open)];
  if (open) {
    st.push(env.DB.prepare('INSERT INTO days (day, app, dev, opens) VALUES (?, ?, ?, 1) ON CONFLICT(day, app, dev) DO UPDATE SET opens = opens + 1').bind(day, app, dev));
    const path = app === 'site' ? String(b.path || '/').replace(/[?#].*$/, '').slice(0, 60) : '';
    if (path) st.push(env.DB.prepare('INSERT INTO pages (day, path, n) VALUES (?, ?, 1) ON CONFLICT(day, path) DO UPDATE SET n = n + 1').bind(day, path));
  }
  await env.DB.batch(st);
  return { ok: true };
}
async function analytics(env) {
  const now = Date.now(), today = ryDay(now), d = n => ryDay(now - n * DAY);
  const q = (sql, ...a) => env.DB.prepare(sql).bind(...a).all().then(r => r.results || []);
  const [totals, active, plat, ver, series, pages, recent, subs, fresh] = await Promise.all([
    q('SELECT app, COUNT(*) total, SUM(inst) inst, SUM(last >= ?) online, SUM(first >= ?) new_today, SUM(opens) opens FROM devices GROUP BY app', now - ONLINE_MS, Date.parse(today + 'T00:00:00+03:00')),
    q('SELECT app, COUNT(DISTINCT CASE WHEN day = ? THEN dev END) today, COUNT(DISTINCT CASE WHEN day >= ? THEN dev END) d7, COUNT(DISTINCT dev) d30 FROM days WHERE day >= ? GROUP BY app', today, d(6), d(29)),
    q('SELECT app, plat, COUNT(*) n, SUM(inst) inst FROM devices GROUP BY app, plat'),
    q("SELECT app, ver, COUNT(*) n FROM devices WHERE ver <> '' AND last >= ? GROUP BY app, ver ORDER BY n DESC", now - 30 * DAY),
    q('SELECT day, app, COUNT(*) n, SUM(opens) opens FROM days WHERE day >= ? GROUP BY day, app ORDER BY day', d(29)),
    q('SELECT path, SUM(n) n FROM pages WHERE day >= ? GROUP BY path ORDER BY n DESC LIMIT 12', d(29)),
    q('SELECT app, plat, inst, ver, first, last, opens FROM devices ORDER BY last DESC LIMIT 30'),
    q('SELECT app, COUNT(*) n FROM subs GROUP BY app'),
    q('SELECT app, first FROM devices WHERE first >= ?', now - 30 * DAY)
  ]);
  const newByDay = {};
  fresh.forEach(r => { const k = ryDay(r.first) + '|' + r.app; newByDay[k] = (newByDay[k] || 0) + 1; });
  return { now, today, online_ms: ONLINE_MS, apps: STAT_APPS, totals, active, plat, ver, series, newByDay, pages, recent, subs };
}

/* ---------- كل دقيقة: إرسال ما حان وقته ثم الرسائل العامة ---------- */
// الخطة المجانية في Cloudflare تعطي ~10 ملي ثانية معالجة لكل تشغيل، وكل إشعار يكلّف ~1.3 ملي ثانية.
// مع الخطة المدفوعة ($5) ضع المتغير MAX_PER_TICK = 500
const perTick = env => Math.max(1, Math.min(2000, parseInt(env.MAX_PER_TICK, 10) || 6));
async function tick(env) {
  await init(env);
  const now = Date.now();
  let budget = perTick(env);
  const { results } = await env.DB.prepare('SELECT * FROM subs WHERE next_at <= ? ORDER BY next_at LIMIT ?').bind(now + 30e3, budget).all();
  for (const r of results || []) {
    // كل اشتراك لحاله: لو واحد فيه خطأ ما يوقف الباقين (كان اشتراك قديم يوقف كل إشعارات فلق)
    try {
      let cfg, state; try { cfg = JSON.parse(r.cfg); state = JSON.parse(r.state || '{}'); } catch (e) { throw e; }
      const app = r.app || 'falaq', lang = MSG[cfg.lang] ? cfg.lang : 'ar';
      // الأذان وما قبله: صالح 15 دقيقة فقط؛ التذكيرات الأخرى: 12 ساعة (لو تأخر الخادم)
      const urgent = KEYS.includes(r.next_key) || r.next_key === 'jumuah' || r.next_key === 'pre';
      const fresh = r.next_key && now - r.next_at < (urgent ? 15 * 6e4 : 12 * 36e5);
      let payload = null;
      if (fresh) { try { payload = buildPayload(app, r.next_key, r.next_data ? JSON.parse(r.next_data) : null, lang); } catch (e) {} }
      if (r.next_key === 'backup') state.bk = now;
      // نحدّث الموعد القادم قبل الإرسال حتى لا يتكرر الإشعار
      const [nAt, nKey, nData] = nextCols(nextEvent(app, cfg, state, Math.max(now + 30e3, (r.next_at || 0) + 6e4)));
      await env.DB.prepare('UPDATE subs SET next_at = ?, next_key = ?, next_data = ?, state = ? WHERE id = ?').bind(nAt, nKey, nData, JSON.stringify(state), r.id).run();
      if (payload) {
        budget--;
        try {
          const st = await sendPush(env, r, payload, urgent ? 'high' : 'normal');
          if (st === 404 || st === 410) await env.DB.prepare('DELETE FROM subs WHERE id = ?').bind(r.id).run();
        } catch (e) {}
      }
    } catch (e) {
      try { await env.DB.prepare('UPDATE subs SET next_at = ? WHERE id = ?').bind(now + 6 * 36e5, r.id).run(); } catch (e2) {}
    }
  }
  if (budget <= 0) return;
  const { results: out } = await env.DB.prepare('SELECT o.n, o.msg, s.id, s.endpoint, s.p256dh, s.auth, s.cfg, s.app, m.body AS mbody FROM outbox o JOIN subs s ON s.id = o.sub_id JOIN messages m ON m.n = o.msg ORDER BY o.n LIMIT ?').bind(budget).all();
  for (const o of out || []) {
    await env.DB.prepare('DELETE FROM outbox WHERE n = ?').bind(o.n).run();
    try {
      const cfg = JSON.parse(o.cfg), msg = JSON.parse(o.mbody), lang = cfg.lang === 'en' ? 'en' : 'ar', t = msg[lang] || msg.ar;
      const st = await sendPush(env, o, { title: t.title, body: t.body, tag: o.app + '-msg-' + o.msg, lang, kind: msg.kind }, 'normal');
      if (st === 404 || st === 410) await env.DB.prepare('DELETE FROM subs WHERE id = ?').bind(o.id).run();
    } catch (e) {}
  }
  // تنظيف رسائل لاشتراكات محذوفة
  await env.DB.prepare('DELETE FROM outbox WHERE sub_id NOT IN (SELECT id FROM subs)').run();
  // الإحصائيات والسجلات تنحفظ دائماً (بدون حذف تلقائي) — النسخ الاحتياطي من admin.wamdarc.com
}

/* ---------- حماية مفتاح الإدارة من التخمين ----------
   ٢٠ محاولة خاطئة من نفس الشبكة خلال ساعة ← قفل ٣٠ دقيقة لهذه الشبكة
   ١٠٠ محاولة خاطئة من أي مكان خلال ساعة ← قفل الإدارة كاملة ١٥ دقيقة (يحمي من التخمين الموزّع)
   الدخول الصحيح يصفّر عدّاد الشبكة. */
const AF = { ipMax: 20, ipLock: 30 * 60e3, allMax: 100, allLock: 15 * 60e3, win: 36e5 };
async function adminGate(req, db, check) {
  const now = Date.now();
  const raw = (req.headers.get('X-Admin-Key') || req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!raw) return 'bad';
  const ipb = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode('af:' + (req.headers.get('CF-Connecting-IP') || 'local'))));
  const ip = [...ipb.slice(0, 12)].map((b) => b.toString(16).padStart(2, '0')).join('');
  await db.prepare('CREATE TABLE IF NOT EXISTS afail (ip TEXT PRIMARY KEY, n INTEGER, last INTEGER, lock INTEGER)').run();
  const rows = (await db.prepare("SELECT ip, n, last, lock FROM afail WHERE ip IN (?, '*')").bind(ip).all()).results || [];
  if (rows.some((r) => r.lock > now)) return 'locked';
  if (await check()) {
    if (rows.some((r) => r.ip === ip)) await db.prepare('DELETE FROM afail WHERE ip=?').bind(ip).run();
    return 'ok';
  }
  const st = [];
  for (const [k, max, lock] of [[ip, AF.ipMax, AF.ipLock], ['*', AF.allMax, AF.allLock]]) {
    const r = rows.find((x) => x.ip === k);
    const n = (r && r.last > now - AF.win ? r.n : 0) + 1;
    st.push(db.prepare('INSERT INTO afail (ip, n, last, lock) VALUES (?,?,?,?) ON CONFLICT(ip) DO UPDATE SET n=excluded.n, last=excluded.last, lock=excluded.lock')
      .bind(k, n >= max ? 0 : n, now, n >= max ? now + lock : 0));
  }
  await db.batch(st);
  return 'bad';
}

export default {
  fetch: (req, env) => handle(req, env).catch(e => { console.error(e); return json({ error: 'server' }, 500); }),
  scheduled: (event, env, ctx) => ctx.waitUntil(tick(env))
};

/* للاختبار */
export { encryptPayload, vapidHeader, nextEvent, cleanCfg, buildPayload, b64u, ub64, localAt };
