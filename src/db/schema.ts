import type { z } from 'better-auth';
import { pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core'
import { createInsertSchema } from "drizzle-zod";

export const todos = pgTable('todos', {
  id: serial().primaryKey(),
  title: text().notNull(),
  createdAt: timestamp('created_at').defaultNow(),
})


export const translations = pgTable("translations", {
  id: serial("id").primaryKey(),
  primaryLang: text("source_language").notNull(),
  secondaryLang: text("target_language").notNull(),
  sourceText: text("source_text").notNull(),
  translatedText: text("translated_text").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertTranslationSchema = createInsertSchema(translations).omit({ id: true, createdAt: true });

export type Translation = typeof translations.$inferSelect;
export type InsertTranslation = z.infer<typeof insertTranslationSchema>;
