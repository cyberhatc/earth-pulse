import { REGIONS } from "./data";
import { beginnerGuide } from "./beginnerGuide";

export interface Progress { region:string; topic:string; index:number }
const key = "earthpulse.beginner.v1";
export function readProgress(): Progress | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(key) || "null");
    if (!value || !REGIONS.some(r=>r.slug===value.region) ||
        !["temperature","precipitation","ndvi","sst"].includes(value.topic) ||
        !Number.isInteger(value.index) || value.index < 0 ||
        value.index >= beginnerGuide(value.region,value.topic).length) return null;
    return value;
  } catch { return null; }
}
export function saveProgress(value: Progress | null) {
  try {
    if (value) sessionStorage.setItem(key, JSON.stringify(value));
    else sessionStorage.removeItem(key);
  } catch { /* Private browsing may disable session storage. */ }
}
