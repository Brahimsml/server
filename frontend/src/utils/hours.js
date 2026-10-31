/*
  Store opening hours (Admin → Places → Opening hours).
  Saved as JSON: { mon: { open: "10:00", close: "20:00" }, ..., sun: null }  (null = closed that day).
  A close time earlier than the open time means it closes after midnight.
  "Open now" is worked out in Lebanon time, whatever the visitor's computer clock says.
*/
export const DAYS = [
  { key: "mon", short: "Mon", long: "Monday" },
  { key: "tue", short: "Tue", long: "Tuesday" },
  { key: "wed", short: "Wed", long: "Wednesday" },
  { key: "thu", short: "Thu", long: "Thursday" },
  { key: "fri", short: "Fri", long: "Friday" },
  { key: "sat", short: "Sat", long: "Saturday" },
  { key: "sun", short: "Sun", long: "Sunday" },
];

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

// Mon–Sat 10 AM to 8 PM, closed on Sunday: the starting point for a new store
export const DEFAULT_HOURS = Object.fromEntries(
  DAYS.map((d) => [d.key, d.key === "sun" ? null : { open: "10:00", close: "20:00" }])
);

// The saved text → { mon: {open, close} | null, ... }, or null if no hours were set
export const parseHours = (raw) => {
  if (!raw) return null;
  let data = raw;
  if (typeof raw === "string") {
    try {
      data = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!data || typeof data !== "object") return null;
  const out = {};
  let any = false;
  DAYS.forEach(({ key }) => {
    const slot = data[key];
    if (slot && TIME.test(slot.open) && TIME.test(slot.close) && slot.open !== slot.close) {
      out[key] = { open: slot.open, close: slot.close };
      any = true;
    } else {
      out[key] = null;
    }
  });
  return any ? out : null;
};

const toMinutes = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));

// "20:00" → "8 PM", "09:30" → "9:30 AM", "00:00" → "12 AM"
export const formatTime = (t) => {
  const h = Number(t.slice(0, 2));
  const m = t.slice(3);
  const suffix = h < 12 ? "AM" : "PM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m === "00" ? `${h12} ${suffix}` : `${h12}:${m} ${suffix}`;
};

export const formatSlot = (slot) => (slot ? `${formatTime(slot.open)} – ${formatTime(slot.close)}` : "Closed");

// The day (0 = Monday) and minutes since midnight right now in Lebanon
const beirutNow = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Beirut",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type)?.value;
  const day = DAYS.findIndex((d) => d.short === get("weekday"));
  return { day: day < 0 ? 0 : day, minutes: Number(get("hour")) * 60 + Number(get("minute")) };
};

/*
  { open: true,  soon: true/false, text: "Closes 8 PM" }
  { open: false, text: "Opens 10 AM tomorrow" }
*/
export const storeStatus = (hours, date) => {
  if (!hours) return null;
  const { day, minutes } = beirutNow(date);
  const slotOf = (i) => hours[DAYS[(i + 7) % 7].key];

  // still open from last night (closes after midnight)?
  const y = slotOf(day - 1);
  if (y && toMinutes(y.close) < toMinutes(y.open) && minutes < toMinutes(y.close)) {
    return { open: true, soon: toMinutes(y.close) - minutes <= 60, text: `Closes ${formatTime(y.close)}` };
  }

  const t = slotOf(day);
  if (t) {
    const o = toMinutes(t.open);
    const c = toMinutes(t.close);
    const overnight = c < o;
    if (minutes >= o && (overnight || minutes < c)) {
      const left = overnight ? 24 * 60 - minutes + c : c - minutes;
      return { open: true, soon: left <= 60, text: `Closes ${formatTime(t.close)}` };
    }
    if (minutes < o) return { open: false, text: `Opens ${formatTime(t.open)}` };
  }

  for (let i = 1; i <= 7; i += 1) {
    const s = slotOf(day + i);
    if (s) {
      const when = i === 1 ? "tomorrow" : DAYS[(day + i) % 7].short;
      return { open: false, text: `Opens ${when} ${formatTime(s.open)}` };
    }
  }
  return { open: false, text: "" };
};

// Days with the same hours side by side, grouped: "Mon – Sat: 10 AM – 8 PM", "Sun: Closed"
export const groupHours = (hours) => {
  const groups = [];
  DAYS.forEach((d, i) => {
    const text = formatSlot(hours[d.key]);
    const last = groups[groups.length - 1];
    if (last && last.text === text && last.to === i - 1) last.to = i;
    else groups.push({ from: i, to: i, text });
  });
  return groups.map((g) => ({
    days: g.from === g.to ? DAYS[g.from].short : `${DAYS[g.from].short} – ${DAYS[g.to].short}`,
    text: g.text,
    from: g.from,
    to: g.to,
  }));
};

export const todayIndex = (date) => beirutNow(date).day;
