(() => {
  const { useState, useEffect, useMemo } = React;
  const storage = {
    async get(key) {
      try {
        const v = localStorage.getItem(key);
        return v != null ? { key, value: v } : null;
      } catch (e) {
        return null;
      }
    },
    async set(key, value) {
      try {
        localStorage.setItem(key, value);
        return { key, value };
      } catch (e) {
        return null;
      }
    },
    async delete(key) {
      try {
        localStorage.removeItem(key);
        return { key, deleted: true };
      } catch (e) {
        return null;
      }
    }
  };
  const HR_ZONES = [
    { name: "Z1", label: "Herstel", lo: 0, hi: 0.85, hex: "#85B7EB", text: "#0C447C", bg: "#E6F1FB" },
    { name: "Z2", label: "Aerobe basis", lo: 0.85, hi: 0.89, hex: "#5DCAA5", text: "#085041", bg: "#E1F5EE" },
    { name: "Z3", label: "Tempo", lo: 0.9, hi: 0.94, hex: "#97C459", text: "#27500A", bg: "#EAF3DE" },
    { name: "Z4", label: "Sub-drempel", lo: 0.95, hi: 0.99, hex: "#EF9F27", text: "#633806", bg: "#FAEEDA" },
    { name: "Z5a", label: "Drempel", lo: 1, hi: 1.02, hex: "#F0997B", text: "#712B13", bg: "#FAECE7" },
    { name: "Z5b", label: "VO2max", lo: 1.03, hi: 1.05, hex: "#E24B4A", text: "#791F1F", bg: "#FCEBEB" },
    { name: "Z5c", label: "Anaeroob", lo: 1.06, hi: 1.1, hex: "#D4537E", text: "#72243E", bg: "#FBEAF0" }
  ];
  const PACE_ZONES = [
    { name: "Z1", lo: 1.29, hi: 1.5 },
    { name: "Z2", lo: 1.14, hi: 1.28 },
    { name: "Z3", lo: 1.06, hi: 1.13 },
    { name: "Z4", lo: 1.01, hi: 1.05 },
    { name: "Z5a", lo: 0.97, hi: 1 },
    { name: "Z5b", lo: 0.93, hi: 0.96 },
    { name: "Z5c", lo: 0.85, hi: 0.92 }
  ];
  function paceToSeconds(paceStr) {
    if (!paceStr) return 286;
    const [m, s] = paceStr.split(":").map(Number);
    return m * 60 + (s || 0);
  }
  function secondsToPace(sec) {
    if (!isFinite(sec) || sec <= 0) return "-";
    const m = Math.floor(sec / 60);
    const s = Math.round(sec - m * 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  }
  function getHRRange(lthr, zoneIdx) {
    const z = HR_ZONES[zoneIdx];
    return { lo: Math.round(lthr * z.lo), hi: Math.round(lthr * z.hi) };
  }
  function getPaceRange(ltpSec, zoneIdx, isTrail) {
    const z = PACE_ZONES[zoneIdx];
    const trailFactor = isTrail ? 1.13 : 1;
    return {
      lo: secondsToPace(ltpSec * z.lo * trailFactor),
      hi: secondsToPace(ltpSec * z.hi * trailFactor)
    };
  }
  function dateToISO(d) {
    return d.toISOString().split("T")[0];
  }
  function parseDate(s) {
    if (!s) return null;
    const d = /* @__PURE__ */ new Date(s + "T00:00:00");
    return isNaN(d.getTime()) ? null : d;
  }
  function weeksBetween(start, end) {
    const ms = end.getTime() - start.getTime();
    return Math.floor(ms / (1e3 * 60 * 60 * 24 * 7));
  }
  function getMonday(d) {
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const monday = new Date(d);
    monday.setDate(d.getDate() + diff);
    monday.setHours(0, 0, 0, 0);
    return monday;
  }
  function addDays(d, n) {
    const r = new Date(d);
    r.setDate(d.getDate() + n);
    return r;
  }
  function formatDateNL(d) {
    return d.toLocaleDateString("nl-NL", { day: "numeric", month: "short" });
  }
  const DISTANCE_PRESETS = {
    "5K": { idealWeeks: 8, basePeak: 35, longRunMax: 14, midweekLongMax: 8, isTrail: false },
    "10K": { idealWeeks: 10, basePeak: 45, longRunMax: 18, midweekLongMax: 10, isTrail: false },
    "15K": { idealWeeks: 10, basePeak: 50, longRunMax: 20, midweekLongMax: 11, isTrail: false },
    "Halve marathon": { idealWeeks: 12, basePeak: 55, longRunMax: 24, midweekLongMax: 13, isTrail: false },
    "Marathon": { idealWeeks: 16, basePeak: 70, longRunMax: 34, midweekLongMax: 16, isTrail: false },
    "15K trail": { idealWeeks: 10, basePeak: 50, longRunMax: 20, midweekLongMax: 11, isTrail: true },
    "21K trail": { idealWeeks: 12, basePeak: 55, longRunMax: 24, midweekLongMax: 13, isTrail: true },
    "28K trail": { idealWeeks: 14, basePeak: 65, longRunMax: 30, midweekLongMax: 15, isTrail: true },
    "42K trail": { idealWeeks: 16, basePeak: 75, longRunMax: 38, midweekLongMax: 18, isTrail: true },
    "50K trail": { idealWeeks: 18, basePeak: 85, longRunMax: 45, midweekLongMax: 20, isTrail: true },
    "80K ultra": { idealWeeks: 22, basePeak: 100, longRunMax: 55, midweekLongMax: 24, isTrail: true }
  };
  function getPhase(weekNum, totalWeeks) {
    const taperWeeks = totalWeeks >= 14 ? 2 : 1;
    const specificWeeks = Math.max(2, Math.round(totalWeeks * 0.2));
    const thresholdWeeks = Math.max(3, Math.round(totalWeeks * 0.25));
    const vo2Weeks = Math.max(2, Math.round(totalWeeks * 0.18));
    const baseWeeks = totalWeeks - taperWeeks - specificWeeks - thresholdWeeks - vo2Weeks;
    const w = weekNum - 1;
    if (w < baseWeeks) return { name: "BASE", idx: w, total: baseWeeks, label: "Aerobe basis" };
    if (w < baseWeeks + vo2Weeks) return { name: "VO2", idx: w - baseWeeks, total: vo2Weeks, label: "VO2max blok" };
    if (w < baseWeeks + vo2Weeks + thresholdWeeks) return { name: "THRESHOLD", idx: w - baseWeeks - vo2Weeks, total: thresholdWeeks, label: "Drempelblok" };
    if (w < baseWeeks + vo2Weeks + thresholdWeeks + specificWeeks) return { name: "SPECIFIC", idx: w - baseWeeks - vo2Weeks - thresholdWeeks, total: specificWeeks, label: "Specifiek (race-simulatie)" };
    return { name: "TAPER", idx: w - baseWeeks - vo2Weeks - thresholdWeeks - specificWeeks, total: taperWeeks, label: "Taper" };
  }
  function getWeekVolume(weekNum, totalWeeks, basePeak) {
    const phase = getPhase(weekNum, totalWeeks);
    const w = weekNum - 1;
    const isRecovery = phase.name !== "TAPER" && w > 0 && w % 4 === 3;
    let factor;
    switch (phase.name) {
      case "BASE":
        factor = 0.6 + phase.idx / Math.max(1, phase.total - 1) * 0.2;
        break;
      case "VO2":
        factor = 0.85 + phase.idx / Math.max(1, phase.total - 1) * 0.05;
        break;
      case "THRESHOLD":
        factor = 0.9 + phase.idx / Math.max(1, phase.total - 1) * 0.1;
        break;
      case "SPECIFIC":
        factor = 0.95 + phase.idx / Math.max(1, phase.total - 1) * 0.05;
        break;
      case "TAPER":
        factor = phase.total === 2 ? phase.idx === 0 ? 0.7 : 0.5 : 0.55;
        break;
      default:
        factor = 0.75;
    }
    if (isRecovery) factor *= 0.75;
    return { km: Math.round(basePeak * factor), isRecovery, phase };
  }
  function generateMonday() {
    return {
      type: "Rust",
      zone: null,
      description: "Vrij \u2014 actieve recovery optioneel",
      distance: 0,
      duration: 0,
      structure: [],
      notes: "Lichte wandeling, mobiliteit of yoga mag. Slaapkwaliteit is de prioriteit."
    };
  }
  function generateTuesday(weekVolume, isTrail, phase, preset) {
    const km = Math.max(5, Math.min(preset.midweekLongMax * 0.7, Math.round(weekVolume * 0.13)));
    if (phase.name === "TAPER") {
      return {
        type: "Korte rustige loop",
        zone: 1,
        description: `${Math.round(km * 0.6)} km Z1-Z2`,
        distance: Math.round(km * 0.6),
        duration: Math.round(km * 0.6 * 6.5),
        structure: [
          { label: "Volledig rustig", detail: `${Math.round(km * 0.6)} km op gevoel, Z1-Z2`, zone: 1 }
        ],
        notes: "Doel in taper: doorbloeding, geen training-stress. Voelt het zwaar? Stop eerder."
      };
    }
    return {
      type: "Aerobe duurloop",
      zone: 1,
      description: `${km} km Z2 + 4\xD720s strides`,
      distance: km,
      duration: km * 6,
      structure: [
        { label: "Inlopen", detail: "1 km Z1", zone: 0 },
        { label: "Hoofddeel", detail: `${km - 2} km Z2, comfortabel gesprekstempo`, zone: 1 },
        { label: "Strides", detail: "4 \xD7 20s versnellingen op vlakke ondergrond + 60s wandelen", zone: 5 },
        { label: "Uitlopen", detail: "0.5 km Z1", zone: 0 }
      ],
      notes: isTrail ? "Gemengd terrein, niet te technisch. Strides op een vlak stuk om de neuromusculaire snelheid scherp te houden." : "Strides zijn snelle versnellingen, niet sprints \u2014 focus op vorm en cadans (~180 spm)."
    };
  }
  function generateWednesday(weekVolume, isTrail, phase, preset, weekNum) {
    const totalKm = Math.max(7, Math.min(preset.midweekLongMax, Math.round(weekVolume * 0.2)));
    const blockProgress = phase.idx / Math.max(1, phase.total - 1);
    if (phase.name === "BASE") {
      if (isTrail) {
        return {
          type: "Heuvelherhalingen (kort en explosief)",
          zone: 4,
          description: `Inlopen + 8-10 \xD7 60-90s heuvel hard / afdalend rustig + uitlopen`,
          distance: totalKm,
          duration: totalKm * 6.5,
          structure: [
            { label: "Inlopen", detail: "2.5 km Z1-Z2", zone: 0 },
            { label: "Mobiliteit", detail: "4 \xD7 A-skips, B-skips, 30s heupopeners", zone: null },
            { label: "Heuvelherhalingen", detail: `${blockProgress > 0.5 ? 10 : 8} \xD7 60-90s heuvel Z4-Z5a (helling 5-10%) / rustig afdalend herstel`, zone: 4 },
            { label: "Uitlopen", detail: `${Math.max(2, totalKm - 6)} km Z1-Z2`, zone: 0 }
          ],
          notes: "Bouw trail-specifieke kracht en lopen-met-vorm bergop. Korte stappen, krachtige knieheffing. Op de afdaling herstellen, niet hard."
        };
      } else {
        return {
          type: "Aerobe duurloop met fartlek",
          zone: 2,
          description: `${totalKm} km met 6-8 \xD7 1 min surges`,
          distance: totalKm,
          duration: totalKm * 5.8,
          structure: [
            { label: "Inlopen", detail: "2 km Z1-Z2", zone: 0 },
            { label: "Hoofddeel", detail: `${totalKm - 4} km Z2 met ${blockProgress > 0.5 ? 8 : 6} \xD7 1 min Z4 / 2 min Z2 herstel`, zone: 3 },
            { label: "Uitlopen", detail: "2 km Z1", zone: 0 }
          ],
          notes: "Aerobe basis met speelse intensiteit. Niet te hard op de surges \u2014 beheerst."
        };
      }
    }
    if (phase.name === "VO2") {
      const reps = Math.max(4, 6 - Math.floor(phase.idx));
      if (isTrail) {
        return {
          type: "VO2max heuvelintervallen",
          zone: 5,
          description: `${reps} \xD7 3 min heuvel Z5b / 3 min rustig afdalend`,
          distance: totalKm,
          duration: totalKm * 6.5,
          structure: [
            { label: "Inlopen", detail: "3 km Z1-Z2 + 4 \xD7 20s versnellingen", zone: 0 },
            { label: "VO2max blok", detail: `${reps} \xD7 3 min Z5b heuvel op (5-8% helling) / 3 min Z1 afdalend herstel`, zone: 5 },
            { label: "Uitlopen", detail: `${Math.max(2, totalKm - 9)} km Z1-Z2`, zone: 0 }
          ],
          notes: `Koop-principe: hardste sessie van het blok is week 1, daarna licht afschalen. Pace: ~3K-5K wedstrijdtempo. Voelt het zwaar? Goed \u2014 dat is de bedoeling.`
        };
      } else {
        return {
          type: "VO2max intervallen",
          zone: 5,
          description: `${reps} \xD7 1000m Z5b / 90s jog`,
          distance: totalKm,
          duration: totalKm * 5.5,
          structure: [
            { label: "Inlopen", detail: "2.5 km Z1-Z2 + 4 \xD7 20s versnellingen", zone: 0 },
            { label: "VO2max blok", detail: `${reps} \xD7 1000m Z5b / 90s jog herstel`, zone: 5 },
            { label: "Uitlopen", detail: `${Math.max(2, totalKm - 8)} km Z1`, zone: 0 }
          ],
          notes: "Pace: ~3K-5K wedstrijdtempo. Hardste sessie van het blok is in week 1, daarna iets minder reps."
        };
      }
    }
    if (phase.name === "THRESHOLD") {
      const totalMin = Math.min(50, 30 + Math.floor(phase.idx * 5));
      const blockSize = blockProgress > 0.5 ? 10 : 8;
      const reps = Math.max(3, Math.round(totalMin / blockSize));
      if (isTrail) {
        return {
          type: "Cruise intervallen (drempel)",
          zone: 3,
          description: `${reps} \xD7 ${blockSize} min Z3-Z4 / ${blockSize / 2} min Z1-Z2`,
          distance: totalKm,
          duration: totalKm * 6.2,
          structure: [
            { label: "Inlopen", detail: "2.5 km Z1-Z2", zone: 0 },
            { label: "Cruise intervals", detail: `${reps} \xD7 ${blockSize} min Z3-Z4 op rollend/glooiend terrein / ${blockSize / 2} min Z1 jog herstel`, zone: 3 },
            { label: "Uitlopen", detail: `${Math.max(2, totalKm - 4 - reps * blockSize / 6)} km Z1`, zone: 0 }
          ],
          notes: `Dit is d\xE9 belangrijkste workout voor 28K+: ontwikkelt durability op race-specifieke intensiteit. Voelt comfortabel ongemakkelijk \u2014 je kunt 2-3 woorden zeggen. Loop op terrein dat lijkt op race-parcours.`
        };
      } else {
        return {
          type: "Drempeltempo",
          zone: 3,
          description: `${reps} \xD7 ${blockSize} min Z3-Z4 / ${blockSize / 2} min jog`,
          distance: totalKm,
          duration: totalKm * 5.5,
          structure: [
            { label: "Inlopen", detail: "2.5 km Z1-Z2", zone: 0 },
            { label: "Drempel intervals", detail: `${reps} \xD7 ${blockSize} min Z3-Z4 / ${blockSize / 2} min jog`, zone: 3 },
            { label: "Uitlopen", detail: `${Math.max(2, totalKm - 4 - reps * blockSize / 6)} km Z1`, zone: 0 }
          ],
          notes: "Pace: ~halve marathon tot 10K tempo. Comfortabel ongemakkelijk \u2014 je kunt 2-3 woorden zeggen tussen ademhalingen."
        };
      }
    }
    if (phase.name === "SPECIFIC") {
      if (isTrail) {
        return {
          type: "Race-pace simulatie + climbs",
          zone: 2,
          description: `${totalKm} km met 2 \xD7 lange klim op race-pace`,
          distance: totalKm,
          duration: totalKm * 6.5,
          structure: [
            { label: "Inlopen", detail: "2 km Z1-Z2", zone: 0 },
            { label: "Race-blok 1", detail: `15-20 min Z2-Z3 op gemengd terrein, inclusief 1 langere klim (5-8 min) op vermogensgevoel race-tempo`, zone: 2 },
            { label: "Hersteljog", detail: "5 min Z1-Z2", zone: 0 },
            { label: "Race-blok 2", detail: `15-20 min Z2-Z3 met 1 klim \u2014 focus: gelijkmatige inspanning, niet pace`, zone: 2 },
            { label: "Uitlopen", detail: `${Math.max(2, totalKm - 12)} km Z1`, zone: 0 }
          ],
          notes: "Hier traint je hoofd en lijf zich op het wisselende ritme van trail. Klimmen op constante inspanning, niet constante pace. Test wedstrijdvoeding (1 gel/30 min)."
        };
      } else {
        return {
          type: "Race-pace tempo",
          zone: 3,
          description: `${Math.max(8, Math.round(totalKm * 0.7))} km Z3 op doelwedstrijd-pace`,
          distance: totalKm,
          duration: totalKm * 5.3,
          structure: [
            { label: "Inlopen", detail: "2 km Z1-Z2", zone: 0 },
            { label: "Race-pace", detail: `${Math.max(8, Math.round(totalKm * 0.7))} km op doel-wedstrijdpace (~Z3)`, zone: 2 },
            { label: "Uitlopen", detail: `${Math.max(1, totalKm - 2 - Math.round(totalKm * 0.7))} km Z1`, zone: 0 }
          ],
          notes: "Cruciale workout: leer je doelwedstrijd-tempo voelen. Even-pace, geen surges."
        };
      }
    }
    return {
      type: "Korte intervallen (sharpening)",
      zone: 4,
      description: `5-6 \xD7 2 min Z4-Z5a / 2 min jog`,
      distance: Math.max(6, Math.round(totalKm * 0.6)),
      duration: Math.max(6, Math.round(totalKm * 0.6)) * 6,
      structure: [
        { label: "Inlopen", detail: "2 km Z1-Z2", zone: 0 },
        { label: "Sharpening", detail: "5 \xD7 2 min Z4-Z5a / 2 min jog herstel", zone: 4 },
        { label: "Uitlopen", detail: "1.5 km Z1", zone: 0 }
      ],
      notes: "Taper-stimulus: korte scherpe efforts om het zenuwstelsel scherp te houden zonder vermoeidheid op te bouwen."
    };
  }
  function generateThursday(phase) {
    const isTaper = phase.name === "TAPER";
    if (isTaper) {
      return {
        type: "Mobiliteit & lichte core",
        zone: null,
        description: "20-25 min mobiliteit + lichte core",
        distance: 0,
        duration: 22,
        structure: [
          { label: "Mobiliteit", detail: "10 min: heupopeners, kuiten, hamstrings, t-spine", zone: null },
          { label: "Lichte core", detail: "3 \xD7 30s plank + 2 \xD7 12 dead bugs (niet maximaal)", zone: null },
          { label: "Ademhaling", detail: "5 min box breathing (4-4-4-4)", zone: null }
        ],
        notes: "Geen zware kracht in de taper. Houd het lichaam los, niet vermoeid."
      };
    }
    return {
      type: "Krachttraining (thuis)",
      zone: null,
      description: "35-45 min loopspecifieke kracht",
      distance: 0,
      duration: 40,
      structure: [
        { label: "Warm-up", detail: "5 min: high knees, leg swings, A/B skips, glute bridges", zone: null },
        { label: "Single-leg blok (3 rondes)", detail: "10 single-leg deadlifts per been \u2192 12 Bulgarian split squats per been \u2192 30s side plank per zijde", zone: null },
        { label: "Posterior chain (3 rondes)", detail: "12 hip thrusts \u2192 15 calf raises (excentriek 3s) per been \u2192 10 single-leg glute bridges per been", zone: null },
        { label: "Core finisher", detail: "3 \xD7 12 dead bugs + 3 \xD7 30s pallof press (per zijde, met theraband of handdoek)", zone: null },
        { label: "Cooldown", detail: "5 min stretch: heupbuigers, kuiten, IT-band", zone: null }
      ],
      notes: "Trail-specifiek: single-leg dominant + posterior chain voor klim-/afdaalkracht. Eventueel rugzak met 5-8 kg voor extra weerstand bij split squats."
    };
  }
  function generateFriday(weekVolume, isTrail, phase, preset) {
    const totalKm = Math.max(7, Math.min(preset.midweekLongMax * 0.9, Math.round(weekVolume * 0.17)));
    if (phase.name === "TAPER") {
      return {
        type: "Race-pace activatie",
        zone: 2,
        description: `${Math.round(totalKm * 0.5)} km met 4 \xD7 100m strides`,
        distance: Math.round(totalKm * 0.5),
        duration: Math.round(totalKm * 0.5) * 5.5,
        structure: [
          { label: "Loopje", detail: `${Math.round(totalKm * 0.5)} km Z2`, zone: 1 },
          { label: "Strides", detail: "4 \xD7 100m race-pace + 100m wandel", zone: 4 }
        ],
        notes: "Korte activatie. Voel het wedstrijdtempo zonder energie te verbranden."
      };
    }
    if (phase.name === "BASE") {
      return {
        type: "Progressieve duurloop",
        zone: 2,
        description: `${totalKm} km opbouwend Z1 \u2192 Z2 \u2192 Z3`,
        distance: totalKm,
        duration: totalKm * 5.8,
        structure: [
          { label: "Eerste derde", detail: `${Math.round(totalKm / 3)} km Z1-Z2`, zone: 1 },
          { label: "Middelste derde", detail: `${Math.round(totalKm / 3)} km Z2`, zone: 1 },
          { label: "Laatste derde", detail: `${totalKm - 2 * Math.round(totalKm / 3)} km Z2-Z3`, zone: 2 }
        ],
        notes: "Bouwt aerobe drempel en mentale focus. Laatste km mag flink aanvoelen."
      };
    }
    if (phase.name === "VO2") {
      return {
        type: "Aerobe duurloop",
        zone: 1,
        description: `${totalKm} km Z2`,
        distance: totalKm,
        duration: totalKm * 6,
        structure: [
          { label: "Inlopen", detail: "1 km Z1", zone: 0 },
          { label: "Hoofddeel", detail: `${totalKm - 2} km Z2`, zone: 1 },
          { label: "Uitlopen", detail: "1 km Z1", zone: 0 }
        ],
        notes: "Vrijdag is aerobe stempel \u2014 geen extra kwaliteit naast de VO2 op woensdag. 80/20 distributie."
      };
    }
    if (phase.name === "THRESHOLD" || phase.name === "SPECIFIC") {
      const tempoKm = Math.max(5, Math.round(totalKm * 0.5));
      return {
        type: "Continu tempo",
        zone: 2,
        description: `${tempoKm} km continu Z3`,
        distance: totalKm,
        duration: totalKm * 5.5,
        structure: [
          { label: "Inlopen", detail: "2 km Z1-Z2", zone: 0 },
          { label: "Tempoblok", detail: `${tempoKm} km continu Z3 (halve-marathon-tempo gevoel)`, zone: 2 },
          { label: "Uitlopen", detail: `${Math.max(1, totalKm - 2 - tempoKm)} km Z1`, zone: 0 }
        ],
        notes: isTrail ? "Op verharde of half-verharde ondergrond \u2014 niet op technische trail. Pure tempo-stimulus zonder terrein-variabele." : "Comfortabel hard, gelijkmatige pace. Voel halve-marathon-tempo."
      };
    }
    return generateThursday(phase);
  }
  function generateSaturday(weekVolume, isTrail, phase, preset, weekNum) {
    let longKm;
    if (phase.name === "BASE") {
      const progress = phase.idx / Math.max(1, phase.total - 1);
      longKm = Math.round(preset.longRunMax * (0.45 + progress * 0.2));
    } else if (phase.name === "VO2") {
      longKm = Math.round(preset.longRunMax * 0.65);
    } else if (phase.name === "THRESHOLD") {
      const progress = phase.idx / Math.max(1, phase.total - 1);
      longKm = Math.round(preset.longRunMax * (0.7 + progress * 0.2));
    } else if (phase.name === "SPECIFIC") {
      longKm = preset.longRunMax;
    } else {
      longKm = Math.round(preset.longRunMax * (phase.idx === 0 ? 0.5 : 0.3));
    }
    const vol = getWeekVolume(weekNum, 100, 100);
    const isRecovery = phase.name !== "TAPER" && weekNum - 1 > 0 && (weekNum - 1) % 4 === 3;
    if (isRecovery) longKm = Math.round(longKm * 0.7);
    longKm = Math.max(8, longKm);
    if (isTrail) {
      return {
        type: phase.name === "SPECIFIC" ? "Race-specifieke lange trailduurloop" : "Lange trailduurloop",
        zone: 1,
        description: `${longKm} km trail Z1-Z2 ${phase.name === "SPECIFIC" ? "+ race-uitrusting test" : ""}`,
        distance: longKm,
        duration: longKm * 7.5,
        structure: [
          { label: "Eerste deel", detail: `${Math.round(longKm * 0.4)} km Z1-Z2 \u2014 bewust rustig starten`, zone: 1 },
          { label: "Middendeel", detail: `${Math.round(longKm * 0.4)} km Z2 \u2014 wandel klimmen >12%, focus op gelijkmatige inspanning`, zone: 1 },
          {
            label: phase.name === "SPECIFIC" ? "Race-finish simulatie" : "Laatste deel",
            detail: phase.name === "SPECIFIC" ? `${longKm - 2 * Math.round(longKm * 0.4)} km Z2-Z3 \u2014 finish sterker dan begin, race-uitrusting volledig testen` : `${longKm - 2 * Math.round(longKm * 0.4)} km Z2 \u2014 fris finishen, niet stuk`,
            zone: 2
          }
        ],
        notes: phase.name === "SPECIFIC" ? `Op N70 of vergelijkbaar terrein. Test alles: schoenen, rugzak, gels (1/30-40 min), hydratatie (~500 ml/uur), kleding. Hoogtemeters belangrijker dan pace. Dit is de generale repetitie.` : `Trail, op gemengd terrein. Hoogtemeters tellen meer dan kilometers. Eet vanaf 60 min (gel of zout). Hydratatie vanaf 30 min.`
      };
    } else {
      return {
        type: "Lange duurloop",
        zone: 1,
        description: `${longKm} km Z2${phase.name === "SPECIFIC" ? " met race-pace finish" : ""}`,
        distance: longKm,
        duration: longKm * 6,
        structure: [
          { label: "Eerste deel", detail: `${Math.round(longKm * 0.7)} km Z1-Z2`, zone: 1 },
          {
            label: phase.name === "SPECIFIC" ? "Race-pace finish" : "Tweede deel",
            detail: phase.name === "SPECIFIC" ? `${Math.round(longKm * 0.3)} km op doelwedstrijd-pace (Z2-Z3)` : `${Math.round(longKm * 0.3)} km Z2 \u2014 fris finishen`,
            zone: phase.name === "SPECIFIC" ? 2 : 1
          }
        ],
        notes: `Praat-test: korte zinnen mogelijk. Hydrateren vanaf 60 min, voeding (gel/sportdrank) vanaf 75 min.`
      };
    }
  }
  function generateSunday() {
    return {
      type: "CrossFit",
      zone: null,
      description: "WOD met vrienden",
      distance: 0,
      duration: 60,
      structure: [
        { label: "Functionele kracht", detail: "Volg de WOD \u2014 vermijd extreem hoge intensiteit op leg-WODs in piek- en racewekend", zone: null }
      ],
      notes: "Belangrijk voor sociale binding en functionele kracht. In piekweken en taper: schaal squats/box jumps terug (60-70% intensiteit). Behoud bovenlichaam en core, ontzie de benen."
    };
  }
  function generateWeek(weekNum, totalWeeks, preset) {
    const { km: weekVolume, isRecovery, phase } = getWeekVolume(weekNum, totalWeeks, preset.basePeak);
    const isTrail = preset.isTrail;
    return {
      weekNum,
      weekVolume,
      isRecovery,
      phase,
      days: {
        maandag: generateMonday(),
        dinsdag: generateTuesday(weekVolume, isTrail, phase, preset),
        woensdag: generateWednesday(weekVolume, isTrail, phase, preset, weekNum),
        donderdag: generateThursday(phase),
        vrijdag: generateFriday(weekVolume, isTrail, phase, preset),
        zaterdag: generateSaturday(weekVolume, isTrail, phase, preset, weekNum),
        zondag: generateSunday()
      }
    };
  }
  function ZoneTag({ lthr, ltpSec, isTrail, zoneIdx }) {
    if (zoneIdx === null || zoneIdx === void 0) return null;
    const hr = getHRRange(lthr, zoneIdx);
    const pace = getPaceRange(ltpSec, zoneIdx, isTrail);
    const z = HR_ZONES[zoneIdx];
    return /* @__PURE__ */ React.createElement("span", { style: {
      display: "inline-flex",
      gap: "10px",
      alignItems: "center",
      fontSize: "12px",
      color: "var(--color-text-secondary)",
      flexWrap: "wrap"
    } }, /* @__PURE__ */ React.createElement("span", { style: {
      background: z.bg,
      color: z.text,
      padding: "2px 8px",
      borderRadius: "var(--border-radius-md)",
      fontWeight: 500,
      fontSize: "11px"
    } }, z.name, " \xB7 ", z.label), /* @__PURE__ */ React.createElement("span", null, /* @__PURE__ */ React.createElement("i", { className: "ti ti-heartbeat", style: { fontSize: "13px", verticalAlign: "-2px", marginRight: "3px" }, "aria-hidden": "true" }), hr.lo, "-", hr.hi), /* @__PURE__ */ React.createElement("span", null, /* @__PURE__ */ React.createElement("i", { className: "ti ti-clock", style: { fontSize: "13px", verticalAlign: "-2px", marginRight: "3px" }, "aria-hidden": "true" }), pace.hi, "-", pace.lo, "/km"));
  }
  const DAY_NAMES = ["maandag", "dinsdag", "woensdag", "donderdag", "vrijdag", "zaterdag", "zondag"];
  function calcAvgPace(distanceKm, timeStr) {
    if (!distanceKm || !timeStr) return null;
    const parts = timeStr.split(":").map(Number);
    let totalSec;
    if (parts.length === 3) totalSec = parts[0] * 3600 + parts[1] * 60 + parts[2];
    else if (parts.length === 2) totalSec = parts[0] * 60 + parts[1];
    else return null;
    if (!isFinite(totalSec) || totalSec <= 0 || distanceKm <= 0) return null;
    const secPerKm = totalSec / distanceKm;
    return secondsToPace(secPerKm);
  }
  function timeStrToMinutes(timeStr) {
    if (!timeStr) return 0;
    const parts = timeStr.split(":").map(Number);
    if (parts.length === 3) return parts[0] * 60 + parts[1] + parts[2] / 60;
    if (parts.length === 2) return parts[0] + parts[1] / 60;
    return 0;
  }
  const RPE_LABELS = {
    1: "Heel makkelijk",
    2: "Makkelijk",
    3: "Comfortabel",
    4: "Gematigd",
    5: "Iets pittig",
    6: "Pittig",
    7: "Hard",
    8: "Heel hard",
    9: "Maximaal",
    10: "All-out"
  };
  function TrainingLogForm({ logData, onSave, onCancel, planned }) {
    const [distance, setDistance] = useState(logData?.distance || "");
    const [time, setTime] = useState(logData?.time || "");
    const [avgHR, setAvgHR] = useState(logData?.avgHR || "");
    const [maxHR, setMaxHR] = useState(logData?.maxHR || "");
    const [elevation, setElevation] = useState(logData?.elevation || "");
    const [rpe, setRpe] = useState(logData?.rpe || 5);
    const [notes, setNotes] = useState(logData?.notes || "");
    const computedPace = useMemo(() => calcAvgPace(parseFloat(distance), time), [distance, time]);
    function handleSave() {
      onSave({
        distance: distance === "" ? null : parseFloat(distance),
        time: time || null,
        avgHR: avgHR === "" ? null : parseInt(avgHR),
        maxHR: maxHR === "" ? null : parseInt(maxHR),
        elevation: elevation === "" ? null : parseInt(elevation),
        rpe: parseInt(rpe),
        notes: notes || "",
        pace: computedPace,
        loggedAt: (/* @__PURE__ */ new Date()).toISOString()
      });
    }
    return /* @__PURE__ */ React.createElement("div", { style: {
      marginTop: "12px",
      paddingTop: "12px",
      borderTop: "0.5px solid var(--color-border-tertiary)"
    } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: "12px", fontWeight: 500, marginBottom: "10px", color: "var(--color-text-secondary)" } }, /* @__PURE__ */ React.createElement("i", { className: "ti ti-edit", style: { marginRight: "4px" }, "aria-hidden": "true" }), "Hoe ging je training?"), /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "8px" } }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { style: { fontSize: "11px", color: "var(--color-text-secondary)", display: "block", marginBottom: "3px" } }, "Afstand (km) ", planned?.distance > 0 && /* @__PURE__ */ React.createElement("span", { style: { color: "var(--color-text-tertiary)" } }, "\xB7 gepland ", planned.distance)), /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "number",
        step: "0.1",
        value: distance,
        onChange: (e) => setDistance(e.target.value),
        placeholder: "0.0",
        style: { width: "100%" }
      }
    )), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { style: { fontSize: "11px", color: "var(--color-text-secondary)", display: "block", marginBottom: "3px" } }, "Tijd (mm:ss of hh:mm:ss)"), /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "text",
        value: time,
        onChange: (e) => setTime(e.target.value),
        placeholder: "45:30",
        style: { width: "100%" }
      }
    ))), computedPace && /* @__PURE__ */ React.createElement("div", { style: { fontSize: "11px", color: "var(--color-text-tertiary)", marginBottom: "8px" } }, /* @__PURE__ */ React.createElement("i", { className: "ti ti-calculator", style: { marginRight: "3px" }, "aria-hidden": "true" }), "Gemiddeld tempo: ", /* @__PURE__ */ React.createElement("strong", { style: { fontWeight: 500, color: "var(--color-text-secondary)" } }, computedPace, "/km")), /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px", marginBottom: "8px" } }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { style: { fontSize: "11px", color: "var(--color-text-secondary)", display: "block", marginBottom: "3px" } }, "Gem. HR"), /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "number",
        value: avgHR,
        onChange: (e) => setAvgHR(e.target.value),
        placeholder: "155",
        style: { width: "100%" }
      }
    )), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { style: { fontSize: "11px", color: "var(--color-text-secondary)", display: "block", marginBottom: "3px" } }, "Piek HR"), /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "number",
        value: maxHR,
        onChange: (e) => setMaxHR(e.target.value),
        placeholder: "178",
        style: { width: "100%" }
      }
    )), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { style: { fontSize: "11px", color: "var(--color-text-secondary)", display: "block", marginBottom: "3px" } }, "Hoogtemeters"), /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "number",
        value: elevation,
        onChange: (e) => setElevation(e.target.value),
        placeholder: "120",
        style: { width: "100%" }
      }
    ))), /* @__PURE__ */ React.createElement("div", { style: { marginBottom: "8px" } }, /* @__PURE__ */ React.createElement("label", { style: { fontSize: "11px", color: "var(--color-text-secondary)", display: "block", marginBottom: "3px" } }, "Gevoel (RPE 1-10): ", /* @__PURE__ */ React.createElement("strong", { style: { fontWeight: 500, color: "var(--color-text-primary)" } }, rpe), " \u2014 ", RPE_LABELS[rpe]), /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "range",
        min: "1",
        max: "10",
        step: "1",
        value: rpe,
        onChange: (e) => setRpe(e.target.value),
        style: { width: "100%" }
      }
    )), /* @__PURE__ */ React.createElement("div", { style: { marginBottom: "12px" } }, /* @__PURE__ */ React.createElement("label", { style: { fontSize: "11px", color: "var(--color-text-secondary)", display: "block", marginBottom: "3px" } }, "Notitie"), /* @__PURE__ */ React.createElement(
      "textarea",
      {
        value: notes,
        onChange: (e) => setNotes(e.target.value),
        placeholder: "Hoe voelde het? Bijzonderheden?",
        rows: 2,
        style: {
          width: "100%",
          fontFamily: "var(--font-sans)",
          fontSize: "13px",
          padding: "6px 10px",
          border: "0.5px solid var(--color-border-tertiary)",
          borderRadius: "var(--border-radius-md)",
          background: "var(--color-background-primary)",
          color: "var(--color-text-primary)",
          resize: "vertical"
        }
      }
    )), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: "8px" } }, /* @__PURE__ */ React.createElement(
      "button",
      {
        onClick: handleSave,
        style: {
          flex: 1,
          background: "var(--color-background-success)",
          color: "var(--color-text-success)",
          fontWeight: 500,
          fontSize: "13px"
        }
      },
      /* @__PURE__ */ React.createElement("i", { className: "ti ti-device-floppy", style: { marginRight: "4px" }, "aria-hidden": "true" }),
      "Opslaan"
    ), /* @__PURE__ */ React.createElement("button", { onClick: onCancel, style: { fontSize: "13px" } }, "Annuleer")));
  }
  function LogSummary({ log, planned, lthr }) {
    const diffPct = planned?.distance > 0 && log.distance ? Math.round((log.distance - planned.distance) / planned.distance * 100) : null;
    const drift = log.maxHR && log.avgHR ? log.maxHR - log.avgHR : null;
    const hrAsPctLthr = log.avgHR && lthr ? Math.round(log.avgHR / lthr * 100) : null;
    return /* @__PURE__ */ React.createElement("div", { style: {
      marginTop: "10px",
      padding: "10px 12px",
      background: "var(--color-background-secondary)",
      borderRadius: "var(--border-radius-md)",
      fontSize: "12px"
    } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: "11px", fontWeight: 500, color: "var(--color-text-secondary)", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.5px" } }, "Geregistreerd"), /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: "10px" } }, log.distance != null && /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { style: { color: "var(--color-text-tertiary)", fontSize: "10px" } }, "Afstand"), /* @__PURE__ */ React.createElement("div", { style: { fontWeight: 500 } }, log.distance, " km", diffPct !== null && diffPct !== 0 && /* @__PURE__ */ React.createElement("span", { style: {
      marginLeft: "4px",
      fontSize: "10px",
      color: Math.abs(diffPct) > 15 ? "var(--color-text-warning)" : "var(--color-text-tertiary)"
    } }, "(", diffPct > 0 ? "+" : "", diffPct, "%)"))), log.time && /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { style: { color: "var(--color-text-tertiary)", fontSize: "10px" } }, "Tijd"), /* @__PURE__ */ React.createElement("div", { style: { fontWeight: 500 } }, log.time)), log.pace && /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { style: { color: "var(--color-text-tertiary)", fontSize: "10px" } }, "Pace"), /* @__PURE__ */ React.createElement("div", { style: { fontWeight: 500 } }, log.pace, "/km")), log.avgHR != null && /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { style: { color: "var(--color-text-tertiary)", fontSize: "10px" } }, "Gem. HR"), /* @__PURE__ */ React.createElement("div", { style: { fontWeight: 500 } }, log.avgHR, hrAsPctLthr && /* @__PURE__ */ React.createElement("span", { style: { color: "var(--color-text-tertiary)", fontSize: "10px", marginLeft: "3px" } }, "(", hrAsPctLthr, "% LTHR)"))), log.maxHR != null && /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { style: { color: "var(--color-text-tertiary)", fontSize: "10px" } }, "Piek HR"), /* @__PURE__ */ React.createElement("div", { style: { fontWeight: 500 } }, log.maxHR)), log.elevation != null && /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { style: { color: "var(--color-text-tertiary)", fontSize: "10px" } }, "Hoogtemeters"), /* @__PURE__ */ React.createElement("div", { style: { fontWeight: 500 } }, log.elevation, " m")), log.rpe != null && /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { style: { color: "var(--color-text-tertiary)", fontSize: "10px" } }, "Gevoel (RPE)"), /* @__PURE__ */ React.createElement("div", { style: { fontWeight: 500 } }, log.rpe, "/10 ", /* @__PURE__ */ React.createElement("span", { style: { color: "var(--color-text-tertiary)", fontSize: "10px" } }, RPE_LABELS[log.rpe])))), log.notes && /* @__PURE__ */ React.createElement("div", { style: {
      marginTop: "8px",
      paddingTop: "8px",
      borderTop: "0.5px solid var(--color-border-tertiary)",
      color: "var(--color-text-secondary)",
      fontStyle: "italic",
      fontSize: "12px"
    } }, '"', log.notes, '"'));
  }
  function DayCard({ dayName, dayDate, dayData, lthr, ltpSec, isTrail: scheduleIsTrail, completed, onToggleComplete, isToday, logData, onSaveLog, onDeleteLog, terrainOverride, onSetTerrainOverride }) {
    const [expanded, setExpanded] = useState(false);
    const [logFormOpen, setLogFormOpen] = useState(false);
    const isRestDay = ["Rust", "CrossFit"].some((t) => dayData.type.includes(t)) || dayData.type.includes("Krachttraining") || dayData.type.includes("Mobiliteit");
    const hasLog = logData && Object.keys(logData).length > 0;
    const effectiveIsTrail = terrainOverride === "trail" ? true : terrainOverride === "weg" ? false : scheduleIsTrail;
    const isTrail = effectiveIsTrail;
    const hasOverride = terrainOverride === "trail" || terrainOverride === "weg";
    return /* @__PURE__ */ React.createElement("div", { style: {
      background: "var(--color-background-primary)",
      border: isToday ? "0.5px solid var(--color-border-info)" : "0.5px solid var(--color-border-tertiary)",
      borderLeft: isToday ? "3px solid var(--color-text-info)" : "0.5px solid var(--color-border-tertiary)",
      borderRadius: "var(--border-radius-lg)",
      padding: "14px 16px",
      marginBottom: "8px",
      opacity: completed ? 0.65 : 1
    } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px" } }, /* @__PURE__ */ React.createElement("div", { style: { flex: 1, minWidth: 0 } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px", flexWrap: "wrap" } }, /* @__PURE__ */ React.createElement("span", { style: {
      fontSize: "11px",
      fontWeight: 500,
      color: "var(--color-text-tertiary)",
      textTransform: "uppercase",
      letterSpacing: "0.5px",
      minWidth: "70px"
    } }, dayName), dayDate && /* @__PURE__ */ React.createElement("span", { style: { fontSize: "11px", color: "var(--color-text-tertiary)" } }, formatDateNL(dayDate)), isToday && /* @__PURE__ */ React.createElement("span", { style: {
      fontSize: "10px",
      background: "var(--color-background-info)",
      color: "var(--color-text-info)",
      padding: "1px 6px",
      borderRadius: "var(--border-radius-md)",
      fontWeight: 500
    } }, "vandaag")), /* @__PURE__ */ React.createElement("div", { style: { fontSize: "15px", fontWeight: 500, marginBottom: "4px" } }, dayData.type), /* @__PURE__ */ React.createElement("div", { style: { fontSize: "13px", color: "var(--color-text-secondary)", marginBottom: "6px" } }, dayData.description, dayData.distance > 0 && /* @__PURE__ */ React.createElement("span", { style: { marginLeft: "8px", color: "var(--color-text-tertiary)" } }, "\xB7 ", dayData.distance, " km \xB7 ~", dayData.duration, " min")), !isRestDay && dayData.zone !== null && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(ZoneTag, { lthr, ltpSec, isTrail, zoneIdx: dayData.zone }), /* @__PURE__ */ React.createElement("div", { style: { marginTop: "6px", display: "flex", alignItems: "center", gap: "4px" } }, /* @__PURE__ */ React.createElement("span", { style: { fontSize: "10px", color: "var(--color-text-tertiary)", marginRight: "2px" } }, "Terrein:"), /* @__PURE__ */ React.createElement(
      "button",
      {
        onClick: () => onSetTerrainOverride(isTrail === false && !hasOverride ? null : "weg"),
        style: {
          padding: "2px 8px",
          fontSize: "11px",
          minHeight: "auto",
          minWidth: "auto",
          background: !isTrail ? "var(--color-background-info)" : "transparent",
          color: !isTrail ? "var(--color-text-info)" : "var(--color-text-tertiary)",
          fontWeight: !isTrail ? 500 : 400,
          border: "0.5px solid var(--color-border-tertiary)"
        },
        "aria-label": "Markeer als wegtraining"
      },
      /* @__PURE__ */ React.createElement("i", { className: "ti ti-road", style: { fontSize: "11px", marginRight: "3px" }, "aria-hidden": "true" }),
      "weg"
    ), /* @__PURE__ */ React.createElement(
      "button",
      {
        onClick: () => onSetTerrainOverride(isTrail === true && !hasOverride ? null : "trail"),
        style: {
          padding: "2px 8px",
          fontSize: "11px",
          minHeight: "auto",
          minWidth: "auto",
          background: isTrail ? "var(--color-background-info)" : "transparent",
          color: isTrail ? "var(--color-text-info)" : "var(--color-text-tertiary)",
          fontWeight: isTrail ? 500 : 400,
          border: "0.5px solid var(--color-border-tertiary)"
        },
        "aria-label": "Markeer als trailtraining"
      },
      /* @__PURE__ */ React.createElement("i", { className: "ti ti-mountain", style: { fontSize: "11px", marginRight: "3px" }, "aria-hidden": "true" }),
      "trail"
    ), hasOverride && /* @__PURE__ */ React.createElement(
      "button",
      {
        onClick: () => onSetTerrainOverride(null),
        style: {
          padding: "2px 6px",
          fontSize: "10px",
          minHeight: "auto",
          minWidth: "auto",
          color: "var(--color-text-tertiary)",
          border: "none",
          background: "transparent"
        },
        "aria-label": "Reset naar schema",
        title: "Reset naar schema-standaard"
      },
      /* @__PURE__ */ React.createElement("i", { className: "ti ti-refresh", style: { fontSize: "10px" }, "aria-hidden": "true" })
    )))), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: "6px", flexShrink: 0 } }, !isRestDay && /* @__PURE__ */ React.createElement(
      "button",
      {
        onClick: () => setLogFormOpen(!logFormOpen),
        style: {
          padding: "6px 10px",
          fontSize: "12px",
          minWidth: "auto",
          background: hasLog ? "var(--color-background-info)" : "transparent",
          color: hasLog ? "var(--color-text-info)" : "var(--color-text-secondary)",
          border: "0.5px solid var(--color-border-tertiary)"
        },
        "aria-label": hasLog ? "Bewerk log" : "Voeg log toe",
        title: hasLog ? "Bewerk training-log" : "Log je training"
      },
      /* @__PURE__ */ React.createElement("i", { className: hasLog ? "ti ti-pencil" : "ti ti-plus", "aria-hidden": "true" })
    ), /* @__PURE__ */ React.createElement(
      "button",
      {
        onClick: onToggleComplete,
        style: {
          padding: "6px 10px",
          fontSize: "12px",
          minWidth: "auto",
          background: completed ? "var(--color-background-success)" : "transparent",
          color: completed ? "var(--color-text-success)" : "var(--color-text-secondary)",
          border: "0.5px solid var(--color-border-tertiary)"
        },
        "aria-label": completed ? "Markeer onvoltooid" : "Markeer voltooid"
      },
      /* @__PURE__ */ React.createElement("i", { className: completed ? "ti ti-check" : "ti ti-circle", "aria-hidden": "true" })
    ), dayData.structure && dayData.structure.length > 0 && /* @__PURE__ */ React.createElement(
      "button",
      {
        onClick: () => setExpanded(!expanded),
        style: { padding: "6px 10px", fontSize: "12px", minWidth: "auto" },
        "aria-label": expanded ? "Inklappen" : "Uitklappen"
      },
      /* @__PURE__ */ React.createElement("i", { className: expanded ? "ti ti-chevron-up" : "ti ti-chevron-down", "aria-hidden": "true" })
    ))), hasLog && !logFormOpen && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(LogSummary, { log: logData, planned: dayData, lthr }), /* @__PURE__ */ React.createElement(
      "button",
      {
        onClick: onDeleteLog,
        style: {
          marginTop: "6px",
          fontSize: "10px",
          padding: "3px 8px",
          color: "var(--color-text-tertiary)",
          border: "none",
          background: "transparent"
        }
      },
      /* @__PURE__ */ React.createElement("i", { className: "ti ti-trash", style: { marginRight: "3px" }, "aria-hidden": "true" }),
      "Verwijder log"
    )), logFormOpen && /* @__PURE__ */ React.createElement(
      TrainingLogForm,
      {
        logData,
        planned: dayData,
        onSave: (log) => {
          onSaveLog(log);
          setLogFormOpen(false);
        },
        onCancel: () => setLogFormOpen(false)
      }
    ), expanded && dayData.structure.length > 0 && /* @__PURE__ */ React.createElement("div", { style: {
      marginTop: "12px",
      paddingTop: "12px",
      borderTop: "0.5px solid var(--color-border-tertiary)"
    } }, dayData.structure.map((s, i) => /* @__PURE__ */ React.createElement("div", { key: i, style: { marginBottom: "10px", fontSize: "13px" } }, /* @__PURE__ */ React.createElement("div", { style: { fontWeight: 500, marginBottom: "2px" } }, s.label), /* @__PURE__ */ React.createElement("div", { style: { color: "var(--color-text-secondary)", marginBottom: "4px" } }, s.detail), s.zone !== null && s.zone !== void 0 && /* @__PURE__ */ React.createElement(ZoneTag, { lthr, ltpSec, isTrail, zoneIdx: s.zone }))), dayData.notes && /* @__PURE__ */ React.createElement("div", { style: {
      marginTop: "10px",
      padding: "10px 12px",
      background: "var(--color-background-secondary)",
      borderRadius: "var(--border-radius-md)",
      fontSize: "12px",
      color: "var(--color-text-secondary)",
      fontStyle: "italic"
    } }, /* @__PURE__ */ React.createElement("i", { className: "ti ti-bulb", style: { marginRight: "6px" }, "aria-hidden": "true" }), dayData.notes)));
  }
  const PHASE_COLORS = {
    BASE: { bg: "#E6F1FB", text: "#0C447C" },
    VO2: { bg: "#FCEBEB", text: "#791F1F" },
    THRESHOLD: { bg: "#FAEEDA", text: "#633806" },
    SPECIFIC: { bg: "#FBEAF0", text: "#72243E" },
    TAPER: { bg: "#E1F5EE", text: "#085041" }
  };
  function WeekStatsFromLogs({ logs, activeWeek, lthr }) {
    const weekLogs = useMemo(() => {
      return DAY_NAMES.map((d) => logs[`w${activeWeek}-${d}`]).filter((l) => l && Object.keys(l).length > 0);
    }, [logs, activeWeek]);
    if (weekLogs.length === 0) return null;
    const totalKm = weekLogs.reduce((s, l) => s + (l.distance || 0), 0);
    const totalMin = weekLogs.reduce((s, l) => s + timeStrToMinutes(l.time), 0);
    const totalElev = weekLogs.reduce((s, l) => s + (l.elevation || 0), 0);
    const hrLogs = weekLogs.filter((l) => l.avgHR);
    const avgHR = hrLogs.length ? Math.round(hrLogs.reduce((s, l) => s + l.avgHR, 0) / hrLogs.length) : null;
    const rpeLogs = weekLogs.filter((l) => l.rpe);
    const avgRpe = rpeLogs.length ? (rpeLogs.reduce((s, l) => s + l.rpe, 0) / rpeLogs.length).toFixed(1) : null;
    return /* @__PURE__ */ React.createElement("div", { style: {
      marginTop: "20px",
      padding: "14px 16px",
      background: "var(--color-background-primary)",
      border: "0.5px solid var(--color-border-tertiary)",
      borderRadius: "var(--border-radius-lg)"
    } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: "12px", fontWeight: 500, color: "var(--color-text-secondary)", marginBottom: "10px", textTransform: "uppercase", letterSpacing: "0.5px" } }, /* @__PURE__ */ React.createElement("i", { className: "ti ti-chart-bar", style: { marginRight: "4px" }, "aria-hidden": "true" }), "Deze week (uit logs)"), /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(90px, 1fr))", gap: "12px" } }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { style: { fontSize: "11px", color: "var(--color-text-tertiary)" } }, "Totaal"), /* @__PURE__ */ React.createElement("div", { style: { fontSize: "18px", fontWeight: 500 } }, totalKm.toFixed(1), " km")), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { style: { fontSize: "11px", color: "var(--color-text-tertiary)" } }, "Tijd"), /* @__PURE__ */ React.createElement("div", { style: { fontSize: "18px", fontWeight: 500 } }, Math.floor(totalMin / 60), "u ", Math.round(totalMin % 60), "m")), totalElev > 0 && /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { style: { fontSize: "11px", color: "var(--color-text-tertiary)" } }, "Hoogtemeters"), /* @__PURE__ */ React.createElement("div", { style: { fontSize: "18px", fontWeight: 500 } }, totalElev, " m")), avgHR && /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { style: { fontSize: "11px", color: "var(--color-text-tertiary)" } }, "Gem. HR"), /* @__PURE__ */ React.createElement("div", { style: { fontSize: "18px", fontWeight: 500 } }, avgHR)), avgRpe && /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { style: { fontSize: "11px", color: "var(--color-text-tertiary)" } }, "Gem. RPE"), /* @__PURE__ */ React.createElement("div", { style: { fontSize: "18px", fontWeight: 500 } }, avgRpe)), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { style: { fontSize: "11px", color: "var(--color-text-tertiary)" } }, "Sessies"), /* @__PURE__ */ React.createElement("div", { style: { fontSize: "18px", fontWeight: 500 } }, weekLogs.length))));
  }
  function TrainingTrend({ logs, totalWeeks, lthr }) {
    const weekData = useMemo(() => {
      const data = [];
      for (let w = 1; w <= totalWeeks; w++) {
        const wkLogs = DAY_NAMES.map((d) => logs[`w${w}-${d}`]).filter((l) => l && Object.keys(l).length > 0);
        const km = wkLogs.reduce((s, l) => s + (l.distance || 0), 0);
        const hrLogs = wkLogs.filter((l) => l.avgHR);
        const avgHR = hrLogs.length ? hrLogs.reduce((s, l) => s + l.avgHR, 0) / hrLogs.length : null;
        data.push({ week: w, km, avgHR, sessions: wkLogs.length });
      }
      return data;
    }, [logs, totalWeeks]);
    const hasData = weekData.some((d) => d.sessions > 0);
    if (!hasData) return null;
    const maxKm = Math.max(...weekData.map((d) => d.km), 10);
    const hrValues = weekData.filter((d) => d.avgHR).map((d) => d.avgHR);
    const minHR = hrValues.length ? Math.min(...hrValues) - 5 : 0;
    const maxHR = hrValues.length ? Math.max(...hrValues) + 5 : 0;
    return /* @__PURE__ */ React.createElement("details", { style: { marginTop: "12px" } }, /* @__PURE__ */ React.createElement("summary", { style: {
      fontSize: "13px",
      color: "var(--color-text-secondary)",
      cursor: "pointer",
      padding: "8px 0"
    } }, /* @__PURE__ */ React.createElement("i", { className: "ti ti-trending-up", style: { marginRight: "6px" }, "aria-hidden": "true" }), "Trend over alle weken"), /* @__PURE__ */ React.createElement("div", { style: {
      marginTop: "8px",
      padding: "14px 16px",
      background: "var(--color-background-secondary)",
      borderRadius: "var(--border-radius-md)"
    } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: "11px", color: "var(--color-text-tertiary)", marginBottom: "10px" } }, "Weekvolume (balken) en gem. weekhartslag (lijn)."), /* @__PURE__ */ React.createElement("div", { style: {
      display: "grid",
      gridTemplateColumns: `repeat(${totalWeeks}, minmax(0, 1fr))`,
      gap: "2px",
      alignItems: "end",
      height: "80px",
      marginBottom: "6px",
      position: "relative"
    } }, weekData.map((d) => /* @__PURE__ */ React.createElement(
      "div",
      {
        key: d.week,
        title: `Week ${d.week}: ${d.km.toFixed(1)} km${d.avgHR ? ", gem HR " + Math.round(d.avgHR) : ""}`,
        style: {
          background: d.km > 0 ? "var(--color-text-info)" : "transparent",
          opacity: d.km > 0 ? 0.6 : 0,
          height: `${d.km / maxKm * 100}%`,
          minHeight: d.km > 0 ? "2px" : "0",
          borderRadius: "1px 1px 0 0"
        }
      }
    )), hrValues.length > 1 && /* @__PURE__ */ React.createElement(
      "svg",
      {
        style: {
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none"
        },
        viewBox: `0 0 ${totalWeeks} 100`,
        preserveAspectRatio: "none"
      },
      /* @__PURE__ */ React.createElement(
        "polyline",
        {
          fill: "none",
          stroke: "#D85A30",
          strokeWidth: "0.8",
          vectorEffect: "non-scaling-stroke",
          points: weekData.map((d, i) => {
            if (!d.avgHR) return null;
            const x = i + 0.5;
            const y = 100 - (d.avgHR - minHR) / (maxHR - minHR) * 100;
            return `${x},${y}`;
          }).filter((p) => p).join(" ")
        }
      ),
      weekData.map((d, i) => {
        if (!d.avgHR) return null;
        const x = i + 0.5;
        const y = 100 - (d.avgHR - minHR) / (maxHR - minHR) * 100;
        return /* @__PURE__ */ React.createElement("circle", { key: i, cx: x, cy: y, r: "0.6", fill: "#D85A30", vectorEffect: "non-scaling-stroke" });
      })
    )), /* @__PURE__ */ React.createElement("div", { style: {
      display: "grid",
      gridTemplateColumns: `repeat(${totalWeeks}, minmax(0, 1fr))`,
      gap: "2px",
      fontSize: "9px",
      color: "var(--color-text-tertiary)",
      textAlign: "center"
    } }, weekData.map((d) => /* @__PURE__ */ React.createElement("div", { key: d.week }, d.week % 2 === 1 || d.week === totalWeeks ? d.week : ""))), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: "12px", marginTop: "10px", fontSize: "10px", color: "var(--color-text-secondary)" } }, /* @__PURE__ */ React.createElement("span", null, /* @__PURE__ */ React.createElement("span", { style: { display: "inline-block", width: "10px", height: "10px", background: "var(--color-text-info)", opacity: 0.6, marginRight: "4px", verticalAlign: "-1px" } }), "Volume (km/wk)"), hrValues.length > 0 && /* @__PURE__ */ React.createElement("span", null, /* @__PURE__ */ React.createElement("span", { style: { display: "inline-block", width: "10px", height: "2px", background: "#D85A30", marginRight: "4px", verticalAlign: "3px" } }), "Gem. HR"))));
  }
  function App() {
    const today = useMemo(() => {
      const t = /* @__PURE__ */ new Date();
      t.setHours(0, 0, 0, 0);
      return t;
    }, []);
    const defaultRaceDate = useMemo(() => {
      let d = new Date(today);
      d.setDate(today.getDate() + 14 * 7);
      while (d.getDay() !== 6) d.setDate(d.getDate() + 1);
      return dateToISO(d);
    }, [today]);
    const [distance, setDistance] = useState("28K trail");
    const [raceDate, setRaceDate] = useState(defaultRaceDate);
    const [lthr, setLthr] = useState(177);
    const [lthrInput, setLthrInput] = useState("177");
    const [ltpStr, setLtpStr] = useState("4:46");
    const [completed, setCompleted] = useState({});
    const [logs, setLogs] = useState({});
    const [terrainOverrides, setTerrainOverrides] = useState({});
    const [activeWeek, setActiveWeek] = useState(1);
    const [loaded, setLoaded] = useState(false);
    useEffect(() => {
      (async () => {
        try {
          const r = await storage.get("training_state_v3");
          if (r && r.value) {
            const s = JSON.parse(r.value);
            if (s.distance) setDistance(s.distance);
            if (s.raceDate) setRaceDate(s.raceDate);
            if (s.lthr) {
              setLthr(s.lthr);
              setLthrInput(String(s.lthr));
            }
            if (s.ltpStr) setLtpStr(s.ltpStr);
            if (s.completed) setCompleted(s.completed);
            if (s.logs) setLogs(s.logs);
            if (s.terrainOverrides) setTerrainOverrides(s.terrainOverrides);
            if (s.activeWeek) setActiveWeek(s.activeWeek);
          } else {
            const oldR = await storage.get("training_state_v2");
            if (oldR && oldR.value) {
              const s = JSON.parse(oldR.value);
              if (s.distance) setDistance(s.distance);
              if (s.raceDate) setRaceDate(s.raceDate);
              if (s.lthr) {
                setLthr(s.lthr);
                setLthrInput(String(s.lthr));
              }
              if (s.ltpStr) setLtpStr(s.ltpStr);
              if (s.completed) setCompleted(s.completed);
              if (s.activeWeek) setActiveWeek(s.activeWeek);
            }
          }
        } catch (e) {
        }
        setLoaded(true);
      })();
    }, []);
    useEffect(() => {
      if (!loaded) return;
      (async () => {
        try {
          await storage.set("training_state_v3", JSON.stringify({
            distance,
            raceDate,
            lthr,
            ltpStr,
            completed,
            logs,
            terrainOverrides,
            activeWeek
          }));
        } catch (e) {
        }
      })();
    }, [distance, raceDate, lthr, ltpStr, completed, logs, terrainOverrides, activeWeek, loaded]);
    const ltpSec = useMemo(() => paceToSeconds(ltpStr), [ltpStr]);
    const preset = DISTANCE_PRESETS[distance] || DISTANCE_PRESETS["28K trail"];
    const isTrail = preset.isTrail;
    const { totalWeeks, currentWeekFromDate, racePassed, startMonday } = useMemo(() => {
      const race = parseDate(raceDate);
      if (!race) return { totalWeeks: preset.idealWeeks, currentWeekFromDate: 1, racePassed: false, startMonday: today };
      const todayMonday = getMonday(today);
      const raceMonday = getMonday(race);
      const weeksUntil = weeksBetween(todayMonday, raceMonday) + 1;
      if (weeksUntil <= 0) {
        return { totalWeeks: preset.idealWeeks, currentWeekFromDate: preset.idealWeeks, racePassed: true, startMonday: todayMonday };
      }
      const total = Math.max(4, weeksUntil);
      const startMon = new Date(todayMonday);
      return { totalWeeks: total, currentWeekFromDate: total - weeksUntil + 1, racePassed: false, startMonday: startMon };
    }, [raceDate, preset.idealWeeks, today]);
    useEffect(() => {
      if (loaded && currentWeekFromDate >= 1 && currentWeekFromDate <= totalWeeks) {
        setActiveWeek(currentWeekFromDate);
      }
    }, [raceDate, distance]);
    const week = useMemo(
      () => generateWeek(activeWeek, totalWeeks, preset),
      [activeWeek, totalWeeks, preset]
    );
    const allDistances = Object.keys(DISTANCE_PRESETS);
    const weekDates = useMemo(() => {
      if (!startMonday) return {};
      const race = parseDate(raceDate);
      if (!race) return {};
      const raceMonday = getMonday(race);
      const week1Monday = addDays(raceMonday, -7 * (totalWeeks - 1));
      const activeWeekMonday = addDays(week1Monday, 7 * (activeWeek - 1));
      const dates = {};
      DAY_NAMES.forEach((d, i) => {
        dates[d] = addDays(activeWeekMonday, i);
      });
      return dates;
    }, [raceDate, totalWeeks, activeWeek]);
    const totalCompleted = Object.values(completed).filter(Boolean).length;
    const totalWorkouts = totalWeeks * 7;
    const weekCompleted = DAY_NAMES.filter((d) => completed[`w${activeWeek}-${d}`]).length;
    const totalLogged = Object.keys(logs).filter((k) => logs[k] && Object.keys(logs[k]).length > 0).length;
    function toggleComplete(day) {
      const key = `w${activeWeek}-${day}`;
      setCompleted((prev) => ({ ...prev, [key]: !prev[key] }));
    }
    function saveLog(day, logData) {
      const key = `w${activeWeek}-${day}`;
      setLogs((prev) => ({ ...prev, [key]: logData }));
      setCompleted((prev) => ({ ...prev, [key]: true }));
    }
    function deleteLog(day) {
      if (confirm("Log verwijderen voor deze training?")) {
        const key = `w${activeWeek}-${day}`;
        setLogs((prev) => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
      }
    }
    function setTerrainOverride(day, value) {
      const key = `w${activeWeek}-${day}`;
      setTerrainOverrides((prev) => {
        const next = { ...prev };
        if (value === null) {
          delete next[key];
        } else {
          next[key] = value;
        }
        return next;
      });
    }
    function resetProgress() {
      if (confirm("Weet je zeker dat je alle voortgang en logs wilt wissen?")) {
        setCompleted({});
        setLogs({});
        setTerrainOverrides({});
        setActiveWeek(currentWeekFromDate || 1);
      }
    }
    function jumpToToday() {
      if (currentWeekFromDate >= 1 && currentWeekFromDate <= totalWeeks) {
        setActiveWeek(currentWeekFromDate);
      }
    }
    const todayISO = dateToISO(today);
    const phase = week.phase;
    const phaseColor = PHASE_COLORS[phase.name] || PHASE_COLORS.BASE;
    return /* @__PURE__ */ React.createElement("div", { style: { padding: "1rem 0", fontFamily: "var(--font-sans)" } }, /* @__PURE__ */ React.createElement("h2", { className: "sr-only" }, "Trainingsplanner voor hardlopen op basis van wedstrijddatum en lactaatdrempel"), /* @__PURE__ */ React.createElement("div", { style: {
      background: "var(--color-background-secondary)",
      borderRadius: "var(--border-radius-lg)",
      padding: "16px",
      marginBottom: "16px"
    } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: "13px", fontWeight: 500, marginBottom: "12px", color: "var(--color-text-secondary)" } }, "INSTELLINGEN"), /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" } }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { style: { fontSize: "12px", color: "var(--color-text-secondary)", display: "block", marginBottom: "4px" } }, "Wedstrijd"), /* @__PURE__ */ React.createElement("select", { value: distance, onChange: (e) => setDistance(e.target.value), style: { width: "100%" } }, /* @__PURE__ */ React.createElement("optgroup", { label: "Weg" }, allDistances.filter((d) => !DISTANCE_PRESETS[d].isTrail).map((d) => /* @__PURE__ */ React.createElement("option", { key: d, value: d }, d))), /* @__PURE__ */ React.createElement("optgroup", { label: "Trail" }, allDistances.filter((d) => DISTANCE_PRESETS[d].isTrail).map((d) => /* @__PURE__ */ React.createElement("option", { key: d, value: d }, d))))), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { style: { fontSize: "12px", color: "var(--color-text-secondary)", display: "block", marginBottom: "4px" } }, "Wedstrijddatum"), /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "date",
        value: raceDate,
        onChange: (e) => setRaceDate(e.target.value),
        min: todayISO,
        style: { width: "100%" }
      }
    ))), /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" } }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { style: { fontSize: "12px", color: "var(--color-text-secondary)", display: "block", marginBottom: "4px" } }, "LTHR (bpm)"), /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "number",
        inputMode: "numeric",
        value: lthrInput,
        onChange: (e) => {
          const v = e.target.value;
          setLthrInput(v);
          const n = parseInt(v, 10);
          if (isFinite(n) && n >= 120 && n <= 220) {
            setLthr(n);
          }
        },
        onBlur: () => {
          const n = parseInt(lthrInput, 10);
          if (!isFinite(n)) {
            setLthrInput(String(lthr));
          } else {
            const clamped = Math.max(120, Math.min(220, n));
            setLthr(clamped);
            setLthrInput(String(clamped));
          }
        },
        min: 120,
        max: 220,
        style: { width: "100%" }
      }
    )), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { style: { fontSize: "12px", color: "var(--color-text-secondary)", display: "block", marginBottom: "4px" } }, "Drempelpace (min:sec/km)"), /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "text",
        value: ltpStr,
        onChange: (e) => setLtpStr(e.target.value),
        placeholder: "4:46",
        style: { width: "100%" }
      }
    ))), /* @__PURE__ */ React.createElement("div", { style: { marginTop: "10px", fontSize: "11px", color: "var(--color-text-tertiary)" } }, /* @__PURE__ */ React.createElement("i", { className: "ti ti-info-circle", style: { marginRight: "4px" }, "aria-hidden": "true" }), racePassed ? "De wedstrijddatum is verstreken \u2014 kies een toekomstige datum." : `Schema: ${totalWeeks} weken (ideaal: ${preset.idealWeeks}). Piekvolume: ~${preset.basePeak} km/wk. Lange duurloop tot ${preset.longRunMax} km.`)), !racePassed && /* @__PURE__ */ React.createElement("div", { style: {
      background: "var(--color-background-primary)",
      border: "0.5px solid var(--color-border-tertiary)",
      borderRadius: "var(--border-radius-lg)",
      padding: "14px 16px",
      marginBottom: "16px",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      flexWrap: "wrap",
      gap: "12px"
    } }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { style: { fontSize: "13px", color: "var(--color-text-secondary)", marginBottom: "2px" } }, /* @__PURE__ */ React.createElement("i", { className: "ti ti-flag", style: { marginRight: "6px" }, "aria-hidden": "true" }), distance, " op ", parseDate(raceDate) ? formatDateNL(parseDate(raceDate)) : ""), /* @__PURE__ */ React.createElement("div", { style: { fontSize: "18px", fontWeight: 500 } }, "Week ", currentWeekFromDate, " van ", totalWeeks, /* @__PURE__ */ React.createElement("span", { style: { fontSize: "13px", color: "var(--color-text-secondary)", marginLeft: "8px", fontWeight: 400 } }, "(", totalWeeks - currentWeekFromDate + 1, " weken te gaan)"))), /* @__PURE__ */ React.createElement("button", { onClick: jumpToToday, style: { padding: "8px 14px", fontSize: "13px" } }, /* @__PURE__ */ React.createElement("i", { className: "ti ti-target", style: { marginRight: "4px" }, "aria-hidden": "true" }), "Spring naar deze week")), /* @__PURE__ */ React.createElement("div", { style: {
      background: "var(--color-background-primary)",
      border: "0.5px solid var(--color-border-tertiary)",
      borderRadius: "var(--border-radius-lg)",
      padding: "14px 16px",
      marginBottom: "16px"
    } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" } }, /* @__PURE__ */ React.createElement("span", { style: { fontSize: "13px", fontWeight: 500 } }, "Totale voortgang"), /* @__PURE__ */ React.createElement("span", { style: { fontSize: "13px", color: "var(--color-text-secondary)" } }, totalCompleted, " / ", totalWorkouts, " voltooid (", Math.round(totalCompleted / totalWorkouts * 100), "%)", totalLogged > 0 && /* @__PURE__ */ React.createElement("span", { style: { marginLeft: "8px", color: "var(--color-text-info)" } }, "\xB7 ", totalLogged, " gelogd"))), /* @__PURE__ */ React.createElement("div", { style: {
      height: "6px",
      background: "var(--color-background-tertiary)",
      borderRadius: "3px",
      overflow: "hidden"
    } }, /* @__PURE__ */ React.createElement("div", { style: {
      height: "100%",
      width: `${Math.min(100, totalCompleted / totalWorkouts * 100)}%`,
      background: "var(--color-text-success)",
      transition: "width 0.3s"
    } })), /* @__PURE__ */ React.createElement("div", { style: { marginTop: "8px", textAlign: "right" } }, /* @__PURE__ */ React.createElement(
      "button",
      {
        onClick: resetProgress,
        style: { fontSize: "11px", padding: "4px 10px", color: "var(--color-text-tertiary)" }
      },
      /* @__PURE__ */ React.createElement("i", { className: "ti ti-refresh", style: { marginRight: "3px" }, "aria-hidden": "true" }),
      "Reset"
    ))), /* @__PURE__ */ React.createElement("div", { style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: "12px",
      gap: "8px"
    } }, /* @__PURE__ */ React.createElement(
      "button",
      {
        onClick: () => setActiveWeek(Math.max(1, activeWeek - 1)),
        disabled: activeWeek === 1,
        style: { padding: "8px 12px", flexShrink: 0 },
        "aria-label": "Vorige week"
      },
      /* @__PURE__ */ React.createElement("i", { className: "ti ti-chevron-left", "aria-hidden": "true" })
    ), /* @__PURE__ */ React.createElement("div", { style: { flex: 1, textAlign: "center" } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: "16px", fontWeight: 500, display: "flex", justifyContent: "center", alignItems: "center", gap: "8px", flexWrap: "wrap" } }, /* @__PURE__ */ React.createElement("span", null, "Week ", activeWeek, " / ", totalWeeks), /* @__PURE__ */ React.createElement("span", { style: {
      fontSize: "11px",
      background: phaseColor.bg,
      color: phaseColor.text,
      padding: "2px 8px",
      borderRadius: "var(--border-radius-md)",
      fontWeight: 500
    } }, phase.label), week.isRecovery && /* @__PURE__ */ React.createElement("span", { style: {
      fontSize: "11px",
      background: "#E1F5EE",
      color: "#085041",
      padding: "2px 8px",
      borderRadius: "var(--border-radius-md)",
      fontWeight: 500
    } }, "herstel")), /* @__PURE__ */ React.createElement("div", { style: { fontSize: "12px", color: "var(--color-text-secondary)", marginTop: "2px" } }, "~", week.weekVolume, " km \xB7 ", weekCompleted, "/7 voltooid")), /* @__PURE__ */ React.createElement(
      "button",
      {
        onClick: () => setActiveWeek(Math.min(totalWeeks, activeWeek + 1)),
        disabled: activeWeek === totalWeeks,
        style: { padding: "8px 12px", flexShrink: 0 },
        "aria-label": "Volgende week"
      },
      /* @__PURE__ */ React.createElement("i", { className: "ti ti-chevron-right", "aria-hidden": "true" })
    )), /* @__PURE__ */ React.createElement("div", { style: {
      display: "grid",
      gridTemplateColumns: `repeat(${totalWeeks}, minmax(0, 1fr))`,
      gap: "2px",
      marginBottom: "16px"
    } }, Array.from({ length: totalWeeks }, (_, i) => {
      const wn = i + 1;
      const wkComp = DAY_NAMES.filter((d) => completed[`w${wn}-${d}`]).length;
      const isActive = wn === activeWeek;
      const isCurrent = wn === currentWeekFromDate;
      const wkPhase = getPhase(wn, totalWeeks);
      const wkColor = PHASE_COLORS[wkPhase.name] || PHASE_COLORS.BASE;
      return /* @__PURE__ */ React.createElement(
        "button",
        {
          key: wn,
          onClick: () => setActiveWeek(wn),
          style: {
            padding: "4px 0",
            minWidth: 0,
            fontSize: "10px",
            background: isActive ? wkColor.bg : "transparent",
            color: isActive ? wkColor.text : isCurrent ? "var(--color-text-info)" : "var(--color-text-secondary)",
            fontWeight: isActive || isCurrent ? 500 : 400,
            position: "relative",
            border: isCurrent && !isActive ? `0.5px solid var(--color-border-info)` : void 0
          },
          "aria-label": `Ga naar week ${wn}`,
          title: `Week ${wn} \u2014 ${wkPhase.label}`
        },
        wn,
        wkComp > 0 && /* @__PURE__ */ React.createElement("span", { style: {
          position: "absolute",
          bottom: "1px",
          left: "50%",
          transform: "translateX(-50%)",
          width: `${wkComp / 7 * 70}%`,
          height: "2px",
          background: "var(--color-text-success)",
          borderRadius: "1px"
        } })
      );
    })), /* @__PURE__ */ React.createElement("div", { style: {
      display: "flex",
      gap: "6px",
      flexWrap: "wrap",
      marginBottom: "16px",
      fontSize: "10px"
    } }, Object.entries(PHASE_COLORS).map(([name, col]) => /* @__PURE__ */ React.createElement("span", { key: name, style: {
      background: col.bg,
      color: col.text,
      padding: "2px 7px",
      borderRadius: "var(--border-radius-md)",
      fontWeight: 500
    } }, name === "BASE" ? "Basis" : name === "VO2" ? "VO2max" : name === "THRESHOLD" ? "Drempel" : name === "SPECIFIC" ? "Specifiek" : "Taper"))), /* @__PURE__ */ React.createElement("div", null, DAY_NAMES.map((d) => {
      const dayDate = weekDates[d];
      const isToday = dayDate && dateToISO(dayDate) === todayISO;
      const logKey = `w${activeWeek}-${d}`;
      return /* @__PURE__ */ React.createElement(
        DayCard,
        {
          key: d,
          dayName: d,
          dayDate,
          dayData: week.days[d],
          lthr,
          ltpSec,
          isTrail,
          completed: !!completed[`w${activeWeek}-${d}`],
          onToggleComplete: () => toggleComplete(d),
          isToday,
          logData: logs[logKey],
          onSaveLog: (log) => saveLog(d, log),
          onDeleteLog: () => deleteLog(d),
          terrainOverride: terrainOverrides[logKey],
          onSetTerrainOverride: (v) => setTerrainOverride(d, v)
        }
      );
    })), /* @__PURE__ */ React.createElement(WeekStatsFromLogs, { logs, activeWeek, lthr }), /* @__PURE__ */ React.createElement(TrainingTrend, { logs, totalWeeks, lthr }), /* @__PURE__ */ React.createElement("details", { style: { marginTop: "20px" } }, /* @__PURE__ */ React.createElement("summary", { style: {
      fontSize: "13px",
      color: "var(--color-text-secondary)",
      cursor: "pointer",
      padding: "8px 0"
    } }, /* @__PURE__ */ React.createElement("i", { className: "ti ti-heartbeat", style: { marginRight: "6px" }, "aria-hidden": "true" }), "Hartslagzones & paces"), /* @__PURE__ */ React.createElement("div", { style: {
      marginTop: "8px",
      background: "var(--color-background-secondary)",
      borderRadius: "var(--border-radius-md)",
      padding: "12px",
      fontSize: "12px"
    } }, /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "55px 1fr 80px 100px", gap: "8px", marginBottom: "6px", fontWeight: 500, color: "var(--color-text-secondary)" } }, /* @__PURE__ */ React.createElement("span", null, "Zone"), /* @__PURE__ */ React.createElement("span", null, "Doel"), /* @__PURE__ */ React.createElement("span", null, "HR (bpm)"), /* @__PURE__ */ React.createElement("span", null, "Pace (", isTrail ? "trail" : "weg", ")")), HR_ZONES.map((z, i) => {
      const hr = getHRRange(lthr, i);
      const pace = getPaceRange(ltpSec, i, isTrail);
      return /* @__PURE__ */ React.createElement("div", { key: i, style: {
        display: "grid",
        gridTemplateColumns: "55px 1fr 80px 100px",
        gap: "8px",
        padding: "4px 0",
        borderTop: i > 0 ? "0.5px solid var(--color-border-tertiary)" : "none"
      } }, /* @__PURE__ */ React.createElement("span", { style: { fontWeight: 500 } }, z.name), /* @__PURE__ */ React.createElement("span", { style: { color: "var(--color-text-secondary)" } }, z.label), /* @__PURE__ */ React.createElement("span", null, hr.lo, "-", hr.hi), /* @__PURE__ */ React.createElement("span", null, pace.hi, "-", pace.lo));
    }))), /* @__PURE__ */ React.createElement("details", { style: { marginTop: "8px" } }, /* @__PURE__ */ React.createElement("summary", { style: {
      fontSize: "13px",
      color: "var(--color-text-secondary)",
      cursor: "pointer",
      padding: "8px 0"
    } }, /* @__PURE__ */ React.createElement("i", { className: "ti ti-book", style: { marginRight: "6px" }, "aria-hidden": "true" }), "Methodologie"), /* @__PURE__ */ React.createElement("div", { style: {
      marginTop: "8px",
      background: "var(--color-background-secondary)",
      borderRadius: "var(--border-radius-md)",
      padding: "12px",
      fontSize: "12px",
      color: "var(--color-text-secondary)",
      lineHeight: 1.6
    } }, /* @__PURE__ */ React.createElement("div", { style: { marginBottom: "8px" } }, /* @__PURE__ */ React.createElement("strong", { style: { color: "var(--color-text-primary)", fontWeight: 500 } }, "Blok-periodisering (Jason Koop, CTS):"), " hardste sessies vooraan in elk blok, daarna iets terugschalen. VO2max-blok \u2192 drempelblok \u2192 race-specifiek \u2192 taper."), /* @__PURE__ */ React.createElement("div", { style: { marginBottom: "8px" } }, /* @__PURE__ */ React.createElement("strong", { style: { color: "var(--color-text-primary)", fontWeight: 500 } }, "80/20 polarisering (Seiler):"), " ~80% laag-intensief (Z1-Z2), ~20% hoog-intensief (Z3+). Vrijdag is duurloop tijdens VO2-blok, geen extra kwaliteit."), /* @__PURE__ */ React.createElement("div", { style: { marginBottom: "8px" } }, /* @__PURE__ */ React.createElement("strong", { style: { color: "var(--color-text-primary)", fontWeight: 500 } }, "Midweek key day (COROS Trail/Ultra):"), " woensdag is een substanti\xEBle kwaliteitsdag, vooral op 28K+. Combineert volume met race-specifieke stimulus."), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("strong", { style: { color: "var(--color-text-primary)", fontWeight: 500 } }, "Volume schaalt met afstand:"), " piekvolume voor 28K trail = ~65 km/wk, 50K = ~85 km/wk. Lange duurloop tot 90-95% van wedstrijdafstand."))));
  }
  const root = ReactDOM.createRoot(document.getElementById("root"));
  root.render(React.createElement(App));
})();
