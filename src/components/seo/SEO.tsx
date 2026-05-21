import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export interface SEOProps {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
  type?: 'website' | 'article';
  canonical?: string;
  noindex?: boolean;
}

const DEFAULT_TITLE = 'Maali - Empowering African Entrepreneurs';
const DEFAULT_DESCRIPTION = 'Discover funding opportunities, submit applications, and connect with a thriving ecosystem of entrepreneurs across Africa. Your journey to success starts here.';
const DEFAULT_IMAGE = '/og-image-default.png';
const DEFAULT_SITE_NAME = 'Maali Platform';

const getSiteUrl = () => {
  return import.meta.env.VITE_SITE_URL || window.location.origin;
};

export const SEO = ({
  title,
  description = DEFAULT_DESCRIPTION,
  image = DEFAULT_IMAGE,
  url,
  type = 'website',
  canonical,
  noindex = false,
}: SEOProps) => {
  const location = useLocation();
  const currentUrl = url || `${getSiteUrl()}${location.pathname}`;
  const canonicalUrl = canonical || currentUrl;
  const fullTitle = title ? `${title} | ${DEFAULT_SITE_NAME}` : DEFAULT_TITLE;
  const fullImage = image.startsWith('http') ? image : `${getSiteUrl()}${image}`;

  useEffect(() => {
    // Update document title
    document.title = fullTitle;

    // Helper function to update or create meta tag
    const updateMetaTag = (property: string, content: string, isProperty = false) => {
      const selector = isProperty ? `meta[property="${property}"]` : `meta[name="${property}"]`;
      let element = document.querySelector(selector) as HTMLMetaElement;
      
      if (!element) {
        element = document.createElement('meta');
        if (isProperty) {
          element.setAttribute('property', property);
        } else {
          element.setAttribute('name', property);
        }
        document.head.appendChild(element);
      }
      element.setAttribute('content', content);
    };

    // Helper function to update or create link tag
    const updateLinkTag = (rel: string, href: string, attributes?: Record<string, string>) => {
      const selector = `link[rel="${rel}"]`;
      let element = document.querySelector(selector) as HTMLLinkElement;
      
      if (!element) {
        element = document.createElement('link');
        element.setAttribute('rel', rel);
        document.head.appendChild(element);
      }
      element.setAttribute('href', href);
      
      if (attributes) {
        Object.entries(attributes).forEach(([key, value]) => {
          element.setAttribute(key, value);
        });
      }
    };

    // Essential meta tags
    updateMetaTag('description', description);

    // Robots meta tag (only if noindex is needed)
    if (noindex) {
      updateMetaTag('robots', 'noindex');
    }

    // Open Graph tags (essential for social sharing)
    updateMetaTag('og:title', fullTitle, true);
    updateMetaTag('og:description', description, true);
    updateMetaTag('og:type', type, true);
    updateMetaTag('og:image', fullImage, true);
    updateMetaTag('og:url', currentUrl, true);

    // Twitter Card tags (essential for Twitter sharing)
    updateMetaTag('twitter:card', 'summary_large_image');
    updateMetaTag('twitter:title', fullTitle);
    updateMetaTag('twitter:description', description);
    updateMetaTag('twitter:image', fullImage);

    // Canonical URL (prevents duplicate content)
    updateLinkTag('canonical', canonicalUrl);
  }, [
    fullTitle,
    description,
    fullImage,
    currentUrl,
    canonicalUrl,
    type,
    noindex,
  ]);

  return null;
};









