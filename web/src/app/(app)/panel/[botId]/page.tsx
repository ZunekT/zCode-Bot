import { notFound, redirect } from 'next/navigation';

export default async function Old({ params }: { params: Promise<{ botId: string }> }) {
  const { botId } = await params;
  if (!/^\d+$/.test(botId)) notFound();
  redirect(`/panel/boty/${botId}`);
}
