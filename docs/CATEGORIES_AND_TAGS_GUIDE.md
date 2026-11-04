# Categories and Tags Guide

## Overview

The system uses **both categories and tags** for different purposes:

### Categories (Single per Opportunity)
- **Purpose**: Reviewer assignment and review rubrics
- **Relationship**: One category per opportunity (`opportunities.category_id`)
- **Used for**:
  - Matching reviewers to opportunities (reviewers are assigned to categories)
  - Review scoring (rubrics are defined per category)
  - Application review workflow

### Tags (Multiple per Opportunity)
- **Purpose**: Flexible categorization and filtering
- **Relationship**: Many-to-many via `opportunity_tag_map`
- **Used for**:
  - UI filtering and search
  - Display and organization
  - Flexible, user-facing categorization

## Database Schema

### Opportunities Table
```sql
opportunities (
  id SERIAL PRIMARY KEY,
  category_id INTEGER REFERENCES categories(id),  -- Single category for review system
  -- ... other fields
)
```

### Tags System
```sql
opportunity_tags (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE
)

opportunity_tag_map (
  opportunity_id INTEGER REFERENCES opportunities(id),
  tag_id INTEGER REFERENCES opportunity_tags(id),
  PRIMARY KEY (opportunity_id, tag_id)
)
```

## Usage Examples

### Setting Category (Required for Review System)
```sql
-- When creating an opportunity, set the category
UPDATE opportunities 
SET category_id = 1  -- e.g., "Technology"
WHERE id = 123;
```

### Setting Tags (Optional, for Filtering)
```sql
-- Add multiple tags to an opportunity
INSERT INTO opportunity_tag_map (opportunity_id, tag_id)
VALUES 
  (123, 1),  -- "AI"
  (123, 2),  -- "Climate"
  (123, 3);  -- "Fintech"
```

### Querying with Both

```sql
-- Get opportunities with category and tags
SELECT 
  o.*,
  c.name AS category_name,
  jsonb_agg(
    jsonb_build_object('id', ot.id, 'name', ot.name, 'slug', ot.slug)
  ) AS tags
FROM opportunities o
LEFT JOIN categories c ON c.id = o.category_id
LEFT JOIN opportunity_tag_map otm ON otm.opportunity_id = o.id
LEFT JOIN opportunity_tags ot ON ot.id = otm.tag_id
WHERE o.status = 'open'
GROUP BY o.id, c.name;
```

## When to Use Each

### Use Category When:
- ✅ Assigning reviewers (reviewers are assigned to categories)
- ✅ Setting up review rubrics (rubrics are per category)
- ✅ Review workflow and scoring
- ✅ Administrative categorization

### Use Tags When:
- ✅ User-facing filtering and search
- ✅ Multiple categorization (e.g., "AI" + "Climate" + "Africa")
- ✅ Flexible, ad-hoc organization
- ✅ Display and discovery features

## Best Practices

1. **Always set a category** for opportunities that need review
2. **Use tags liberally** for better discoverability
3. **Keep categories stable** (they affect reviewer assignments)
4. **Tags can change** without affecting the review system
5. **Use categories for structure**, tags for flexibility

## Migration Notes

- The `opportunities` table now has `category_id` column
- Both systems work together seamlessly
- Existing code using tags continues to work
- Review system uses categories as before

