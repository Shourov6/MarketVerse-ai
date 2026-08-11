import { Link } from "react-router";
import { trpc } from "@/providers/trpc";
import { Loader2, ArrowRight, Package } from "lucide-react";

export default function Categories() {
  const { data: categories, isLoading } = trpc.category.list.useQuery();

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-10 w-10 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">All Categories</h1>
        <p className="text-slate-500 dark:text-slate-400">
          Browse products by category. Find exactly what you are looking for.
        </p>
      </div>

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
    </div>
  );
}
