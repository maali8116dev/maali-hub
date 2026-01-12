import { pgTable, uuid, text, integer, boolean, timestamp, bigint, serial, date, decimal, pgEnum } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// User role enum
export const userRoleEnum = pgEnum("user_role", ["admin", "reviewer", "applicant"]);

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
  role: userRoleEnum("role").notNull().default("applicant"),
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

// Projects/Opportunities table
export const projects = pgTable("projects", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(),
  status: text("status").notNull().default("open"), // 'new', 'open', 'closing-soon', 'closed'
  deadline: date("deadline").notNull(),
  fundingAmount: text("funding_amount").notNull(),
  location: text("location").notNull(),
  imageUrl: text("image_url"),
  requirements: text("requirements"),
  eligibilityCriteria: text("eligibility_criteria"),
  applicationFee: decimal("application_fee", { precision: 10, scale: 2 }).default("0"),
  maxApplicants: integer("max_applicants"),
  currentApplicants: integer("current_applicants").default(0),
  createdBy: uuid("created_by").references(() => profiles.userId),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// Blog posts table
export const blogPosts = pgTable("blog_posts", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  excerpt: text("excerpt").notNull(),
  content: text("content").notNull(),
  author: text("author").notNull(),
  category: text("category").notNull(),
  readTime: text("read_time").notNull(),
  imageUrl: text("image_url").notNull(),
  featured: boolean("featured").default(false),
  status: text("status").notNull().default("draft"), // 'draft', 'published', 'archived'
  tags: text("tags"),
  views: integer("views").default(0),
  createdBy: uuid("created_by").references(() => profiles.userId),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  publishedAt: timestamp("published_at", { withTimezone: true }),
});

// Relations
export const projectsRelations = relations(projects, ({ many }) => ({
  applications: many(applications),
}));

export const blogPostsRelations = relations(blogPosts, ({ one }) => ({
  creator: one(profiles, {
    fields: [blogPosts.createdBy],
    references: [profiles.userId],
  }),
}));

// Note: applications.projectId references projects.id, but since projectId is integer
// and projects.id is serial (integer), we need to handle this relation carefully
// The foreign key constraint is handled by Supabase migrations

// Type exports
export type Profile = typeof profiles.$inferSelect;
export type NewProfile = typeof profiles.$inferInsert;
export type Application = typeof applications.$inferSelect;
export type NewApplication = typeof applications.$inferInsert;
export type ApplicationDocument = typeof applicationDocuments.$inferSelect;
export type NewApplicationDocument = typeof applicationDocuments.$inferInsert;
export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type BlogPost = typeof blogPosts.$inferSelect;
export type NewBlogPost = typeof blogPosts.$inferInsert;

// User role type
export type UserRole = "admin" | "reviewer" | "applicant";

