// Wording for the warning codes from lib/progress.js - shared by the app and the Mac.
// fmt turns an ISO date into display text (app: "8 Oct", Mac: the ISO date itself).

export function describeWarning(w, fmt = (d) => d) {
  switch (w.code) {
    case "pain_high":
      return {
        level: "critical",
        title: `${w.area === "finger" ? "Finger" : "Groin"} pain ${w.value}/10`,
        text: `on ${fmt(w.date)} - above the limit of 2 during training.`,
      };
    case "a2_early_warning":
      return {
        level: "critical",
        title: "A2 early warning",
        text: `finger pain the next day was ${w.values.join(" and ")} in two sessions in a row. Check the rehab plan.`,
      };
    case "fourth_bouldering_day":
      return { level: "critical", title: `${w.count} bouldering days this week`, text: "the limit is 3 (Mon, Thu, Sat)." };
    case "next_day_missing":
      return { level: "warning", title: "Next-day finger pain missing", text: `for the session on ${fmt(w.date)}.` };
    case "weekly_limit_reached":
      return { level: "info", title: "3 bouldering days this week", text: "limit reached - rest or train at home." };
    default:
      return null;
  }
}
