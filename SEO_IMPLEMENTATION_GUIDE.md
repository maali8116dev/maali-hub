# SEO Implementation Guide

## Essential SEO Components

### SEO Component Usage

```tsx
import { SEO } from "@/components/seo/SEO";

<SEO
  title="Page Title"
  description="Page description (150-160 characters)"
  image="/path/to/image.jpg" // Optional
  url={siteUrl} // Optional, defaults to current URL
  type="website" // or "article"
  canonical={canonicalUrl} // Optional
  noindex={false} // Set to true to prevent indexing
/>;
```

### Structured Data Usage

```tsx
import { StructuredData } from "@/components/seo/StructuredData";

// Organization (homepage)
<StructuredData
  type="Organization"
  data={{
    name: "Maali Platform",
    url: siteUrl,
    description: "Description",
  }}
/>

// Article (blog posts)
<StructuredData
  type="Article"
  data={{
    headline: "Article Title",
    description: "Article description",
    image: "image-url",
    datePublished: "2024-01-01",
    author: { name: "Author Name" },
    publisher: { name: "Maali Platform" },
  }}
/>

// Project (funding opportunities)
<StructuredData
  type="Project"
  data={{
    name: "Project Title",
    description: "Project description",
    url: projectUrl,
    fundingAmount: "$10,000",
    location: { name: "Location" },
  }}
/>
```

## Testing

- **Google Rich Results Test**: https://search.google.com/test/rich-results
- **Facebook Sharing Debugger**: https://developers.facebook.com/tools/debug/
- **Twitter Card Validator**: https://cards-dev.twitter.com/validator

## Environment Variables

```env
VITE_SITE_URL=https://yourdomain.com
```
