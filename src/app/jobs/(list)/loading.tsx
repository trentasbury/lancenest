export default function JobsLoading() {
  return (
    <div className="container-page py-12" aria-busy="true" aria-label="Loading jobs">
      <div className="skeleton h-10 w-72" />
      <div className="mt-10 grid gap-8 lg:grid-cols-[260px_1fr]">
        <div className="skeleton h-72" />
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="card flex gap-4 p-6">
              <div className="skeleton h-11 w-11" />
              <div className="flex-1 space-y-3">
                <div className="skeleton h-5 w-2/3" />
                <div className="skeleton h-4 w-1/3" />
                <div className="skeleton h-6 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
