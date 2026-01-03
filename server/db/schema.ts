import { pgTable, uuid, text, integer, boolean, timestamp, bigint } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Profiles table
export const profiles = pgTable("profiles", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().unique(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  businessName: text("business_name"),
  businessSector: text("business_sector"),
  country: text("country"),
  bio: text("bio"),
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// Applications table
// Note: user_id references auth.users(id) in Supabase, but we can't reference that table here
// The foreign key constraint is handled by Supabase migrations
export const applications = pgTable("applications", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id"), // References auth.users(id) - constraint handled by Supabase
  projectId: integer("project_id").notNull(),
  companyName: text("company_name").notNull(),
  contactEmail: text("contact_email").notNull(),
  contactPhone: text("contact_phone"),
  projectDescription: text("project_description").notNull(),
  fundingAmountRequested: text("funding_amount_requested").notNull(),
  businessPlan: text("business_plan"),
  teamSize: integer("team_size"),
  location: text("location"),
  status: text("status").default("pending"),
  applicationFeePaid: boolean("application_fee_paid").default(false),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// Application documents table
export const applicationDocuments = pgTable("application_documents", {
  id: uuid("id").defaultRandom().primaryKey(),
  applicationId: uuid("application_id").references(() => applications.id, { onDelete: "cascade" }),
  userId: uuid("user_id"), // References auth.users(id) - constraint handled by Supabase
  fileName: text("file_name").notNull(),
  filePath: text("file_path").notNull(),
  fileSize: bigint("file_size", { mode: "number" }),
  fileType: text("file_type"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// Relations
export const profilesRelations = relations(profiles, ({ many }) => ({
  applications: many(applications),
  documents: many(applicationDocuments),
}));

export const applicationsRelations = relations(applications, ({ many }) => ({
  documents: many(applicationDocuments),
}));

export const applicationDocumentsRelations = relations(applicationDocuments, ({ one }) => ({
  application: one(applications, {
    fields: [applicationDocuments.applicationId],
    references: [applications.id],
  }),
}));

// Type exports
export type Profile = typeof profiles.$inferSelect;
export type NewProfile = typeof profiles.$inferInsert;
export type Application = typeof applications.$inferSelect;
export type NewApplication = typeof applications.$inferInsert;
export type ApplicationDocument = typeof applicationDocuments.$inferSelect;
export type NewApplicationDocument = typeof applicationDocuments.$inferInsert;

