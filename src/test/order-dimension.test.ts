import { beforeEach, describe, expect, it } from "vitest";

import { findLocalOrder, placeLocalOrder } from "@/lib/local-data";
import { shippingFor, type EgyptGovernorate } from "@/lib/shipping";
import { EGP_PER_USD, STATIC_PRODUCTS, type Order } from "@/lib/store";

const governorate: EgyptGovernorate = "الجيزة";

const customer: Order["customer"] & { governorate: EgyptGovernorate } = {
  name: "Nour Hassan",
  email: "nour@example.com",
  phone: "01000000000",
  address: "12 Nile Street",
  city: "Dokki",
  governorate,
  country: "Egypt",
};

describe("order lines carry the variant dimension", () => {
  beforeEach(() => localStorage.clear());

  it("stores a dimension per line so inventory can deduct the exact variant", () => {
    const id = placeLocalOrder(
      {
        customer,
        items: [
          {
            id: "cloud-pillow",
            qty: 1,
            size: "Standard",
            color: "White",
            dimension: "50 × 70 cm",
            unitPrice: 140,
          },
          {
            id: "cloud-pillow",
            qty: 1,
            size: "Standard",
            color: "White",
            dimension: "70 × 70 cm",
            unitPrice: 140,
          },
        ],
        payment: "cod",
      },
      STATIC_PRODUCTS,
      shippingFor,
      EGP_PER_USD,
    );

    const order = findLocalOrder(id);
    expect(order?.items).toHaveLength(2);
    expect(order?.items.map((item) => item.dimension)).toEqual(["50 × 70 cm", "70 × 70 cm"]);
    expect(order?.items.map((item) => item.size)).toEqual(["Standard", "Standard"]);
  });

  it("leaves the dimension out when the product does not sell one", () => {
    const id = placeLocalOrder(
      {
        customer,
        items: [{ id: "cloud-pillow", qty: 1, size: "Standard", color: "White", unitPrice: 140 }],
        payment: "cod",
      },
      STATIC_PRODUCTS,
      shippingFor,
      EGP_PER_USD,
    );

    expect(findLocalOrder(id)?.items[0]?.dimension).toBeUndefined();
  });
});
