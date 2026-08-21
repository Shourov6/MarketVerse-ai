import { Link } from "react-router";
import { trpc } from "@/providers/trpc";
import { Loader2, ArrowRight, Package } from "lucide-react";

export default function Categories() {
  const { data: categories, isLoading } = trpc.category.list.useQuery();

  if (isLoading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-10 w-10 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      {/* Header & Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mb-1.5 font-medium">
            <Link to="/" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Home</Link>
            <span>/</span>
            <span className="text-slate-900 dark:text-white font-semibold">Categories</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
            All Categories
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Browse products by category. Find exactly what you are looking for.
          </p>
        </div>
      </div>

      {categories?.length === 0 ? (
        <div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">No Categories Found</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
            We are currently updating our catalog. Please check back later to discover new categories and products!
          </p>
          <Link
            to="/products"
            className="inline-flex items-center gap-2 px-5 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-bold rounded-lg hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors cursor-pointer"
          >
            Browse All Products
            <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {categories?.map((cat) => (
            <Link
              key={cat.id}
              to={`/category/${cat.slug}`}
              className="group relative overflow-hidden rounded-2xl bg-white dark:bg-slate-800 shadow-sm hover:shadow-lg transition-all border border-slate-200 dark:border-slate-700"
            >
              <div className="aspect-[16/9] overflow-hidden">
                <img
                  src={cat.image || ""}
                  alt={cat.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-black/40 group-hover:bg-black/50 transition-colors" />
              </div>
              <div className="absolute inset-0 flex flex-col justify-end p-6 text-white">
                <h2 className="text-xl font-bold mb-1">{cat.name}</h2>
                <p className="text-sm text-white/80 line-clamp-2 mb-3">{cat.description}</p>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1 text-sm text-white/90">
                    <Package className="h-4 w-4" />
                    {cat.productCount} products
                  </span>
                  <span className="flex items-center gap-1 text-sm font-medium group-hover:translate-x-1 transition-transform">
                    Explore <ArrowRight className="h-4 w-4" />
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
