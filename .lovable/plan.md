

## Sector vs Categories: Recommended Approach

### Decision

Rename the public-facing filter from "Category" to "Sector" while reusing the existing `categories` table data. This gives users a clearer mental model without requiring schema changes. The review system continues using categories internally.

### Changes

**1. Opportunities page (`src/pages/projects/Opportunities.tsx`)**
- Rename the "Category" filter label to "Sector"
- Keep the same data source (`categories` or `tags`) behind it
- Update state variable names for clarity (`selectedCategory` → `selectedSector`)

**2. Optional: Add `sector` field to opportunities table**
- If you want full decoupling from the review categories, add a `sector` text column to `opportunities`
- Populate it from existing category names during migration
- Filter directly on that column in the RPC

### What stays the same
- The `categories` table continues powering the review/rubric system
- Tags remain for flexible multi-label filtering
- No changes to admin workflows or reviewer assignment

### Technical note
This is primarily a UI labeling change. The underlying data model works either way since categories already represent sectors (Technology, Agriculture, etc.). A dedicated `sector` column only becomes necessary if categories diverge from sector meanings in the future.

