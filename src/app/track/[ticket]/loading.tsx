import { BrandLoader } from "@/components/BrandLoader";

/** Shown while a client's status loads: the loader, then the page's shape. */
export default function TrackClientLoading() {
  return (
    <div className="space-y-5">
      <BrandLoader
        messages={["Finding the client…", "Checking the stores…", "Getting the latest status…"]}
      />

      <div className="rounded-2xl border bg-card p-6 shadow-xs">
        <div className="skeleton h-6 w-48" />
        <div className="skeleton mt-3 h-3.5 w-72" />
        <div className="skeleton mt-6 h-2.5 w-full rounded-full" />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="overflow-hidden rounded-2xl border bg-card shadow-xs">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3 border-b px-5 py-4 last:border-0">
              <div className="skeleton size-9 rounded-lg" />
              <div className="flex-1 space-y-2">
                <div className="skeleton h-3.5 w-36" />
                <div className="skeleton h-3 w-24" />
              </div>
              <div className="skeleton h-5 w-20 rounded-full" />
            </div>
          ))}
        </div>
        <div className="space-y-3 rounded-2xl border bg-card p-5 shadow-xs">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-3.5 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
