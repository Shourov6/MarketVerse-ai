import { Link, useNavigate } from "react-router";
import { trpc } from "@/providers/trpc";
import { formatCurrency } from "@/lib/currency";
import {
  Heart,
  ShoppingCart,
  Trash2,
  Loader2,
  Star,
  ChevronLeft,
} from "lucide-react";

export default function Wishlist() {
  const navigate = useNavigate();
  const { data: items, isLoading } = trpc.wishlist.list.useQuery();
  const utils = trpc.useUtils();
  const removeItem = trpc.wishlist.remove.useMutation({
    onSuccess: () => utils.wishlist.list.invalidate(),
  });
  const addToCart = trpc.cart.add.useMutation({
    onSuccess: () => utils.cart.get.invalidate(),
  });

  const handleBack = () => {
    if (window.history.length > 2 && document.referrer && !document.referrer.includes("/wishlist") && !document.referrer.includes("/checkout")) {
      navigate(-1);
    } else {
      navigate("/products");
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-10 w-10 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!items || items.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16">
        <button
          type="button"
          onClick={handleBack}
          className="inline-flex items-center gap-2 mb-8 text-sm font-bold text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 transition-colors cursor-pointer group"
        >
          <ChevronLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
          Continue Shopping
        </button>
        
        <div className="py-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-xl bg-rose-100 dark:bg-rose-900/40 flex items-center justify-center shrink-0">
              <Heart className="w-6 h-6 text-rose-600 dark:text-rose-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Your Wishlist is Empty</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Save items you love to your wishlist and revisit them anytime. Start exploring to find your favorites!
              </p>
            </div>
          </div>
          <Link
            to="/products"
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-rose-500 hover:bg-rose-600 text-white text-sm font-bold rounded-lg shadow-sm transition-all group"
          >
            Explore Products
            <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>
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
        My Wishlist ({items.length} items)
      </h1>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3.5 sm:gap-4 lg:gap-5">
        {items.map((item: any) => (
          <div
            key={item.id}
            className="group bg-white dark:bg-slate-800 rounded-xl shadow-sm hover:shadow-lg transition-all overflow-hidden border border-slate-100 dark:border-slate-700"
          >
            <Link to={`/product/${item.slug}`} className="block relative aspect-square overflow-hidden bg-slate-100 dark:bg-slate-700">
              <img
                src={`${item.imageUrl}`}
                alt={`${item.name}`}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                loading="lazy"
              />
            </Link>
            <div className="p-4">
              <p className="text-xs text-indigo-600 dark:text-indigo-400 font-medium mb-1">{item.categoryName}</p>
              <Link to={`/product/${item.slug}`}>
                <h3 className="font-semibold text-slate-900 dark:text-white text-sm mb-1 line-clamp-2 group-hover:text-indigo-600 transition-colors">
                  {item.name}
                </h3>
              </Link>
              <p className="text-xs text-slate-500 mb-2">{item.sellerName}</p>

              {item.rating ? (
                <div className="flex items-center gap-1 mb-2">
                  <Star className="h-3.5 w-3.5 text-yellow-400 fill-yellow-400" />
                  <span className="text-xs">{item.rating}</span>
                  <span className="text-xs text-slate-400">({item.reviewCount || 0})</span>
                </div>
              ) : null}

              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900 dark:text-white">{formatCurrency(Number(item.price ?? 0))}</span>
                <div className="flex gap-1">
                  <button
                    onClick={() => removeItem.mutate({ wishlistId: item.id })}
                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    aria-label="Remove from wishlist"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => addToCart.mutate({ productId: item.productId! })}
                    className="p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                    aria-label="Add to cart"
                  >
                    <ShoppingCart className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
