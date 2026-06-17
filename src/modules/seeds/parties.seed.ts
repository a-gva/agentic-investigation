import { type DB } from '../../db';
import { parties as partiesTable, type NewParty } from '../../db/schema';

export const parties: NewParty[] = [
  {
    name: 'Democratic',
    acronym: 'D',
  },
  {
    name: 'Republican',
    acronym: 'R',
  },
];

export default async function seedParties(db: DB) {
  for (const party of parties) {
    const result = await db
      .insert(partiesTable)
      .values(party)
      .onConflictDoNothing({ target: partiesTable.name });
    if (result.rowCount === 0) {
      console.warn(`Party ${party.name} already exists`);
    }
  }
}
