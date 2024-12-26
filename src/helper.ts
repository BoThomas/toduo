export const getCalendarWeekFromDateOfCurrentYear = (date: Date) => {
  let firstOfJanuary = new Date(date.getFullYear(), 0, 1);
  return Math.ceil(
    ((date.getTime() - firstOfJanuary.getTime()) / 86400000 +
      firstOfJanuary.getDay() +
      1) /
      7,
  );
};
