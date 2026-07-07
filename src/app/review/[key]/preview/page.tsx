import { store } from "@/lib/store";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function PreviewPage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const { key } = await params;
  const preview = store.getPreview(key);

  if (!preview?.html) {
    notFound();
  }

  return (
    <html>
      <body
        style={{ margin: 0, padding: 0 }}
        dangerouslySetInnerHTML={{ __html: preview!.html }}
      />
    </html>
  );
}
