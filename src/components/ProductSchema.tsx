import React from "react";

interface ProductSchemaProps {
  product: {
    id: string | number;
    name: string;
    description: string;
    image: string;
    price: number;
    currency?: string;
    inStock?: boolean;
    sku?: string;
    url?: string;
    /** Shown to Google as the rich-result star rating. */
    aggregateRating?: { average: number; count: number };
  };
}

export const ProductSchema: React.FC<ProductSchemaProps> = ({ product }) => {
  // `window` is undefined during SSR, so resolve the offer URL defensively.
  const url = product.url ?? (typeof window !== "undefined" ? window.location.href : undefined);

  const schemaData = {
    "@context": "https://schema.org/",
    "@type": "Product",
    name: product.name,
    ...(product.sku ? { sku: product.sku } : {}),
    ...(product.image ? { image: [product.image] } : {}),
    description: product.description,
    brand: {
      "@type": "Brand",
      name: "Roelix",
    },
    ...(product.aggregateRating && product.aggregateRating.count > 0
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: product.aggregateRating.average,
            reviewCount: product.aggregateRating.count,
            bestRating: 5,
            worstRating: 1,
          },
        }
      : {}),
    offers: {
      "@type": "Offer",
      priceCurrency: product.currency || "EGP",
      price: product.price,
      availability:
        product.inStock !== false ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      ...(url ? { url: url } : {}),
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaData) }}
    />
  );
};
