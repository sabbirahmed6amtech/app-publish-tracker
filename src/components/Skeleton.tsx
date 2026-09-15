/**
 * Loading placeholders. Each one mirrors the shape of the real thing so the
 * swap to live content does not shift the page around.
 */

export function Line({ w = "100%", h = 12 }: { w?: string; h?: number }) {
  return <span className="skeleton block" style={{ width: w, height: h }} />;
}

export function PageHeaderSkeleton({ tags = false }: { tags?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 pb-5">
      <div className="w-full max-w-md space-y-2.5">
        <Line w="90px" h={11} />
        <Line w="240px" h={22} />
        <Line w="320px" h={12} />
        {tags && (
          <div className="flex gap-1.5 pt-0.5">
            <Line w="86px" h={18} />
            <Line w="64px" h={18} />
          </div>
        )}
      </div>
      <div className="flex shrink-0 gap-2">
        <Line w="72px" h={30} />
        <Line w="96px" h={30} />
      </div>
    </div>
  );
}

export function StatStripSkeleton() {
  return (
    <div className="card mb-4 grid grid-cols-2 divide-neutral-200 sm:grid-cols-4 sm:divide-x">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="space-y-2 px-4 py-3.5">
          <Line w="76px" h={10} />
          <Line w="52px" h={20} />
        </div>
      ))}
    </div>
  );
}

export function TableSkeleton({
  rows = 4,
  cols = 6,
  title = true,
}: {
  rows?: number;
  cols?: number;
  title?: boolean;
}) {
  return (
    <section className="card overflow-hidden">
      {title && (
        <div className="space-y-2 border-b border-neutral-200 bg-neutral-50/60 px-4 py-3">
          <Line w="180px" h={14} />
          <Line w="280px" h={11} />
        </div>
      )}
      <div className="px-4">
        <div className="flex gap-4 border-b border-neutral-200 py-2.5">
          {Array.from({ length: cols }).map((_, i) => (
            <div key={i} className="flex-1">
              <Line w="60%" h={10} />
            </div>
          ))}
        </div>
        {Array.from({ length: rows }).map((_, r) => (
          <div
            key={r}
            className="flex items-center gap-4 border-b border-neutral-100 py-3 last:border-0"
          >
            {Array.from({ length: cols }).map((_, c) => (
              <div key={c} className="flex-1">
                <Line w={c === 0 ? "85%" : c === cols - 1 ? "40%" : "65%"} h={12} />
              </div>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

export function ListCardSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <section className="card overflow-hidden">
      <div className="space-y-2 border-b border-neutral-200 px-4 py-2.5">
        <Line w="140px" h={13} />
        <Line w="220px" h={11} />
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 border-b border-neutral-100 px-4 py-3 last:border-0"
        >
          <span className="skeleton size-2 shrink-0 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Line w={`${55 + ((i * 13) % 30)}%`} h={13} />
            <Line w={`${35 + ((i * 17) % 25)}%`} h={11} />
          </div>
          <Line w="64px" h={11} />
        </div>
      ))}
    </section>
  );
}

export function FilterBarSkeleton() {
  return (
    <div className="card mb-3 flex flex-wrap items-center gap-2 px-3 py-2">
      <Line w="34%" h={28} />
      <Line w="112px" h={28} />
      <Line w="106px" h={28} />
      <Line w="120px" h={28} />
      <Line w="88px" h={28} />
      <span className="ml-auto">
        <Line w="94px" h={28} />
      </span>
    </div>
  );
}
