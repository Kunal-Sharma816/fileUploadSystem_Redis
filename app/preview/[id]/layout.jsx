// app/preview/[id]/layout.jsx

export default function PreviewLayout({ children }) {
  return (
    <div className="max-w-6xl mx-auto p-6">
      {children}
    </div>
  );
}
