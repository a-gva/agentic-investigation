import z from 'zod';
import governmentEntitiesJson from '../../../data/senate/constants/government_entities.json';
import { db, type DB } from '../../db';
import { governmentEntities, newGovernmentEntitySchema } from '../../db/schema';

const governmentEntitiesProcessor = () => {
  return governmentEntitiesJson.map((item: any) => ({
    code: String(item.id),
    name: item.name,
  }));
};

const parsedGovernmentEntities = z
  .array(newGovernmentEntitySchema)
  .parse(governmentEntitiesProcessor());

async function seedGovernmentEntities(db: DB) {
  for (const governmentEntity of parsedGovernmentEntities) {
    const result = await db
      .insert(governmentEntities)
      .values(governmentEntity)
      .onConflictDoNothing({ target: governmentEntities.name });
    if (result.rowCount === 0) {
      console.warn(`Government entity ${governmentEntity.name} already exists`);
    }
  }
}

void seedGovernmentEntities(db);
