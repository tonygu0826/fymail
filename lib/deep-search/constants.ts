// Top 30 global logistics companies to exclude (by domain)
export const EXCLUDED_DOMAINS = new Set([
  'kuehne-nagel.com', 'dhl.com', 'dbschenker.com', 'dsv.com', 'maersk.com',
  'cma-cgm.com', 'ups.com', 'fedex.com', 'nipponexpress.com', 'expeditors.com',
  'agility.com', 'geodis.com', 'bollore-logistics.com', 'ceva-logistics.com',
  'dachser.com', 'hellmann.net', 'rhenus.com', 'panalpina.com', 'kintetsu-we.com',
  'sinotrans.com', 'yusen-logistics.com', 'ch-robinson.com', 'xpo.com',
  'cosco.com', 'hapag-lloyd.com', 'evergreen-marine.com', 'yangming.com',
  'oocl.com', 'zim.com', 'wan-hai.com', 'msc.com', 'flexport.com',
  'kerry-logistics.com', 'dimerco.com', 'hitachitransport.com',
]);

export const EXCLUDED_NAMES = new Set([
  'kuehne+nagel', 'kuehne nagel', 'dhl', 'dhl global forwarding', 'db schenker',
  'dsv', 'maersk', 'cma cgm', 'ups', 'fedex', 'nippon express', 'expeditors',
  'agility', 'geodis', 'bollore', 'ceva logistics', 'dachser', 'hellmann',
  'rhenus', 'panalpina', 'sinotrans', 'ch robinson', 'xpo logistics',
  'hapag-lloyd', 'msc', 'flexport', 'kerry logistics',
]);

export const EUROPEAN_COUNTRIES = [
  // 西欧
  { code: 'DE', name: 'Germany', local: 'Deutschland', tld: '.de' },
  { code: 'FR', name: 'France', local: 'France', tld: '.fr' },
  { code: 'NL', name: 'Netherlands', local: 'Nederland', tld: '.nl' },
  { code: 'BE', name: 'Belgium', local: 'België', tld: '.be' },
  { code: 'LU', name: 'Luxembourg', local: 'Luxembourg', tld: '.lu' },
  { code: 'AT', name: 'Austria', local: 'Österreich', tld: '.at' },
  { code: 'CH', name: 'Switzerland', local: 'Schweiz', tld: '.ch' },
  { code: 'LI', name: 'Liechtenstein', local: 'Liechtenstein', tld: '.li' },
  { code: 'MC', name: 'Monaco', local: 'Monaco', tld: '.mc' },
  // 北欧
  { code: 'GB', name: 'United Kingdom', local: 'UK', tld: '.uk' },
  { code: 'IE', name: 'Ireland', local: 'Éire', tld: '.ie' },
  { code: 'DK', name: 'Denmark', local: 'Danmark', tld: '.dk' },
  { code: 'SE', name: 'Sweden', local: 'Sverige', tld: '.se' },
  { code: 'NO', name: 'Norway', local: 'Norge', tld: '.no' },
  { code: 'FI', name: 'Finland', local: 'Suomi', tld: '.fi' },
  { code: 'IS', name: 'Iceland', local: 'Ísland', tld: '.is' },
  // 南欧
  { code: 'IT', name: 'Italy', local: 'Italia', tld: '.it' },
  { code: 'ES', name: 'Spain', local: 'España', tld: '.es' },
  { code: 'PT', name: 'Portugal', local: 'Portugal', tld: '.pt' },
  { code: 'GR', name: 'Greece', local: 'Ελλάδα', tld: '.gr' },
  { code: 'MT', name: 'Malta', local: 'Malta', tld: '.mt' },
  { code: 'CY', name: 'Cyprus', local: 'Κύπρος', tld: '.cy' },
  { code: 'AD', name: 'Andorra', local: 'Andorra', tld: '.ad' },
  { code: 'SM', name: 'San Marino', local: 'San Marino', tld: '.sm' },
  // 中东欧
  { code: 'PL', name: 'Poland', local: 'Polska', tld: '.pl' },
  { code: 'CZ', name: 'Czech Republic', local: 'Česko', tld: '.cz' },
  { code: 'SK', name: 'Slovakia', local: 'Slovensko', tld: '.sk' },
  { code: 'HU', name: 'Hungary', local: 'Magyarország', tld: '.hu' },
  { code: 'RO', name: 'Romania', local: 'România', tld: '.ro' },
  { code: 'BG', name: 'Bulgaria', local: 'България', tld: '.bg' },
  { code: 'HR', name: 'Croatia', local: 'Hrvatska', tld: '.hr' },
  { code: 'SI', name: 'Slovenia', local: 'Slovenija', tld: '.si' },
  { code: 'RS', name: 'Serbia', local: 'Srbija', tld: '.rs' },
  { code: 'BA', name: 'Bosnia and Herzegovina', local: 'Bosna i Hercegovina', tld: '.ba' },
  { code: 'ME', name: 'Montenegro', local: 'Crna Gora', tld: '.me' },
  { code: 'MK', name: 'North Macedonia', local: 'Северна Македонија', tld: '.mk' },
  { code: 'AL', name: 'Albania', local: 'Shqipëria', tld: '.al' },
  { code: 'XK', name: 'Kosovo', local: 'Kosova', tld: '.xk' },
  // 波罗的海
  { code: 'LT', name: 'Lithuania', local: 'Lietuva', tld: '.lt' },
  { code: 'LV', name: 'Latvia', local: 'Latvija', tld: '.lv' },
  { code: 'EE', name: 'Estonia', local: 'Eesti', tld: '.ee' },
  // 东欧
  { code: 'UA', name: 'Ukraine', local: 'Україна', tld: '.ua' },
  { code: 'MD', name: 'Moldova', local: 'Moldova', tld: '.md' },
  { code: 'BY', name: 'Belarus', local: 'Беларусь', tld: '.by' },
  // 高加索/跨洲
  { code: 'GE', name: 'Georgia', local: 'საქართველო', tld: '.ge' },
  { code: 'AM', name: 'Armenia', local: 'Հայաստան', tld: '.am' },
  { code: 'AZ', name: 'Azerbaijan', local: 'Azərbaycan', tld: '.az' },
  // 北欧属地
  { code: 'TR', name: 'Turkey', local: 'Türkiye', tld: '.tr' },
  { code: 'RU', name: 'Russia', local: 'Россия', tld: '.ru' },
];

export const SERVICE_QUERIES = [
  'LCL consolidation freight forwarder',
  'FCL container shipping company',
  'air freight forwarding logistics',
  'customs broker clearance agent',
  'sea freight ocean forwarding',
  'rail freight transport',
  'warehousing logistics provider',
];

export const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0',
];

export const CONTACT_PAGE_PATTERNS = [
  /\/contact/i, /\/kontakt/i, /\/about/i, /\/impressum/i,
  /\/nous-contacter/i, /\/contacto/i, /\/contatti/i,
  /\/over-ons/i, /\/ueber-uns/i, /\/about-us/i,
  /\/team/i, /\/company/i, /\/get-in-touch/i,
  /\/reach-us/i, /\/info/i, /\/enquiry/i, /\/inquiry/i,
  /\/kontakta-oss/i, /\/kontakt-oss/i, /\/yhteystiedot/i,  // SE/NO/FI
  /\/kontakty/i, /\/kapcsolat/i, /\/contato/i,              // PL/HU/PT
  /\/epikoinonia/i, /\/kontaktai/i, /\/kontakti/i,           // GR/LT/LV
  /\/locations/i, /\/offices/i, /\/branches/i,
  /\/services/i, /\/partners/i,
];
