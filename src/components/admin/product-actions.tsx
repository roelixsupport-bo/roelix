import { Eye, EyeOff, Pencil, Trash2 } from "lucide-react";

import { productToCloud } from "@/lib/cloud-catalog";
import { deleteLocalProduct, saveLocalProduct } from "@/lib/local-data";
import { supabase } from "@/lib/supabase";
import { STATIC_PRODUCTS, type Product } from "@/lib/store";

const COPY = {
  en: {
    toggle: "Toggle visibility",
    hide: "Hide product",
    show: "Show product",
    edit: "Edit product",
    remove: "Delete product",
    hideConfirm: (name: string) => `Hide ${name} from the shop?`,
    deleteConfirm: (name: string) => `Delete ${name}?`,
    hiddenDone: "Product hidden from shop",
    shownDone: "Product visible in shop",
    deletedDone: "Product deleted",
  },
  ar: {
    toggle: "تغيير الظهور",
    hide: "إخفاء المنتج",
    show: "إظهار المنتج",
    edit: "تعديل المنتج",
    remove: "حذف المنتج",
    hideConfirm: (name: string) => `إخفاء ${name} من المتجر؟`,
    deleteConfirm: (name: string) => `حذف ${name}؟`,
    hiddenDone: "تم إخفاء المنتج من المتجر",
    shownDone: "تم إظهار المنتج في المتجر",
    deletedDone: "تم حذف المنتج",
  },
} as const;

export type ProductActionsProps = {
  product: Product;
  isArabic: boolean;
  onEdit: (product: Product) => void;
  onRun: (action: () => void | Promise<void>, ok: string) => Promise<boolean>;
};

/** Visibility / edit / delete controls, shared by the desktop table and mobile cards. */
export function ProductActions({ product, isArabic, onEdit, onRun }: ProductActionsProps) {
  const text = COPY[isArabic ? "ar" : "en"];

  const toggleVisibility = () => {
    const updated = { ...product, isPublished: !product.isPublished };
    void onRun(
      async () => {
        const { error } = await supabase.from("products").upsert(productToCloud(updated));
        if (error) throw error;
        saveLocalProduct(updated, STATIC_PRODUCTS);
      },
      product.isPublished ? text.hiddenDone : text.shownDone,
    );
  };

  const remove = () => {
    const isBuiltIn = STATIC_PRODUCTS.some((candidate) => candidate.id === product.id);
    const prompt = isBuiltIn ? text.hideConfirm(product.name) : text.deleteConfirm(product.name);
    if (!confirm(prompt)) return;

    if (isBuiltIn) {
      const hidden = { ...product, isPublished: false };
      void onRun(async () => {
        const { error } = await supabase.from("products").upsert(productToCloud(hidden));
        if (error) throw error;
        saveLocalProduct(hidden, STATIC_PRODUCTS);
      }, text.hiddenDone);
      return;
    }

    void onRun(async () => {
      const { error } = await supabase.from("products").delete().eq("id", product.id);
      if (error) throw error;
      deleteLocalProduct(product.id, STATIC_PRODUCTS);
    }, text.deletedDone);
  };

  return (
    <div className="flex items-center justify-end gap-3">
      <button
        type="button"
        aria-label={text.toggle}
        title={product.isPublished ? text.hide : text.show}
        onClick={toggleVisibility}
        className="p-1 hover:text-gold"
      >
        {product.isPublished ? <Eye size={16} /> : <EyeOff size={16} />}
      </button>
      <button
        type="button"
        aria-label={text.edit}
        title={text.edit}
        onClick={() => onEdit(product)}
        className="p-1 hover:text-gold"
      >
        <Pencil size={16} />
      </button>
      <button
        type="button"
        aria-label={text.remove}
        title={text.remove}
        onClick={remove}
        className="p-1 hover:text-destructive"
      >
        <Trash2 size={16} />
      </button>
    </div>
  );
}
