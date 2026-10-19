import { useEffect, useState } from "react";

export function CartProductImage({
  src,
  name,
  itemId,
  index,
}: {
  src?: string;
  name: string;
  itemId: number;
  index: number;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);

  return (
    <div className="checkout-product-visual">
      <span>{String(index + 1).padStart(2, "0")}</span>
      {src && !failed ? (
        <img src={src} alt={name} onError={() => setFailed(true)} />
      ) : (
        <b>NX / {String(itemId).padStart(4, "0")}</b>
      )}
    </div>
  );
}

export function OrderLineImage({
  src,
  name,
  index,
}: {
  src: string | null;
  name: string;
  index: number;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);

  return (
    <div className="order-line-visual">
      <span>{String(index + 1).padStart(2, "0")}</span>
      {src && !failed ? <img src={src} alt={name} onError={() => setFailed(true)} /> : <b>N</b>}
    </div>
  );
}
