/* global __NPT_APP_VERSION__, __NPT_APP_BUILT_AT__ */
export const APP_VERSION = typeof __NPT_APP_VERSION__ === "string" ? __NPT_APP_VERSION__ : "Entwicklung";
export const APP_VERSION_LABEL = typeof __NPT_APP_BUILT_AT__ === "string"
  ? new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin",
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).format(new Date(__NPT_APP_BUILT_AT__))
  : "Entwicklung";
