import React from 'react';

interface ProductSchemaProps {
  product: {
    id: string | number;
    name: string;
    description: string;
    image: string;
    price: number;
    currency?: string;
    inStock?: boolean;
  };
}

export const ProductSchema: React.FC<ProductSchemaProps> = ({ product }) => {
  const schemaData = {
    "@context": "https://schema.org/",
    "@type": "Product",
    "name": product.name,
    "image": [product.image],
    "description": product.description,
    "brand": {
      "@type": "Brand",
      "name": "Roelix"
    },
    "offers": {
      "@type": "Offer",
      "priceCurrency": product.currency || "EGP",
      "price": product.price,
      "availability": product.inStock !== false 
        ? "https://schema.org/InStock" 
        : "https://schema.org/OutOfStock",
      "url": window.location.href
    }
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaData) }}
    />
  );
};