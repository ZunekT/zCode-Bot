import { notFound, redirect } from 'next/navigation';

/** Stary adres /panel/:bot/:serwer → /panel/boty/:bot/:serwer. */
export default async function Old({ params }: { params: Promise<{ botId: string; guildId: string }> }) {
  const { botId, guildId } = await params;
  if (!/^\d+$/.test(botId) || !/^\d+$/.test(guildId)) notFound();
  redirect(`/panel/boty/${botId}/${guildId}`);
}
