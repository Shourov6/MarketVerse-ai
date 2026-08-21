import { Link } from "react-router";
import { trpc } from "@/providers/trpc";
import { Star, Loader2, Store, Package, ArrowRight } from "lucide-react";

export default function Sellers() {
  const { data: sellers, isLoading } = trpc.seller.list.useQuery();

  if (isLoading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-10 w-10 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">Our Sellers</h1>
        <p className="text-slate-500 dark:text-slate-400">
          Discover trusted sellers with great products and excellent service.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {sellers?.map((seller: any) => (
          <Link
            key={seller.id}
            to={`/seller/${seller.id}`}
            className="group bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 hover:shadow-lg transition-all"
          >
            <div className="flex items-start gap-4">
              <div className="h-14 w-14 rounded-xl bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-xl font-bold text-indigo-600 dark:text-indigo-400 shrink-0">
                {seller.logo ? (
                  <img src={seller.logo} alt={seller.businessName} className="h-full w-full object-cover rounded-xl" />
                ) : (
                  seller.businessName?.charAt(0) || "S"
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 transition-colors truncate">
                  {seller.businessName}
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2 mt-1">
                  {seller.description}
                </p>
                <div className="flex items-center gap-3 mt-3">
                  <div className="flex items-center gap-1">
                    <Star className="h-4 w-4 text-yellow-400 fill-yellow-400" />
                    <span className="text-sm font-medium">{seller.rating}</span>
                  </div>
                  <span className="text-xs text-slate-400 flex items-center gap-1">
                    <Package className="h-3 w-3" />
                    {seller.totalSales} sales
                  </span>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {sellers?.length === 0 && (
        <div className="py-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center shrink-0">
              <Store className="w-6 h-6 text-amber-500 dark:text-amber-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">No Sellers Found</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                There are currently no registered sellers on the platform. Stay tuned as new stores are added!
              </p>
            </div>
          </div>
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold rounded-lg shadow-sm transition-all group"
          >
            Return to Home
            <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>
      )}
    </div>
  );
}
