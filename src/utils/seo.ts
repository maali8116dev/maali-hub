export const getSiteUrl = (): string => {
  return import.meta.env.VITE_SITE_URL || 
         (typeof window !== 'undefined' ? window.location.origin : 'https://maali.platform');
};

export const getImageUrl = (imagePath: string): string => {
  if (!imagePath) {
    return `${getSiteUrl()}/og-image-default.png`;
  }
  
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
    return imagePath;
  }
  
  return `${getSiteUrl()}${imagePath.startsWith('/') ? imagePath : `/${imagePath}`}`;
};

export const truncateDescription = (text: string, maxLength: number = 160): string => {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3).trim() + '...';
};









