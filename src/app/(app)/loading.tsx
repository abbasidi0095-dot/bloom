export default function AppLoading() {
  return (
    <div className="space-y-4">
      <div className="skeleton h-8 w-40" />
      <div className="skeleton h-4 w-64" />
      <div className="skeleton h-64 w-full rounded-[26px]" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[0, 1, 2, 3].map((item) => (
          <div key={item} className="skeleton h-28 rounded-[22px]" />
        ))}
      </div>
    </div>
  );
}
