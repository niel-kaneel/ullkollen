// Stable breed catalog for Ullkollen.
// `code` is permanent (used in DB / analytics). `name_sv` is the display label
// and may be edited without breaking historical comparisons.
// `wool_hint` is a soft prior used by the AI prompt — not authoritative.

export type BreedGroup = "native" | "production" | "other";

export type Breed = {
  code: string;
  name_sv: string;
  name_en: string;
  group: BreedGroup;
  wool_hint?: string;
};

export const BREEDS: Breed[] = [
  // Native Swedish breeds (sorted by population)
  { code: "gotland",       name_sv: "Gotlandsfår",    name_en: "Gotland sheep",          group: "native", wool_hint: "P" },
  { code: "finull",        name_sv: "Finullsfår",     name_en: "Swedish Finewool",       group: "native", wool_hint: "F" },
  { code: "rya",           name_sv: "Ryafår",         name_en: "Rya sheep",              group: "native", wool_hint: "R" },
  { code: "gute",          name_sv: "Gutefår",        name_en: "Gute sheep",             group: "native", wool_hint: "U" },
  { code: "dalapals",      name_sv: "Dalapälsfår",    name_en: "Dala-Pälsfår",           group: "native", wool_hint: "P" },
  { code: "varmland",      name_sv: "Värmlandsfår",   name_en: "Värmland sheep",         group: "native", wool_hint: "V" },
  { code: "roslag",        name_sv: "Roslagsfår",     name_en: "Roslag sheep",           group: "native" },
  { code: "helsinge",      name_sv: "Helsingefår",    name_en: "Helsinge sheep",         group: "native", wool_hint: "V" },
  { code: "asen",          name_sv: "Åsenfår",        name_en: "Åsen sheep",             group: "native" },
  { code: "svardsjo",      name_sv: "Svärdsjöfår",    name_en: "Svärdsjö sheep",         group: "native" },
  { code: "klovsjo",       name_sv: "Klövsjöfår",     name_en: "Klövsjö sheep",          group: "native" },
  { code: "gestrike",      name_sv: "Gestrikefår",    name_en: "Gestrike sheep",         group: "native" },
  { code: "fjallnas",      name_sv: "Fjällnäsfår",    name_en: "Fjällnäs sheep",         group: "native" },
  { code: "tabacktorp",    name_sv: "Tabacktorpsfår", name_en: "Tabacktorp sheep",       group: "native" },
  // Production / imported breeds
  { code: "texel",         name_sv: "Texel",          name_en: "Texel",                  group: "production", wool_hint: "S" },
  { code: "suffolk",       name_sv: "Suffolk",        name_en: "Suffolk",                group: "production", wool_hint: "S" },
  { code: "leicester",     name_sv: "Leicester",      name_en: "Leicester",              group: "production", wool_hint: "C" },
  { code: "dorset",        name_sv: "Dorset",         name_en: "Dorset",                 group: "production", wool_hint: "C" },
  { code: "oxford_down",   name_sv: "Oxford Down",    name_en: "Oxford Down",            group: "production", wool_hint: "C" },
  { code: "shropshire",    name_sv: "Shropshire",     name_en: "Shropshire",             group: "production", wool_hint: "C" },
  { code: "jamtland",      name_sv: "Jämtlandsfår",   name_en: "Jämtland sheep",         group: "production", wool_hint: "M/F" },
  // Fallbacks
  { code: "korsning",      name_sv: "Korsning",       name_en: "Crossbreed",             group: "other" },
  { code: "unknown",       name_sv: "Annan / Vet ej", name_en: "Other / Don't know",     group: "other" },
];

export const BREED_BY_CODE: Record<string, Breed> = Object.fromEntries(
  BREEDS.map((b) => [b.code, b]),
);

export function breedLabel(code: string | null | undefined, lang: "sv" | "en" = "sv"): string {
  if (!code) return "";
  const b = BREED_BY_CODE[code];
  if (!b) return code;
  return lang === "en" ? b.name_en : b.name_sv;
}
