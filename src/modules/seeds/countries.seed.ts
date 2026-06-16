import { db, type DB } from '../../db';
import { countries, type NewCountry } from '../../db/schema';

const countriesData: NewCountry[] = [
  {
    abbreviation: '00',
    name: '* Undetermined',
  },
  {
    abbreviation: 'AD',
    name: 'Andorra',
  },
  {
    abbreviation: 'AE',
    name: 'United Arab Emirates',
  },
  {
    abbreviation: 'AF',
    name: 'Afghanistan',
  },
  {
    abbreviation: 'AG',
    name: 'Antigua and Barbuda',
  },
  {
    abbreviation: 'AI',
    name: 'Anguilla',
  },
  {
    abbreviation: 'AL',
    name: 'Albania',
  },
  {
    abbreviation: 'AM',
    name: 'Armenia',
  },
  {
    abbreviation: 'AO',
    name: 'Angola',
  },
  {
    abbreviation: 'AQ',
    name: 'Antarctica',
  },
  {
    abbreviation: 'AR',
    name: 'Argentina',
  },
  {
    abbreviation: 'AS',
    name: 'American Samoa',
  },
  {
    abbreviation: 'AT',
    name: 'Austria',
  },
  {
    abbreviation: 'AU',
    name: 'Australia',
  },
  {
    abbreviation: 'AW',
    name: 'Aruba',
  },
  {
    abbreviation: 'AX',
    name: '\u00c5land Islands',
  },
  {
    abbreviation: 'AZ',
    name: 'Azerbaijan',
  },
  {
    abbreviation: 'BA',
    name: 'Bosnia and Herzegovina',
  },
  {
    abbreviation: 'BB',
    name: 'Barbados',
  },
  {
    abbreviation: 'BD',
    name: 'Bangladesh',
  },
  {
    abbreviation: 'BE',
    name: 'Belgium',
  },
  {
    abbreviation: 'BF',
    name: 'Burkina Faso',
  },
  {
    abbreviation: 'BG',
    name: 'Bulgaria',
  },
  {
    abbreviation: 'BH',
    name: 'Bahrain',
  },
  {
    abbreviation: 'BI',
    name: 'Burundi',
  },
  {
    abbreviation: 'BJ',
    name: 'Benin',
  },
  {
    abbreviation: 'BL',
    name: 'Saint Barth\u00e9lemy',
  },
  {
    abbreviation: 'BM',
    name: 'Bermuda',
  },
  {
    abbreviation: 'BN',
    name: 'Brunei',
  },
  {
    abbreviation: 'BO',
    name: 'Bolivia',
  },
  {
    abbreviation: 'BQ',
    name: 'Bonaire, Sint Eustatius and Saba',
  },
  {
    abbreviation: 'BR',
    name: 'Brazil',
  },
  {
    abbreviation: 'BS',
    name: 'Bahamas',
  },
  {
    abbreviation: 'BT',
    name: 'Bhutan',
  },
  {
    abbreviation: 'BV',
    name: 'Bouvet Island',
  },
  {
    abbreviation: 'BW',
    name: 'Botswana',
  },
  {
    abbreviation: 'BY',
    name: 'Belarus',
  },
  {
    abbreviation: 'BZ',
    name: 'Belize',
  },
  {
    abbreviation: 'CA',
    name: 'Canada',
  },
  {
    abbreviation: 'CC',
    name: 'Cocos (Keeling) Islands',
  },
  {
    abbreviation: 'CD',
    name: 'Congo (the Democratic Republic of the)',
  },
  {
    abbreviation: 'CF',
    name: 'Central African Republic',
  },
  {
    abbreviation: 'CG',
    name: 'Congo',
  },
  {
    abbreviation: 'CH',
    name: 'Switzerland',
  },
  {
    abbreviation: 'CI',
    name: "C\u00f4te d'Ivoire",
  },
  {
    abbreviation: 'CK',
    name: 'Cook Islands',
  },
  {
    abbreviation: 'CL',
    name: 'Chile',
  },
  {
    abbreviation: 'CM',
    name: 'Cameroon',
  },
  {
    abbreviation: 'CN',
    name: 'China',
  },
  {
    abbreviation: 'CO',
    name: 'Colombia',
  },
  {
    abbreviation: 'CR',
    name: 'Costa Rica',
  },
  {
    abbreviation: 'CU',
    name: 'Cuba',
  },
  {
    abbreviation: 'CV',
    name: 'Cabo Verde',
  },
  {
    abbreviation: 'CW',
    name: 'Cura\u00e7ao',
  },
  {
    abbreviation: 'CX',
    name: 'Christmas Island',
  },
  {
    abbreviation: 'CY',
    name: 'Cyprus',
  },
  {
    abbreviation: 'CZ',
    name: 'Czechia',
  },
  {
    abbreviation: 'DE',
    name: 'Germany',
  },
  {
    abbreviation: 'DJ',
    name: 'Djibouti',
  },
  {
    abbreviation: 'DK',
    name: 'Denmark',
  },
  {
    abbreviation: 'DM',
    name: 'Dominica',
  },
  {
    abbreviation: 'DO',
    name: 'Dominican Republic',
  },
  {
    abbreviation: 'DZ',
    name: 'Algeria',
  },
  {
    abbreviation: 'EC',
    name: 'Ecuador',
  },
  {
    abbreviation: 'EE',
    name: 'Estonia',
  },
  {
    abbreviation: 'EG',
    name: 'Egypt',
  },
  {
    abbreviation: 'EH',
    name: 'Western Sahara',
  },
  {
    abbreviation: 'ER',
    name: 'Eritrea',
  },
  {
    abbreviation: 'ES',
    name: 'Spain',
  },
  {
    abbreviation: 'ET',
    name: 'Ethiopia',
  },
  {
    abbreviation: 'FI',
    name: 'Finland',
  },
  {
    abbreviation: 'FJ',
    name: 'Fiji',
  },
  {
    abbreviation: 'FK',
    name: 'Falkland Islands (Malvinas)',
  },
  {
    abbreviation: 'FM',
    name: 'Micronesia (Federated States of)',
  },
  {
    abbreviation: 'FO',
    name: 'Faroe Islands',
  },
  {
    abbreviation: 'FR',
    name: 'France',
  },
  {
    abbreviation: 'GA',
    name: 'Gabon',
  },
  {
    abbreviation: 'GB',
    name: 'United Kingdom',
  },
  {
    abbreviation: 'GD',
    name: 'Grenada',
  },
  {
    abbreviation: 'GE',
    name: 'Georgia',
  },
  {
    abbreviation: 'GF',
    name: 'French Guiana',
  },
  {
    abbreviation: 'GG',
    name: 'Guernsey',
  },
  {
    abbreviation: 'GH',
    name: 'Ghana',
  },
  {
    abbreviation: 'GI',
    name: 'Gibraltar',
  },
  {
    abbreviation: 'GL',
    name: 'Greenland',
  },
  {
    abbreviation: 'GM',
    name: 'Gambia',
  },
  {
    abbreviation: 'GN',
    name: 'Guinea',
  },
  {
    abbreviation: 'GP',
    name: 'Guadeloupe',
  },
  {
    abbreviation: 'GQ',
    name: 'Equatorial Guinea',
  },
  {
    abbreviation: 'GR',
    name: 'Greece',
  },
  {
    abbreviation: 'GS',
    name: 'South Georgia and the South Sandwich Islands',
  },
  {
    abbreviation: 'GT',
    name: 'Guatemala',
  },
  {
    abbreviation: 'GU',
    name: 'Guam',
  },
  {
    abbreviation: 'GW',
    name: 'Guinea-Bissau',
  },
  {
    abbreviation: 'GY',
    name: 'Guyana',
  },
  {
    abbreviation: 'HK',
    name: 'Hong Kong',
  },
  {
    abbreviation: 'HM',
    name: 'Heard Island and McDonald Islands',
  },
  {
    abbreviation: 'HN',
    name: 'Honduras',
  },
  {
    abbreviation: 'HR',
    name: 'Croatia',
  },
  {
    abbreviation: 'HT',
    name: 'Haiti',
  },
  {
    abbreviation: 'HU',
    name: 'Hungary',
  },
  {
    abbreviation: 'ID',
    name: 'Indonesia',
  },
  {
    abbreviation: 'IE',
    name: 'Ireland',
  },
  {
    abbreviation: 'IL',
    name: 'Israel',
  },
  {
    abbreviation: 'IM',
    name: 'Isle of Man',
  },
  {
    abbreviation: 'IN',
    name: 'India',
  },
  {
    abbreviation: 'IO',
    name: 'British Indian Ocean Territory',
  },
  {
    abbreviation: 'IQ',
    name: 'Iraq',
  },
  {
    abbreviation: 'IR',
    name: 'Iran',
  },
  {
    abbreviation: 'IS',
    name: 'Iceland',
  },
  {
    abbreviation: 'IT',
    name: 'Italy',
  },
  {
    abbreviation: 'JE',
    name: 'Jersey',
  },
  {
    abbreviation: 'JM',
    name: 'Jamaica',
  },
  {
    abbreviation: 'JO',
    name: 'Jordan',
  },
  {
    abbreviation: 'JP',
    name: 'Japan',
  },
  {
    abbreviation: 'KE',
    name: 'Kenya',
  },
  {
    abbreviation: 'KG',
    name: 'Kyrgyzstan',
  },
  {
    abbreviation: 'KH',
    name: 'Cambodia',
  },
  {
    abbreviation: 'KI',
    name: 'Kiribati',
  },
  {
    abbreviation: 'KM',
    name: 'Comoros',
  },
  {
    abbreviation: 'KN',
    name: 'Saint Kitts and Nevis',
  },
  {
    abbreviation: 'KP',
    name: 'North Korea',
  },
  {
    abbreviation: 'KR',
    name: 'South Korea',
  },
  {
    abbreviation: 'KW',
    name: 'Kuwait',
  },
  {
    abbreviation: 'KY',
    name: 'Cayman Islands',
  },
  {
    abbreviation: 'KZ',
    name: 'Kazakhstan',
  },
  {
    abbreviation: 'LA',
    name: 'Laos',
  },
  {
    abbreviation: 'LB',
    name: 'Lebanon',
  },
  {
    abbreviation: 'LC',
    name: 'Saint Lucia',
  },
  {
    abbreviation: 'LI',
    name: 'Liechtenstein',
  },
  {
    abbreviation: 'LK',
    name: 'Sri Lanka',
  },
  {
    abbreviation: 'LR',
    name: 'Liberia',
  },
  {
    abbreviation: 'LS',
    name: 'Lesotho',
  },
  {
    abbreviation: 'LT',
    name: 'Lithuania',
  },
  {
    abbreviation: 'LU',
    name: 'Luxembourg',
  },
  {
    abbreviation: 'LV',
    name: 'Latvia',
  },
  {
    abbreviation: 'LY',
    name: 'Libya',
  },
  {
    abbreviation: 'MA',
    name: 'Morocco',
  },
  {
    abbreviation: 'MC',
    name: 'Monaco',
  },
  {
    abbreviation: 'MD',
    name: 'Moldova',
  },
  {
    abbreviation: 'ME',
    name: 'Montenegro',
  },
  {
    abbreviation: 'MF',
    name: 'Saint Martin (French part)',
  },
  {
    abbreviation: 'MG',
    name: 'Madagascar',
  },
  {
    abbreviation: 'MH',
    name: 'Marshall Islands',
  },
  {
    abbreviation: 'MK',
    name: 'North Macedonia',
  },
  {
    abbreviation: 'ML',
    name: 'Mali',
  },
  {
    abbreviation: 'MM',
    name: 'Myanmar',
  },
  {
    abbreviation: 'MN',
    name: 'Mongolia',
  },
  {
    abbreviation: 'MO',
    name: 'Macao',
  },
  {
    abbreviation: 'MP',
    name: 'Northern Mariana Islands',
  },
  {
    abbreviation: 'MQ',
    name: 'Martinique',
  },
  {
    abbreviation: 'MR',
    name: 'Mauritania',
  },
  {
    abbreviation: 'MS',
    name: 'Montserrat',
  },
  {
    abbreviation: 'MT',
    name: 'Malta',
  },
  {
    abbreviation: 'MU',
    name: 'Mauritius',
  },
  {
    abbreviation: 'MV',
    name: 'Maldives',
  },
  {
    abbreviation: 'MW',
    name: 'Malawi',
  },
  {
    abbreviation: 'MX',
    name: 'Mexico',
  },
  {
    abbreviation: 'MY',
    name: 'Malaysia',
  },
  {
    abbreviation: 'MZ',
    name: 'Mozambique',
  },
  {
    abbreviation: 'NA',
    name: 'Namibia',
  },
  {
    abbreviation: 'NC',
    name: 'New Caledonia',
  },
  {
    abbreviation: 'NE',
    name: 'Niger',
  },
  {
    abbreviation: 'NF',
    name: 'Norfolk Island',
  },
  {
    abbreviation: 'NG',
    name: 'Nigeria',
  },
  {
    abbreviation: 'NI',
    name: 'Nicaragua',
  },
  {
    abbreviation: 'NL',
    name: 'Netherlands',
  },
  {
    abbreviation: 'NO',
    name: 'Norway',
  },
  {
    abbreviation: 'NP',
    name: 'Nepal',
  },
  {
    abbreviation: 'NR',
    name: 'Nauru',
  },
  {
    abbreviation: 'NU',
    name: 'Niue',
  },
  {
    abbreviation: 'NZ',
    name: 'New Zealand',
  },
  {
    abbreviation: 'OM',
    name: 'Oman',
  },
  {
    abbreviation: 'PA',
    name: 'Panama',
  },
  {
    abbreviation: 'PE',
    name: 'Peru',
  },
  {
    abbreviation: 'PF',
    name: 'French Polynesia',
  },
  {
    abbreviation: 'PG',
    name: 'Papua New Guinea',
  },
  {
    abbreviation: 'PH',
    name: 'Philippines',
  },
  {
    abbreviation: 'PK',
    name: 'Pakistan',
  },
  {
    abbreviation: 'PL',
    name: 'Poland',
  },
  {
    abbreviation: 'PM',
    name: 'Saint Pierre and Miquelon',
  },
  {
    abbreviation: 'PN',
    name: 'Pitcairn',
  },
  {
    abbreviation: 'PR',
    name: 'Puerto Rico',
  },
  {
    abbreviation: 'PS',
    name: 'Palestine, State of',
  },
  {
    abbreviation: 'PT',
    name: 'Portugal',
  },
  {
    abbreviation: 'PW',
    name: 'Palau',
  },
  {
    abbreviation: 'PY',
    name: 'Paraguay',
  },
  {
    abbreviation: 'QA',
    name: 'Qatar',
  },
  {
    abbreviation: 'RE',
    name: 'R\u00e9union',
  },
  {
    abbreviation: 'RO',
    name: 'Romania',
  },
  {
    abbreviation: 'RS',
    name: 'Serbia',
  },
  {
    abbreviation: 'RU',
    name: 'Russia',
  },
  {
    abbreviation: 'RW',
    name: 'Rwanda',
  },
  {
    abbreviation: 'SA',
    name: 'Saudi Arabia',
  },
  {
    abbreviation: 'SB',
    name: 'Solomon Islands',
  },
  {
    abbreviation: 'SC',
    name: 'Seychelles',
  },
  {
    abbreviation: 'SD',
    name: 'Sudan',
  },
  {
    abbreviation: 'SE',
    name: 'Sweden',
  },
  {
    abbreviation: 'SG',
    name: 'Singapore',
  },
  {
    abbreviation: 'SH',
    name: 'Saint Helena, Ascension and Tristan da Cunha',
  },
  {
    abbreviation: 'SI',
    name: 'Slovenia',
  },
  {
    abbreviation: 'SJ',
    name: 'Svalbard and Jan Mayen',
  },
  {
    abbreviation: 'SK',
    name: 'Slovakia',
  },
  {
    abbreviation: 'SL',
    name: 'Sierra Leone',
  },
  {
    abbreviation: 'SM',
    name: 'San Marino',
  },
  {
    abbreviation: 'SN',
    name: 'Senegal',
  },
  {
    abbreviation: 'SO',
    name: 'Somalia',
  },
  {
    abbreviation: 'SR',
    name: 'Suriname',
  },
  {
    abbreviation: 'SS',
    name: 'South Sudan',
  },
  {
    abbreviation: 'ST',
    name: 'Sao Tome and Principe',
  },
  {
    abbreviation: 'SV',
    name: 'El Salvador',
  },
  {
    abbreviation: 'SX',
    name: 'Sint Maarten (Dutch part)',
  },
  {
    abbreviation: 'SY',
    name: 'Syria',
  },
  {
    abbreviation: 'SZ',
    name: 'Eswatini',
  },
  {
    abbreviation: 'TC',
    name: 'Turks and Caicos Islands',
  },
  {
    abbreviation: 'TD',
    name: 'Chad',
  },
  {
    abbreviation: 'TF',
    name: 'French Southern Territories',
  },
  {
    abbreviation: 'TG',
    name: 'Togo',
  },
  {
    abbreviation: 'TH',
    name: 'Thailand',
  },
  {
    abbreviation: 'TJ',
    name: 'Tajikistan',
  },
  {
    abbreviation: 'TK',
    name: 'Tokelau',
  },
  {
    abbreviation: 'TL',
    name: 'Timor-Leste',
  },
  {
    abbreviation: 'TM',
    name: 'Turkmenistan',
  },
  {
    abbreviation: 'TN',
    name: 'Tunisia',
  },
  {
    abbreviation: 'TO',
    name: 'Tonga',
  },
  {
    abbreviation: 'TR',
    name: 'T\u00fcrkiye',
  },
  {
    abbreviation: 'TT',
    name: 'Trinidad and Tobago',
  },
  {
    abbreviation: 'TV',
    name: 'Tuvalu',
  },
  {
    abbreviation: 'TW',
    name: 'Taiwan',
  },
  {
    abbreviation: 'TZ',
    name: 'Tanzania',
  },
  {
    abbreviation: 'UA',
    name: 'Ukraine',
  },
  {
    abbreviation: 'UG',
    name: 'Uganda',
  },
  {
    abbreviation: 'UM',
    name: 'United States Minor Outlying Islands',
  },
  {
    abbreviation: 'US',
    name: 'United States of America',
  },
  {
    abbreviation: 'UY',
    name: 'Uruguay',
  },
  {
    abbreviation: 'UZ',
    name: 'Uzbekistan',
  },
  {
    abbreviation: 'VA',
    name: 'Holy See',
  },
  {
    abbreviation: 'VC',
    name: 'Saint Vincent and the Grenadines',
  },
  {
    abbreviation: 'VE',
    name: 'Venezuela',
  },
  {
    abbreviation: 'VG',
    name: 'Virgin Islands (British)',
  },
  {
    abbreviation: 'VI',
    name: 'Virgin Islands (U.S.)',
  },
  {
    abbreviation: 'VN',
    name: 'Vietnam',
  },
  {
    abbreviation: 'VU',
    name: 'Vanuatu',
  },
  {
    abbreviation: 'WF',
    name: 'Wallis and Futuna',
  },
  {
    abbreviation: 'WS',
    name: 'Samoa',
  },
  {
    abbreviation: 'XK',
    name: 'Kosovo',
  },
  {
    abbreviation: 'YE',
    name: 'Yemen',
  },
  {
    abbreviation: 'YT',
    name: 'Mayotte',
  },
  {
    abbreviation: 'ZA',
    name: 'South Africa',
  },
  {
    abbreviation: 'ZM',
    name: 'Zambia',
  },
  {
    abbreviation: 'ZW',
    name: 'Zimbabwe',
  },
];

async function seedCountries(db: DB) {
  for (const country of countriesData) {
    const result = await db
      .insert(countries)
      .values(country)
      .onConflictDoNothing({ target: countries.name });
    if (result.rowCount === 0) {
      console.warn(`Country ${country.name} already exists`);
    }
  }
}

void seedCountries(db);
