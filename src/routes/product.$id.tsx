import { createFileRoute } from "@tanstack/react-router";
import ProductDetail from "@/pages/ProductDetail";
import { loadProductSeo } from "@/lib/seo-data";

export const Route = createFileRoute("/product/$id")({
  loader: ({ params }) => loadProductSeo(params.id),
  head: ({ loaderData }) => {
    const data = loaderData;
    if (!data) {
      return {
        meta: [{ title: "Product — ROELIX" }],
      };
    }

    const title = `${data.product.name} — ROELIX`;
    const description = data.product.description || `${data.product.name} from ROELIX.`;
    const image = data.product.images[0];

    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:type", content: "product" },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        ...(image ? [{ property: "og:image", content: image }] : []),
        { property: "og:url", content: data.url },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
        ...(image ? [{ name: "twitter:image", content: image }] : []),
      ],
      links: [{ rel: "canonical", href: data.url }],
    };
  },
  component: ProductRoute,
});

function ProductRoute() {
  const { id } = Route.useParams();
  const seoData = Route.useLoaderData();
  return <ProductDetail productId={id} seoData={seoData} />;
}
