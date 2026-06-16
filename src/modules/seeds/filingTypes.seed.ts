import { db, type DB } from '../../db';
import {
  filingTypes as filingTypesTable,
  type NewFilingType,
} from '../../db/schema';

export const filingTypes: NewFilingType[] = [
  {
    abbreviation: 'RR',
    name: 'Registration',
  },
  {
    abbreviation: 'RA',
    name: 'Registration - Amendment',
  },
  {
    abbreviation: 'Q1',
    name: '1st Quarter - Report',
  },
  {
    abbreviation: 'Q1Y',
    name: '1st Quarter - Report (No Activity)',
  },
  {
    abbreviation: '1T',
    name: '1st Quarter - Termination',
  },
  {
    abbreviation: '1TY',
    name: '1st Quarter - Termination (No Activity)',
  },
  {
    abbreviation: '1A',
    name: '1st Quarter - Amendment',
  },
  {
    abbreviation: '1AY',
    name: '1st Quarter - Amendment (No Activity)',
  },
  {
    abbreviation: '1@',
    name: '1st Quarter - Termination Amendment',
  },
  {
    abbreviation: '1@Y',
    name: '1st Quarter - Termination Amendment (No Activity)',
  },
  {
    abbreviation: 'Q2',
    name: '2nd Quarter - Report',
  },
  {
    abbreviation: 'Q2Y',
    name: '2nd Quarter - Report (No Activity)',
  },
  {
    abbreviation: '2T',
    name: '2nd Quarter - Termination',
  },
  {
    abbreviation: '2TY',
    name: '2nd Quarter - Termination (No Activity)',
  },
  {
    abbreviation: '2A',
    name: '2nd Quarter - Amendment',
  },
  {
    abbreviation: '2AY',
    name: '2nd Quarter - Amendment (No Activity)',
  },
  {
    abbreviation: '2@',
    name: '2nd Quarter - Termination Amendment',
  },
  {
    abbreviation: '2@Y',
    name: '2nd Quarter - Termination Amendment (No Activity)',
  },
  {
    abbreviation: 'Q3',
    name: '3rd Quarter - Report',
  },
  {
    abbreviation: 'Q3Y',
    name: '3rd Quarter - Report (No Activity)',
  },
  {
    abbreviation: '3T',
    name: '3rd Quarter - Termination',
  },
  {
    abbreviation: '3TY',
    name: '3rd Quarter - Termination (No Activity)',
  },
  {
    abbreviation: '3A',
    name: '3rd Quarter - Amendment',
  },
  {
    abbreviation: '3AY',
    name: '3rd Quarter - Amendment (No Activity)',
  },
  {
    abbreviation: '3@',
    name: '3rd Quarter - Termination Amendment',
  },
  {
    abbreviation: '3@Y',
    name: '3rd Quarter - Termination Amendment (No Activity)',
  },
  {
    abbreviation: 'Q4',
    name: '4th Quarter - Report',
  },
  {
    abbreviation: 'Q4Y',
    name: '4th Quarter - Report (No Activity)',
  },
  {
    abbreviation: '4T',
    name: '4th Quarter - Termination',
  },
  {
    abbreviation: '4TY',
    name: '4th Quarter - Termination (No Activity)',
  },
  {
    abbreviation: '4A',
    name: '4th Quarter - Amendment',
  },
  {
    abbreviation: '4AY',
    name: '4th Quarter - Amendment (No Activity)',
  },
  {
    abbreviation: '4@',
    name: '4th Quarter - Termination Amendment',
  },
  {
    abbreviation: '4@Y',
    name: '4th Quarter - Termination Amendment (No Activity)',
  },
  {
    abbreviation: 'MM',
    name: 'Mid-Year Report',
  },
  {
    abbreviation: 'MMY',
    name: 'Mid-Year Report (No Activity)',
  },
  {
    abbreviation: 'MT',
    name: 'Mid-Year Termination',
  },
  {
    abbreviation: 'MTY',
    name: 'Mid-Year Termination (No Activity)',
  },
  {
    abbreviation: 'MA',
    name: 'Mid-Year Amendment',
  },
  {
    abbreviation: 'MAY',
    name: 'Mid-Year Amendment (No Activity)',
  },
  {
    abbreviation: 'M@',
    name: 'Mid-Year Termination Amendment',
  },
  {
    abbreviation: 'M@Y',
    name: 'Mid-Year Termination Amendment (No Activity)',
  },
  {
    abbreviation: 'YY',
    name: 'Year-End Report',
  },
  {
    abbreviation: 'YYY',
    name: 'Year-End Report (No Activity)',
  },
  {
    abbreviation: 'YT',
    name: 'Year-End Termination',
  },
  {
    abbreviation: 'YTY',
    name: 'Year-End Termination (No Activity)',
  },
  {
    abbreviation: 'YA',
    name: 'Year-End Amendment',
  },
  {
    abbreviation: 'YAY',
    name: 'Year-End Amendment (No Activity)',
  },
  {
    abbreviation: 'Y@',
    name: 'Year-End Termination Amendment',
  },
  {
    abbreviation: 'Y@Y',
    name: 'Year-End Termination Amendment (No Activity)',
  },
];

async function seedFilingTypes(db: DB) {
  for (const filingType of filingTypes) {
    const result = await db
      .insert(filingTypesTable)
      .values(filingType)
      .onConflictDoNothing({ target: filingTypesTable.name });
    if (result.rowCount === 0) {
      console.warn(`Filing type ${filingType.abbreviation} already exists`);
    }
  }
}

void seedFilingTypes(db);
