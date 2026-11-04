# SEO Implementation Guide

## Overview

This guide covers the SEO implementation for the Maali Opportunity Hub platform, including essential components, structured data, and best practices.

---

## ✅ What's Implemented

### Core SEO Components

1. **SEO Component** (`src/components/seo/SEO.tsx`)
   - Title tags
   - Meta descriptions
   - Open Graph tags (social sharing)
   - Twitter Card tags
   - Canonical URLs
   - Robots meta (noindex when needed)

2. **Structured Data** (`src/components/seo/StructuredData.tsx`)
   - Organization schema
   - Article schema
   - Project schema
   - WebSite schema

3. **Updated Pages**
   - Homepage with Organization & WebSite schemas
   - Project Details with Project schema

4. **Robots.txt**
   - Blocks admin/dashboard pages
   - Allows search engine crawling

---

## Essential SEO Elements

1. **Title Tags** - Unique per page
2. **Meta Descriptions** - Compelling, 150-160 chars
3. **Open Graph** - For social media sharing
4. **Canonical URLs** - Prevents duplicate content
5. **Structured Data** - Helps search engines understand content

---

## Usage

### SEO Component

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
/>
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

---

## Environment Variables

```env
VITE_SITE_URL=https://yourdomain.com
```

Set this in your `.env` file for proper canonical URLs and Open Graph tags.

---

## Testing

Use these tools to verify your SEO implementation:

- **Google Rich Results Test**: https://search.google.com/test/rich-results
- **Facebook Sharing Debugger**: https://developers.facebook.com/tools/debug/
- **Twitter Card Validator**: https://cards-dev.twitter.com/validator

---

## Next Steps

1. ✅ Set `VITE_SITE_URL` in `.env`
2. ✅ Add SEO component to remaining pages (Blog, Projects listing, etc.)
3. ⚠️ Test with Google Rich Results Test
4. ⚠️ Submit sitemap to Google Search Console (when available)

---

## Best Practices

1. **Unique Titles**: Each page should have a unique, descriptive title (50-60 characters)
2. **Compelling Descriptions**: Write meta descriptions that encourage clicks (150-160 characters)
3. **Image Optimization**: Use high-quality images with descriptive alt text
4. **Structured Data**: Implement relevant schemas for better search visibility
5. **Mobile-Friendly**: Ensure all pages are responsive and mobile-optimized
6. **Fast Loading**: Optimize images and code for fast page load times
7. **Internal Linking**: Link between related pages to improve site structure

