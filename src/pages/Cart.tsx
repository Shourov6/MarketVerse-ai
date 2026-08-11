import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency } from "@/lib/currency";
import {
  ShoppingCart,
  Trash2,
  Minus,
  Plus,
  ArrowRight,
  Loader2,
  Package,
  ChevronLeft,
} from "lucide-react";
import {
  getGuestCartItems,
  getGuestCartTotal,
  getGuestCartCount,
  updateGuestCartItem,
  removeGuestCartItem,
  clearGuestCart,
  type GuestCartItem,
} from "@/lib/guestCart";

export default function Cart() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const {
    data: cart,
    isLoading,
    error: cartError,
  } = trpc.cart.get.useQuery(undefined, { enabled: isAuthenticated });
  const utils = trpc.useUtils();
  const [guestItems, setGuestItems] = useState<GuestCartItem[]>([]);

  const updateQuantityMutation = trpc.cart.updateQuantity.useMutation({
    onSuccess: () => utils.cart.get.invalidate(),
  });
  const removeItemMutation = trpc.cart.remove.useMutation({
    onSuccess: () => utils.cart.get.invalidate(),
  });
  const clearCartMutation = trpc.cart.clear.useMutation({
    onSuccess: () => utils.cart.get.invalidate(),
  });

  useEffect(() => {
    if (!isAuthenticated) {
      setGuestItems(getGuestCartItems());
    }
  }, [isAuthenticated]);

  const items = isAuthenticated ? cart?.items || [] : guestItems;
  const total = isAuthenticated ? cart?.total ?? 0 : getGuestCartTotal();
  const itemCount = isAuthenticated ? cart?.itemCount ?? 0 : getGuestCartCount();

  const updateQuantity = (itemId: number, quantity: number) => {
    if (isAuthenticated) {
      updateQuantityMutation.mutate({ cartItemId: itemId, quantity });
      return;
    }
    setGuestItems(updateGuestCartItem(itemId, quantity));
    window.dispatchEvent(new Event("guest-cart-updated"));
  };

  const removeItem = (itemId: number) => {
    if (isAuthenticated) {
      removeItemMutation.mutate({ cartItemId: itemId });
      return;
    }

    setGuestItems(removeGuestCartItem(itemId));
    window.dispatchEvent(new Event("guest-cart-updated"));
  };

  const clearItems = () => {
    if (isAuthenticated) {
      clearCartMutation.mutate();
      return;
    }

    clearGuestCart();
    setGuestItems([]);
    window.dispatchEvent(new Event("guest-cart-updated"));
  };

  const handleBack = () => {
    if (window.history.length > 2 && document.referrer && !document.referrer.includes("/cart") && !document.referrer.includes("/checkout")) {
      navigate(-1);
    } else {
      navigate("/products");
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-10 w-10 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (cartError) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center">
        <button
          type="button"
          onClick={handleBack}
          className="inline-flex items-center gap-2 mb-6 text-sm font-semibold text-slate-600 hover:text-indigo-600 dark:text-slate-300 dark:hover:text-indigo-400 transition-colors cursor-pointer"
        >
          <ChevronLeft className="h-4 w-4" />
          Continue Shopping
        </button>
        <div className="inline-flex items-center justify-center h-20 w-20 bg-slate-100 dark:bg-slate-800 rounded-full mb-4">
          <ShoppingCart className="h-10 w-10 text-slate-400" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Unable to load cart</h2>
        <p className="text-slate-500 dark:text-slate-400 mb-6">
          {cartError.message || "An unexpected error occurred while loading your cart."}
        </p>
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors cursor-pointer"
        >
          Retry
        </button>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center">
        <button
          type="button"
          onClick={handleBack}
          className="inline-flex items-center gap-2 mb-6 text-sm font-semibold text-slate-600 hover:text-indigo-600 dark:text-slate-300 dark:hover:text-indigo-400 transition-colors cursor-pointer"
        >
          <ChevronLeft className="h-4 w-4" />
          Continue Shopping
        </button>
        <div className="inline-flex items-center justify-center h-20 w-20 bg-slate-100 dark:bg-slate-800 rounded-full mb-4">
          <ShoppingCart className="h-10 w-10 text-slate-400" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Your Cart is Empty</h2>
        <p className="text-slate-500 dark:text-slate-400 mb-6">
          Looks like you have not added any products to your cart yet.
        </p>
        <Link
          to="/products"
          className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors inline-block"
        >
          Start Shopping
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <button
        type="button"
        onClick={handleBack}
        className="inline-flex items-center gap-2 mb-6 text-sm font-semibold text-slate-600 hover:text-indigo-600 dark:text-slate-300 dark:hover:text-indigo-400 transition-colors cursor-pointer"
      >
        <ChevronLeft className="h-4 w-4" />
        Continue Shopping
      </button>
      <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mb-6">
        Shopping Cart ({itemCount} items)
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Cart Items */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-500 dark:text-slate-400">{items.length} products</span>
            <button
              onClick={clearItems}
              className="flex items-center gap-1 text-sm text-red-500 hover:text-red-600 transition-colors"
            >
              <Trash2 className="h-4 w-4" />
              Clear Cart
            </button>
          </div>

          {items.map((item: any) => (
            <div
              key={item.id}
              className="flex gap-4 p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700"
            >
              <Link to={`/product/${item.slug}`} className="shrink-0">
                <img
                  src={`${item.imageUrl}`}
                  alt={`${item.name}`}
                  className="w-20 h-20 sm:w-24 sm:h-24 object-cover rounded-lg"
                />
              </Link>
              <div className="flex-1 min-w-0">
                <Link to={`/product/${item.slug}`}>
                  <h3 className="font-medium text-slate-900 dark:text-white text-sm sm:text-base line-clamp-2 hover:text-indigo-600 transition-colors">
                    {item.name}
                  </h3>
                </Link>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                  {formatCurrency(item.price ?? 0)} each
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {item.stock !== null && item.stock !== undefined ? `${item.stock} in stock` : ""}
                </p>

                <div className="flex items-center justify-between mt-3">
                  <div className="flex items-center border border-slate-200 dark:border-slate-700 rounded-lg">
                    <button
                      onClick={() => {
                        if (item.quantity > 1) {
                          updateQuantity(item.id, item.quantity - 1);
                        }
                      }}
                      className="px-2 py-1 text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-l-lg"
                      aria-label="Decrease quantity"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="px-3 py-1 text-sm font-medium text-slate-900 dark:text-white min-w-[2rem] text-center">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => updateQuantity(item.id, item.quantity + 1)}
                      className="px-2 py-1 text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-r-lg"
                      aria-label="Increase quantity"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="font-bold text-slate-900 dark:text-white">
                      {formatCurrency((item.price ?? 0) * item.quantity)}
                    </span>
                    <button
                      onClick={() => removeItem(item.id)}
                      className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"
                      aria-label="Remove item"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Order Summary */}
        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 sticky top-24">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Order Summary</h2>

            <div className="space-y-3 mb-6">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500 dark:text-slate-400">Subtotal</span>
                <span className="text-slate-900 dark:text-white">{formatCurrency(total)}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <div className="flex flex-col">
                  <span className="text-slate-700 dark:text-slate-300 font-medium">Courier Delivery Fee</span>
                  <span className="text-[11px] text-indigo-600 dark:text-indigo-400">
                    Est. (Pathao / Steadfast)
                  </span>
                </div>
                <span className="text-slate-900 dark:text-white font-semibold">{formatCurrency(60)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500 dark:text-slate-400">Tax (5% VAT)</span>
                <span className="text-slate-900 dark:text-white">{formatCurrency(total * 0.05)}</span>
              </div>
              <div className="border-t border-slate-200 dark:border-slate-700 pt-3">
                <div className="flex justify-between">
                  <span className="font-bold text-slate-900 dark:text-white">Total</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {formatCurrency(total + 60 + total * 0.05)}
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={() => navigate("/checkout")}
              className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors"
            >
              Proceed to Checkout
              <ArrowRight className="h-4 w-4" />
            </button>

            <div className="mt-4 flex items-center justify-center gap-2 text-xs text-slate-500">
              <Package className="h-3.5 w-3.5" />
              Free shipping on orders over BDT 5,000
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
