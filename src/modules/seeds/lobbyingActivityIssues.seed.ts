import { type DB } from '../../db';
import {
  lobbyingActivityIssues as lobbyingActivityIssuesTable,
  type NewLobbyingActivityIssue,
} from '../../db/schema';

export const lobbyingActivityIssues: NewLobbyingActivityIssue[] = [
  {
    abbreviation: 'ACC',
    name: 'Accounting',
  },
  {
    abbreviation: 'ADV',
    name: 'Advertising',
  },
  {
    abbreviation: 'AER',
    name: 'Aerospace',
  },
  {
    abbreviation: 'AGR',
    name: 'Agriculture',
  },
  {
    abbreviation: 'ALC',
    name: 'Alcohol and Drug Abuse',
  },
  {
    abbreviation: 'ANI',
    name: 'Animals',
  },
  {
    abbreviation: 'APP',
    name: 'Apparel/Clothing Industry/Textiles',
  },
  {
    abbreviation: 'ART',
    name: 'Arts/Entertainment',
  },
  {
    abbreviation: 'AUT',
    name: 'Automotive Industry',
  },
  {
    abbreviation: 'AVI',
    name: 'Aviation/Airlines/Airports',
  },
  {
    abbreviation: 'BAN',
    name: 'Banking',
  },
  {
    abbreviation: 'BNK',
    name: 'Bankruptcy',
  },
  {
    abbreviation: 'BEV',
    name: 'Beverage Industry',
  },
  {
    abbreviation: 'BUD',
    name: 'Budget/Appropriations',
  },
  {
    abbreviation: 'CIV',
    name: 'Civil Rights/Civil Liberties',
  },
  {
    abbreviation: 'CHM',
    name: 'Chemicals/Chemical Industry',
  },
  {
    abbreviation: 'CAW',
    name: 'Clean Air and Water (quality)',
  },
  {
    abbreviation: 'CDT',
    name: 'Commodities (big ticket)',
  },
  {
    abbreviation: 'COM',
    name: 'Communications/Broadcasting/Radio/TV',
  },
  {
    abbreviation: 'CPI',
    name: 'Computer Industry',
  },
  {
    abbreviation: 'CON',
    name: 'Constitution',
  },
  {
    abbreviation: 'CSP',
    name: 'Consumer Issues/Safety/Products',
  },
  {
    abbreviation: 'CPT',
    name: 'Copyright/Patent/Trademark',
  },
  {
    abbreviation: 'DEF',
    name: 'Defense',
  },
  {
    abbreviation: 'DIS',
    name: 'Disaster Planning/Emergencies',
  },
  {
    abbreviation: 'DOC',
    name: 'District of Columbia',
  },
  {
    abbreviation: 'ECN',
    name: 'Economics/Economic Development',
  },
  {
    abbreviation: 'EDU',
    name: 'Education',
  },
  {
    abbreviation: 'ENG',
    name: 'Energy/Nuclear',
  },
  {
    abbreviation: 'ENV',
    name: 'Environment/Superfund',
  },
  {
    abbreviation: 'FAM',
    name: 'Family issues/Abortion/Adoption',
  },
  {
    abbreviation: 'FIN',
    name: 'Financial Institutions/Investments/Securities',
  },
  {
    abbreviation: 'FIR',
    name: 'Firearms/Guns/Ammunition',
  },
  {
    abbreviation: 'FOO',
    name: 'Food Industry (safety, labeling, etc.)',
  },
  {
    abbreviation: 'FOR',
    name: 'Foreign Relations',
  },
  {
    abbreviation: 'FUE',
    name: 'Fuel/Gas/Oil',
  },
  {
    abbreviation: 'GAM',
    name: 'Gaming/Gambling/Casino',
  },
  {
    abbreviation: 'GOV',
    name: 'Government Issues',
  },
  {
    abbreviation: 'HCR',
    name: 'Health Issues',
  },
  {
    abbreviation: 'HOM',
    name: 'Homeland Security',
  },
  {
    abbreviation: 'HOU',
    name: 'Housing',
  },
  {
    abbreviation: 'IMM',
    name: 'Immigration',
  },
  {
    abbreviation: 'IND',
    name: 'Indian/Native American Affairs',
  },
  {
    abbreviation: 'INS',
    name: 'Insurance',
  },
  {
    abbreviation: 'INT',
    name: 'Intelligence',
  },
  {
    abbreviation: 'LBR',
    name: 'Labor Issues/Antitrust/Workplace',
  },
  {
    abbreviation: 'LAW',
    name: 'Law Enforcement/Crime/Criminal Justice',
  },
  {
    abbreviation: 'MAN',
    name: 'Manufacturing',
  },
  {
    abbreviation: 'MAR',
    name: 'Marine/Maritime/Boating/Fisheries',
  },
  {
    abbreviation: 'MIA',
    name: 'Media (information/publishing)',
  },
  {
    abbreviation: 'MED',
    name: 'Medical/Disease Research/Clinical Labs',
  },
  {
    abbreviation: 'MMM',
    name: 'Medicare/Medicaid',
  },
  {
    abbreviation: 'MON',
    name: 'Minting/Money/Gold Standard',
  },
  {
    abbreviation: 'NAT',
    name: 'Natural Resources',
  },
  {
    abbreviation: 'PHA',
    name: 'Pharmacy',
  },
  {
    abbreviation: 'POS',
    name: 'Postal',
  },
  {
    abbreviation: 'RRR',
    name: 'Railroads',
  },
  {
    abbreviation: 'RES',
    name: 'Real Estate/Land Use/Conservation',
  },
  {
    abbreviation: 'REL',
    name: 'Religion',
  },
  {
    abbreviation: 'RET',
    name: 'Retirement',
  },
  {
    abbreviation: 'ROD',
    name: 'Roads/Highway',
  },
  {
    abbreviation: 'SCI',
    name: 'Science/Technology',
  },
  {
    abbreviation: 'SMB',
    name: 'Small Business',
  },
  {
    abbreviation: 'SPO',
    name: 'Sports/Athletics',
  },
  {
    abbreviation: 'TAR',
    name: 'Tariff (miscellaneous tariff bills)',
  },
  {
    abbreviation: 'TAX',
    name: 'Taxation/Internal Revenue Code',
  },
  {
    abbreviation: 'TEC',
    name: 'Telecommunications',
  },
  {
    abbreviation: 'TOB',
    name: 'Tobacco',
  },
  {
    abbreviation: 'TOR',
    name: 'Torts',
  },
  {
    abbreviation: 'TRD',
    name: 'Trade (domestic/foreign)',
  },
  {
    abbreviation: 'TRA',
    name: 'Transportation',
  },
  {
    abbreviation: 'TOU',
    name: 'Travel/Tourism',
  },
  {
    abbreviation: 'TRU',
    name: 'Trucking/Shipping',
  },
  {
    abbreviation: 'URB',
    name: 'Urban Development/Municipalities',
  },
  {
    abbreviation: 'UNM',
    name: 'Unemployment',
  },
  {
    abbreviation: 'UTI',
    name: 'Utilities',
  },
  {
    abbreviation: 'VET',
    name: 'Veterans',
  },
  {
    abbreviation: 'WAS',
    name: 'Waste (hazardous/solid/interstate/nuclear)',
  },
  {
    abbreviation: 'WEL',
    name: 'Welfare',
  },
];

export default async function seedLobbyingActivityIssues(db: DB) {
  for (const lobbyingActivityIssue of lobbyingActivityIssues) {
    const result = await db
      .insert(lobbyingActivityIssuesTable)
      .values(lobbyingActivityIssue)
      .onConflictDoNothing({ target: lobbyingActivityIssuesTable.name });
    if (result.rowCount === 0) {
      console.warn(
        `Lobbying activity issue ${lobbyingActivityIssue.name} already exists`,
      );
    }
  }
}
