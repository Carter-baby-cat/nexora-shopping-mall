import { createBrowserRouter, Outlet } from "react-router-dom";
import { RoleGate, RootRoute, SessionExpiryListener } from "./routeGuards";
import { AuthPage } from "../features/auth/AuthPage";
import { ProductDetailPage } from "../features/items/ProductDetailPage";
import { ShopPage } from "../features/items/ShopPage";
import { CartPage } from "../features/cart/CartPage";
import { CheckoutPage } from "../features/orders/CheckoutPage";
import { OrderDetailPage } from "../features/orders/OrderDetailPage";
import { OrdersPage } from "../features/orders/OrdersPage";
import { SeckillOrderPage } from "../features/orders/SeckillOrderPage";
import { AccountPage } from "../features/account/AccountPage";
import { MerchantProductsPage } from "../features/merchant/MerchantProductsPage";
import { MarketplaceLayout } from "../layouts/MarketplaceLayout";
import { HomePage } from "../pages/HomePage";
import { PlaceholderPage } from "../pages/PlaceholderPage";

function ApplicationShell() {
  return (
    <>
      <SessionExpiryListener />
      <Outlet />
    </>
  );
}

export const router = createBrowserRouter([
  {
    path: "/",
    element: <ApplicationShell />,
    children: [
      {
        element: <RootRoute />,
        children: [{ index: true, element: <HomePage /> }],
      },
      { path: "login", element: <AuthPage mode="login" /> },
      { path: "register", element: <AuthPage mode="register" /> },
      {
        element: <RoleGate roles={["ROLE_USER"]} />,
        children: [
          {
            element: <MarketplaceLayout />,
            children: [
              { path: "shop", element: <ShopPage /> },
              { path: "products/:itemId", element: <ProductDetailPage /> },
              { path: "cart", element: <CartPage /> },
              { path: "checkout", element: <CheckoutPage /> },
              { path: "seckill-order", element: <SeckillOrderPage /> },
              { path: "orders", element: <OrdersPage /> },
              { path: "orders/:orderId", element: <OrderDetailPage /> },
            ],
          },
        ],
      },
      {
        element: <RoleGate roles={["ROLE_MERCHANT"]} />,
        children: [
          {
            element: <MarketplaceLayout />,
            children: [
              { path: "merchant/products", element: <MerchantProductsPage /> },
              { path: "merchant/products/new", element: <MerchantProductsPage /> },
              { path: "merchant/products/:itemId/edit", element: <MerchantProductsPage /> },
            ],
          },
        ],
      },
      {
        element: <RoleGate roles={["ROLE_USER", "ROLE_MERCHANT"]} />,
        children: [
          {
            element: <MarketplaceLayout />,
            children: [{ path: "account", element: <AccountPage /> }],
          },
        ],
      },
      { path: "*", element: <PlaceholderPage title="Page Not Found" /> },
    ],
  },
]);
