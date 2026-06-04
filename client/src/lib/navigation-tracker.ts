type Section = "module" | "calendar" | "incidents" | "cases" | null;

let lastSection: Section = null;

export function getLastSection(): Section {
  return lastSection;
}

export function setLastSection(s: Section): void {
  lastSection = s;
}
