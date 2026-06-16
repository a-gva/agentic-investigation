import { db, type DB } from '../../db';
import { contributionTypes, type NewContributionType } from '../../db/schema';

export const contributionItemTypes: NewContributionType[] = [
  {
    abbreviation: 'feca',
    name: 'FECA',
  },
  {
    abbreviation: 'he',
    name: 'Honorary Expenses',
  },
  {
    abbreviation: 'me',
    name: 'Meeting Expenses',
  },
  {
    abbreviation: 'ple',
    name: 'Presidential Library Expenses',
  },
  {
    abbreviation: 'pic',
    name: 'Presidential Inaugural Committee',
  },
];

async function seedContributionItemTypes(db: DB) {
  for (const contributionItemType of contributionItemTypes) {
    const result = await db
      .insert(contributionTypes)
      .values(contributionItemType)
      .onConflictDoNothing({ target: contributionTypes.name });
    if (result.rowCount === 0) {
      console.warn(
        `Contribution item type ${contributionItemType.abbreviation} already exists`,
      );
    }
  }
}

void seedContributionItemTypes(db);
