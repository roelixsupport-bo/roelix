alter table public.site_settings
  add column if not exists storefront_content jsonb not null default '{
    "navVisible": true,
    "customBundle": {
      "visible": true,
      "title": "Build a Custom Set"
    },
    "featured": {
      "visible": true,
      "eyebrowVisible": true,
      "eyebrow": "Curated",
      "titleVisible": true,
      "title": "Featured Collections",
      "showAllFilter": true
    },
    "categories": [
      {"id": "lighting-ambiance", "name": "Lighting & Ambiance", "label": "Lighting & Ambiance", "parentId": null, "visible": true},
      {"id": "luxury-towels", "name": "Luxury Towels", "label": "Luxury Towels", "parentId": null, "visible": true},
      {"id": "hotel-pillows", "name": "Hotel Pillows", "label": "Hotel Pillows", "parentId": null, "visible": true},
      {"id": "mattress-protectors", "name": "Mattress Protectors", "label": "Mattress Protectors", "parentId": null, "visible": true},
      {"id": "bedding-sets", "name": "Bedding Sets", "label": "Bedding Sets", "parentId": null, "visible": true}
    ]
  }'::jsonb;

notify pgrst, 'reload schema';
