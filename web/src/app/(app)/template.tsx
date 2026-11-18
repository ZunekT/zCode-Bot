/** Każde przejście między stronami panelu – krótkie, płynne wejście treści (CSS). */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-in">{children}</div>;
}
