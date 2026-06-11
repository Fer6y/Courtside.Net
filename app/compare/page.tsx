import { redirect } from "next/navigation";

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<{ p1?: string; p2?: string }>;
}) {
  const { p1, p2 } = await searchParams;

  // Redirect old /compare?p1=X&p2=Y links to the new H2H page
  if (p1 && p2) redirect(`/h2h/${p1}/${p2}`);
  if (p1) redirect(`/h2h/${p1}`);
  redirect("/players");
}
