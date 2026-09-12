/**
 * Shared tab config. Deliberately not a client module: the server page needs
 * `isProfileTab` to validate the query param, and a function exported from a
 * "use client" file can't be called on the server.
 */

export const PROFILE_TABS = [
  { key: "overview", label: "Overview" },
  { key: "taste", label: "Taste" },
  { key: "evolution", label: "Evolution" },
  { key: "activity", label: "Activity" },
  { key: "collections", label: "Collections" },
  { key: "community", label: "Community" },
] as const;

export type ProfileTab = (typeof PROFILE_TABS)[number]["key"];

export function isProfileTab(value: string | undefined): value is ProfileTab {
  return !!value && PROFILE_TABS.some((t) => t.key === value);
}
