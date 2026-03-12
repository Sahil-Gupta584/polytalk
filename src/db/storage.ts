import { db } from "./index";
import { translations, type InsertTranslation, type Translation } from "./schema";
import { eq, desc } from "drizzle-orm";

export interface IStorage {
  getTranslations(): Promise<Translation[]>;
  createTranslation(translation: InsertTranslation): Promise<Translation>;
}

export class DatabaseStorage implements IStorage {
  async getTranslations(): Promise<Translation[]> {
    return await db.select().from(translations).orderBy(desc(translations.createdAt));
  }

  async createTranslation(translation: InsertTranslation): Promise<Translation> {
    const [created] = await db.insert(translations).values(translation).returning();
    return created;
  }
}

export const storage = new DatabaseStorage();
