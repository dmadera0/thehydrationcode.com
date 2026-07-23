import type { APIRoute, GetStaticPaths } from 'astro';
import sharp from 'sharp';
import { getCollection } from 'astro:content';
import { buildOgSvg } from '@lib/og-image';

export const getStaticPaths: GetStaticPaths = async () => {
  const bottles = await getCollection('bottles');
  return bottles.map((bottle) => ({
    params: { slug: bottle.id },
    props: { title: bottle.data.name, brand: bottle.data.brand },
  }));
};

export const GET: APIRoute = async ({ props }) => {
  const { title, brand } = props as { title: string; brand: string };
  const svg = buildOgSvg(title, brand);
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  return new Response(new Uint8Array(png), {
    headers: { 'Content-Type': 'image/png' },
  });
};
