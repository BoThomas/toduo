export const getCalendarWeekFromDateOfCurrentYear = (date: Date) => {
  let target = new Date(date.valueOf());
  let dayNr = (date.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  let firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay() + 7) % 7));
  }
  let weekNumber =
    1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);

  return weekNumber;
};
