/** Re-mounts on every navigation, so page content eases in instead of popping (off for reduced motion). */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-enter">{children}</div>;
}
