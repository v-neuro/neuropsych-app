function parseDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > daysInMonth[month - 1]) return null;
  return { year, month, day };
}

// Calendar dates avoid UTC offsets and daylight-saving changes in age calculations.
export function calculatePatientAge(birthDate, examinationDate) {
  const birth = parseDate(birthDate);
  const examination = parseDate(examinationDate);
  if (!birth || !examination || birthDate > examinationDate) return null;
  const beforeBirthday = examination.month < birth.month
    || (examination.month === birth.month && examination.day < birth.day);
  return examination.year - birth.year - (beforeBirthday ? 1 : 0);
}
