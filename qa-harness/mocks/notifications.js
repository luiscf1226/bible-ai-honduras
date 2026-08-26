export const AndroidImportance = { DEFAULT: 3, HIGH: 4 };
export const SchedulableTriggerInputTypes = { DAILY: "daily", DATE: "date" };
export function setNotificationHandler() {}
export async function getPermissionsAsync() { return { granted: true, status: "granted" }; }
export async function requestPermissionsAsync() { return { granted: true, status: "granted" }; }
export async function scheduleNotificationAsync() { return "qa-notification"; }
export async function cancelAllScheduledNotificationsAsync() {}
export async function cancelScheduledNotificationAsync() {}
export async function getAllScheduledNotificationsAsync() { return []; }
export async function setNotificationChannelAsync() {}
