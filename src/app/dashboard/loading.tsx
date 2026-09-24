export default function DashboardLoading() {
  return (
    <div className="container-page py-12" aria-busy="true" aria-label="Loading dashboard">
      <div className="skeleton h-12 w-80" />
      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((i) => <div key={i} className="skeleton h-28" />)}
      </div>
      <div className="mt-10 grid gap-8 lg:grid-cols-2">
        <div className="skeleton h-64" />
        <div className="skeleton h-64" />
      </div>
    </div>
  );
}
