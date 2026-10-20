import { useEffect } from 'react';

export interface OrganizationSchema {
  name: string;
  url: string;
  logo?: string;
  description?: string;
}

export interface ArticleSchema {
  headline: string;
  description: string;
  image?: string;
  datePublished: string;
  author: {
    name: string;
  };
  publisher: {
    name: string;
  };
}

export interface ProjectSchema {
  name: string;
  description: string;
  image?: string;
  url: string;
  fundingAmount?: string;
  location?: {
    name: string;
  };
  startDate?: string;
  endDate?: string;
  sector?: string;
}

export interface WebSiteSchema {
  name: string;
  url: string;
}

interface StructuredDataProps {
  type: 'Organization' | 'Article' | 'Project' | 'WebSite';
  data: OrganizationSchema | ArticleSchema | ProjectSchema | WebSiteSchema;
  id?: string;
}

export const StructuredData = ({ type, data, id = 'structured-data' }: StructuredDataProps) => {
  useEffect(() => {
    // Remove existing structured data with this ID
    const existing = document.getElementById(id);
    if (existing) {
      existing.remove();
    }

    let schema: Record<string, any> = {
      '@context': 'https://schema.org',
      '@type': type,
    };

    switch (type) {
      case 'Organization':
        const orgData = data as OrganizationSchema;
        schema = {
          ...schema,
          name: orgData.name,
          url: orgData.url,
          ...(orgData.logo && { logo: orgData.logo }),
          ...(orgData.description && { description: orgData.description }),
        };
        break;

      case 'Article':
        const articleData = data as ArticleSchema;
        schema = {
          ...schema,
          headline: articleData.headline,
          description: articleData.description,
          ...(articleData.image && { image: articleData.image }),
          datePublished: articleData.datePublished,
          author: {
            '@type': 'Person',
            name: articleData.author.name,
          },
          publisher: {
            '@type': 'Organization',
            name: articleData.publisher.name,
          },
        };
        break;

      case 'Project':
        const projectData = data as ProjectSchema;
        schema = {
          ...schema,
          name: projectData.name,
          description: projectData.description,
          ...(projectData.image && { image: projectData.image }),
          url: projectData.url,
          ...(projectData.fundingAmount && { fundingAmount: projectData.fundingAmount }),
          ...(projectData.location && {
            location: {
              '@type': 'Place',
              name: projectData.location.name,
            },
          }),
          ...(projectData.startDate && { startDate: projectData.startDate }),
          ...(projectData.endDate && { endDate: projectData.endDate }),
          ...(projectData.sector && { sector: projectData.sector }),
        };
        break;

      case 'WebSite':
        const websiteData = data as WebSiteSchema;
        schema = {
          ...schema,
          name: websiteData.name,
          url: websiteData.url,
        };
        break;
    }

    const script = document.createElement('script');
    script.id = id;
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify(schema);
    document.head.appendChild(script);

    return () => {
      const scriptToRemove = document.getElementById(id);
      if (scriptToRemove) {
        scriptToRemove.remove();
      }
    };
  }, [type, data, id]);

  return null;
};









