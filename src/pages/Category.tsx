import { useParams, Link } from "react-router";
import { trpc } from "@/providers/trpc";
import { formatCurrency } from "@/lib/currency";
import {
  Star,
  ShoppingCart,
  Heart,
  Loader2,
  ChevronRight,
} from "lucide-react";

export default function Category() {
  const { slug } = useParams<{ slug: string }>();
  const { data: category, isLoading: catLoading } = trpc.category.getBySlug.useQuery(
    { slug: slug || "" },
    { enabled: !!slug }
  );
  const { data: productsData, isLoading: prodLoading } = trpc.category.getProducts.useQuery(
    { slug: slug || "" },
    { enabled: !!slug }
  );

  const utils = trpc.useUtils();
  const addToCart = trpc.cart.add.useMutation({
    onSuccess: () => utils.cart.get.invalidate(),
  });
  const addToWishlist = trpc.wishlist.add.useMutation({
    onSuccess: () => utils.wishlist.list.invalidate(),
  });

  if (catLoading || prodLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-10 w-10 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!category) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center">
        <p className="text-lg text-slate-500">Category not found</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-slate-500 mb-6" aria-label="Breadcrumb">
        <Link to="/" className="hover:text-indigo-600">Home</Link>
        <ChevronRight className="h-4 w-4" />
        <Link to="/categories" className="hover:text-indigo-600">Categories</Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-slate-900 dark:text-white font-medium">{category.name}</span>
      </nav>

      {/* Category Header */}
      <div className="relative rounded-2xl overflow-hidden mb-8">
        <img
          src={category.image || "https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=1600&q=80"}
          alt={category.name}
          className="w-full h-48 sm:h-64 object-cover"
        />
        <div className="absolute inset-0 bg-black/50 flex items-center px-8">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">{category.name}</h1>
            <p className="text-white/80 max-w-xl">{category.description}</p>
            <p className="text-white/60 text-sm mt-2">{category.productCount} products</p>
          </div>
        </div>
      </div>

      {/* Products Grid */}
      {productsData?.items.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-lg text-slate-500">No products in this category yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3.5 sm:gap-4 lg:gap-5">
          {productsData?.items.map((product: any) => (
            <div
              key={product.id}
              className="group bg-white dark:bg-slate-800 rounded-xl shadow-sm hover:shadow-lg transition-all overflow-hidden border border-slate-100 dark:border-slate-700"
            >
              <Link to={`/product/${product.slug}`} className="block relative aspect-square overflow-hidden bg-slate-100 dark:bg-slate-700">
                <img
                  src={product.imageUrl || ""}
                  alt={product.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  loading="lazy"
                />
              </Link>
              <div className="p-4">
                <Link to={`/product/${product.slug}`}>
                  <h3 className="font-semibold text-slate-900 dark:text-white text-sm mb-1 line-clamp-2 group-hover:text-indigo-600 transition-colors">
                    {product.name}
                  </h3>
                </Link>
                {product.rating ? (
                  <div className="flex items-center gap-1 mb-2">
                    <Star className="h-3.5 w-3.5 text-yellow-400 fill-yellow-400" />
                    <span className="text-xs">{product.rating}</span>
                    <span className="text-xs text-slate-400">({product.reviewCount || 0})</span>
                  </div>
                ) : null}
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 dark:text-white">{formatCurrency(product.price)}</span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => addToWishlist.mutate({ productId: product.id })}
                      className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"
                      aria-label="Add to wishlist"
                    >
                      <Heart className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => addToCart.mutate({ productId: product.id })}
                      className="p-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
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
      )}
    </div>
  );
}
