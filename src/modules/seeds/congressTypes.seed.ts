import { type DB } from '../../db';
import { congressTypes, type NewCongressType } from '../../db/schema';

export const congress: NewCongressType[] = [
  {
    name: 'house',
  },
  {
    name: 'senate',
  },
];

export default async function seedCongressTypes(db: DB) {
  for (const congressType of congress) {
    const result = await db
      .insert(congressTypes)
      .values(congressType)
      .onConflictDoNothing({ target: congressTypes.name });
    if (result.rowCount === 0) {
      console.warn(`Congress type ${congressType.name} already exists`);
    }
  }
}
