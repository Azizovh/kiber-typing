/** ISO 3166-1 alpha-2 codes. Names come from the browser, in the interface language. */
const CODES = (
  'AD AE AF AG AL AM AO AR AT AU AZ BA BB BD BE BF BG BH BI BJ BN BO BR BS BT BW BY BZ CA CD CF CG CH CI ' +
  'CL CM CN CO CR CU CV CY CZ DE DJ DK DM DO DZ EC EE EG ER ES ET FI FJ FR GA GB GD GE GH GM GN GQ GR GT ' +
  'GW GY HK HN HR HT HU ID IE IL IN IQ IR IS IT JM JO JP KE KG KH KM KP KR KW KZ LA LB LC LI LK LR LS LT ' +
  'LU LV LY MA MC MD ME MG MK ML MM MN MR MT MU MV MW MX MY MZ NA NE NG NI NL NO NP NZ OM PA PE PG PH PK ' +
  'PL PS PT PY QA RO RS RU RW SA SB SC SD SE SG SI SK SL SM SN SO SR SS SV SY SZ TD TG TH TJ TL TM TN TO ' +
  'TR TT TW TZ UA UG US UY UZ VE VN YE ZA ZM ZW'
).split(' ');

export interface Country {
  code: string;
  name: string;
}

/**
 * Browsers rarely ship Uzbek region names, and then silently answer in the
 * system language instead. These cover the countries most visitors come from;
 * the rest fall back to English.
 */
const UZ_NAMES: Record<string, string> = {
  UZ: "O'zbekiston",
  KZ: "Qozog'iston",
  KG: "Qirg'iziston",
  TJ: 'Tojikiston',
  TM: 'Turkmaniston',
  AF: "Afg'oniston",
  AZ: 'Ozarbayjon',
  RU: 'Rossiya',
  UA: 'Ukraina',
  BY: 'Belarus',
  TR: 'Turkiya',
  US: 'AQSH',
  GB: 'Buyuk Britaniya',
  DE: 'Germaniya',
  FR: 'Fransiya',
  CN: 'Xitoy',
  KR: 'Janubiy Koreya',
  JP: 'Yaponiya',
  IN: 'Hindiston',
  AE: 'BAA',
  SA: 'Saudiya Arabistoni',
  PL: 'Polsha',
};

/** Countries sorted by their name in the given language. */
export function countries(lang: string): Country[] {
  let names: Intl.DisplayNames | null = null;
  try {
    const supported = Intl.DisplayNames.supportedLocalesOf([lang]).length > 0;
    names = new Intl.DisplayNames([supported ? lang : 'en'], { type: 'region' });
  } catch {
    // Very old browsers: fall back to bare codes.
  }
  const overrides = lang === 'uz' ? UZ_NAMES : {};
  return CODES.map((code) => ({ code, name: overrides[code] ?? names?.of(code) ?? code })).sort(
    (a, b) => a.name.localeCompare(b.name, lang),
  );
}
