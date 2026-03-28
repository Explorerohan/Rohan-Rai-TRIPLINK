/**
 * Aligns with backend: cancellation allowed only if trip_start_date is absent
 * OR (trip_start_date - today) >= 2 calendar days.
 */

export function getCalendarDaysUntilTripStart(tripStartDateRaw) {
  if (tripStartDateRaw == null || tripStartDateRaw === "") return null;
  const start = new Date(tripStartDateRaw);
  if (Number.isNaN(start.getTime())) return null;
  const today = new Date();
  const startMidnight = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((startMidnight.getTime() - todayMidnight.getTime()) / (1000 * 60 * 60 * 24));
}

/** Backend allows cancel when trip date is missing. */
export function canCancelByTwoDayRule(tripStartDateRaw) {
  const days = getCalendarDaysUntilTripStart(tripStartDateRaw);
  if (days === null) return true;
  return days >= 2;
}
