import { useEffect, useRef, useState, type FormEvent } from "react";
import { normalizeApiError } from "../../api/types";
import {
  createMerchantItem,
  getMerchantItemImages,
  updateMerchantItem,
  uploadMerchantItemImage,
} from "./merchantApi";
import type {
  CreateMerchantItemRequest,
  MerchantItem,
  UpdateMerchantItemRequest,
} from "./merchantTypes";

type ProductImageDraft = {
  key: string;
  url: string | null;
  previewUrl: string;
  file?: File;
};

type ProductFormValues = {
  name: string;
  brand: string;
  category: string;
  price: string;
  stock: string;
  description: string;
  isSeckill: boolean;
  endTime: string;
};

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const MAX_PRICE = 9_999_999_999.99;

function createKey() {
  return (
    globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`
  );
}

function toDateTimeLocal(value: string | null) {
  return value ? value.replace(" ", "T").slice(0, 16) : "";
}

function toBackendDateTime(value: string) {
  return value ? `${value.replace("T", " ")}:00` : null;
}

export function MerchantProductFormDialog({
  product,
  onClose,
  onSaved,
}: {
  product: MerchantItem | null;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const isEditing = product !== null;
  const dialogRef = useRef<HTMLDialogElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const imagesRef = useRef<ProductImageDraft[]>([]);
  const [values, setValues] = useState<ProductFormValues>(() => ({
    name: product?.name ?? "",
    brand: product?.brand ?? "",
    category: product?.category ?? "",
    price: product ? String(product.price) : "",
    stock: product ? String(product.stock) : "",
    description: product?.description ?? "",
    isSeckill: product?.isSeckill ?? false,
    endTime: toDateTimeLocal(product?.endTime ?? null),
  }));
  const [images, setImages] = useState<ProductImageDraft[]>(() =>
    product
      ? getMerchantItemImages(product).map((url) => ({ key: createKey(), url, previewUrl: url }))
      : [],
  );
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");

  imagesRef.current = images;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => {
      if (dialog?.open) dialog.close();
      imagesRef.current.forEach((image) => {
        if (image.previewUrl.startsWith("blob:")) URL.revokeObjectURL(image.previewUrl);
      });
    };
  }, []);

  function updateField<K extends keyof ProductFormValues>(key: K, value: ProductFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
    setFormError("");
  }

  function removeImage(image: ProductImageDraft) {
    if (image.previewUrl.startsWith("blob:")) URL.revokeObjectURL(image.previewUrl);
    setImages((current) => current.filter((entry) => entry.key !== image.key));
    setFormError("");
  }

  function addImageFiles(files: FileList | null) {
    if (!files?.length) return;
    const accepted: ProductImageDraft[] = [];
    const rejected: string[] = [];
    Array.from(files).forEach((file) => {
      if (file.type && !file.type.startsWith("image/")) {
        rejected.push(`${file.name}: choose an image file.`);
        return;
      }
      if (file.size > MAX_IMAGE_SIZE) {
        rejected.push(`${file.name}: image must be 5 MB or smaller.`);
        return;
      }
      accepted.push({
        key: createKey(),
        url: null,
        previewUrl: URL.createObjectURL(file),
        file,
      });
    });
    if (accepted.length) setImages((current) => [...current, ...accepted]);
    setFormError(rejected.join(" "));
    if (imageInputRef.current) imageInputRef.current.value = "";
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setFormError("");

    const name = values.name.trim();
    const brand = values.brand.trim();
    const category = values.category.trim();
    const description = values.description.trim();
    const priceText = values.price.trim();
    const price = Number(priceText);
    const validPriceFormat = /^\d+(?:\.\d{1,2})?$/.test(priceText);
    const stock = Number(values.stock);

    if (!name || !brand || !category || !description) {
      setFormError("Complete all required product details.");
      return;
    }
    if (!validPriceFormat || !Number.isFinite(price) || price < 0.01 || price > MAX_PRICE) {
      setFormError("Enter a price from $0.01 to $9,999,999,999.99 with up to two decimals.");
      return;
    }
    if (!isEditing && (!Number.isSafeInteger(stock) || stock < 0 || stock > 2_147_483_647)) {
      setFormError("Starting stock must be a whole number from 0 to 2,147,483,647.");
      return;
    }
    if (!images.length) {
      setFormError("Add at least one product image.");
      return;
    }
    if ((values.isSeckill || (isEditing && product.isSeckill)) && !values.endTime) {
      setFormError("Choose an end time for this flash sale.");
      return;
    }

    setBusy(true);
    try {
      const resolvedImages = [...images];
      for (let index = 0; index < resolvedImages.length; index += 1) {
        const image = resolvedImages[index];
        if (image.url || !image.file) continue;
        setProgress(`UPLOADING IMAGE ${index + 1} / ${resolvedImages.length}`);
        const url = await uploadMerchantItemImage(image.file);
        resolvedImages[index] = { ...image, url, file: undefined };
        setImages([...resolvedImages]);
      }
      const imageUrls = resolvedImages
        .map((image) => image.url)
        .filter(Boolean)
        .join(",");
      if (!imageUrls) throw new Error("At least one product image is required.");

      if (product) {
        setProgress("SAVING PRODUCT");
        const request: UpdateMerchantItemRequest = {
          id: product.id,
          name,
          brand,
          category,
          price,
          description,
          imageUrls,
          status: product.status,
          endTime: product.isSeckill ? toBackendDateTime(values.endTime) : null,
        };
        await updateMerchantItem(request);
        onSaved("Product updated.");
      } else {
        setProgress("PUBLISHING PRODUCT");
        const request: CreateMerchantItemRequest = {
          name,
          brand,
          category,
          price,
          stock,
          description,
          imageUrls,
          isSeckill: values.isSeckill,
          endTime: values.isSeckill ? toBackendDateTime(values.endTime) : null,
        };
        await createMerchantItem(request);
        onSaved("Product published.");
      }
    } catch (cause: unknown) {
      setFormError(normalizeApiError(cause).message);
    } finally {
      setBusy(false);
      setProgress("");
    }
  }

  return (
    <dialog
      className="merchant-modal merchant-product-modal"
      ref={dialogRef}
      aria-labelledby="merchant-product-dialog-title"
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
    >
      <form className="merchant-modal-form" onSubmit={(event) => void submit(event)} noValidate>
        <header className="merchant-modal-header">
          <div>
            <span className="merchant-modal-eyebrow">PRODUCT DETAILS</span>
            <h2 id="merchant-product-dialog-title">
              {isEditing ? "Edit product" : "Add a product"}
            </h2>
          </div>
          <button
            className="merchant-icon-button"
            type="button"
            aria-label="Close dialog"
            disabled={busy}
            onClick={onClose}
          >
            ×
          </button>
        </header>

        <div className="merchant-form-grid">
          <label className="merchant-field">
            <span>
              Product name <b>*</b>
            </span>
            <input
              value={values.name}
              onChange={(event) => updateField("name", event.target.value)}
              maxLength={200}
              autoComplete="off"
              autoFocus
              required
            />
          </label>
          <label className="merchant-field">
            <span>
              Brand <b>*</b>
            </span>
            <input
              value={values.brand}
              onChange={(event) => updateField("brand", event.target.value)}
              maxLength={200}
              required
            />
          </label>
          <label className="merchant-field">
            <span>
              Category <b>*</b>
            </span>
            <input
              value={values.category}
              onChange={(event) => updateField("category", event.target.value)}
              maxLength={100}
              required
            />
          </label>
          <label className="merchant-field">
            <span>
              Price (USD) <b>*</b>
            </span>
            <div className="merchant-input-prefix">
              <span>$</span>
              <input
                inputMode="decimal"
                placeholder="0.00"
                value={values.price}
                onChange={(event) => updateField("price", event.target.value)}
                required
              />
            </div>
          </label>
          {!isEditing && (
            <label className="merchant-field">
              <span>
                Starting stock <b>*</b>
              </span>
              <input
                type="number"
                min="0"
                max="2147483647"
                step="1"
                placeholder="0"
                value={values.stock}
                onChange={(event) => updateField("stock", event.target.value)}
                required
              />
            </label>
          )}
          {isEditing && (
            <div className="merchant-field merchant-readonly-field">
              <span>Listing status</span>
              <strong>{product.status.replace("_", " ")}</strong>
            </div>
          )}
          <label className="merchant-field full">
            <span>
              Description <b>*</b>
            </span>
            <textarea
              rows={3}
              maxLength={5000}
              value={values.description}
              onChange={(event) => updateField("description", event.target.value)}
              required
            />
          </label>

          <div className="merchant-field full">
            <span>
              Product images <b>*</b>
            </span>
            <div className="merchant-image-picker">
              <button
                className="merchant-upload-tile"
                type="button"
                onClick={() => imageInputRef.current?.click()}
                disabled={busy}
              >
                <span>＋</span>
                <small>ADD IMAGE</small>
              </button>
              <input
                ref={imageInputRef}
                className="merchant-file-input"
                type="file"
                accept="image/*"
                multiple
                onChange={(event) => addImageFiles(event.currentTarget.files)}
              />
              <div className="merchant-image-preview-list">
                {images.map((image, index) => (
                  <div className="merchant-image-preview" key={image.key}>
                    <img src={image.previewUrl} alt={`Product image ${index + 1}`} />
                    <button
                      type="button"
                      aria-label={`Remove image ${index + 1}`}
                      disabled={busy}
                      onClick={() => removeImage(image)}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
            <small className="merchant-field-hint">Each image must be 5 MB or smaller.</small>
          </div>

          {!isEditing && (
            <label className="merchant-seckill-toggle full">
              <input
                type="checkbox"
                checked={values.isSeckill}
                onChange={(event) => updateField("isSeckill", event.target.checked)}
              />
              <span className="merchant-toggle-track" />
              <span>
                <strong>Flash sale</strong>
                <small>List as a limited-time item</small>
              </span>
            </label>
          )}
          {(values.isSeckill || (isEditing && product.isSeckill)) && (
            <label className="merchant-field full">
              <span>
                Flash sale ends <b>*</b>
              </span>
              <input
                type="datetime-local"
                value={values.endTime}
                onChange={(event) => updateField("endTime", event.target.value)}
                required
              />
            </label>
          )}
        </div>

        {formError && (
          <div className="merchant-form-error" role="alert">
            {formError}
          </div>
        )}
        {progress && (
          <p className="merchant-form-progress" role="status">
            {progress}
          </p>
        )}
        <footer className="merchant-modal-actions">
          <button
            className="merchant-secondary-button"
            type="button"
            disabled={busy}
            onClick={onClose}
          >
            CANCEL
          </button>
          <button className="merchant-primary-button" type="submit" disabled={busy}>
            {busy ? "WORKING…" : isEditing ? "SAVE CHANGES" : "PUBLISH PRODUCT"}
          </button>
        </footer>
      </form>
    </dialog>
  );
}
