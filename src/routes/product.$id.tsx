import { createFileRoute } from "@tanstack/react-router";
import ProductDetail from "@/pages/ProductDetail";

export const Route = createFileRoute("/product/$id")({
  head: () => ({
    meta: [
      { title: "Product — ROELIX" },
      { name: "description", content: "Discover hotel-grade luxury textiles from ROELIX." },
      { property: "og:title", content: "Product — ROELIX" },
      { property: "og:description", content: "Hotel-grade luxury textiles from ROELIX." },
    ],
  }),
  component: ProductRoute,
});

function ProductRoute() {
  const { id } = Route.useParams();
  // All product, variant and accordion logic lives in the shared page component.
  return <ProductDetail productId={id} />;
}
