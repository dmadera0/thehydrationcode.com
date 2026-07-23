import type { APIRoute, GetStaticPaths } from 'astro';
import sharp from 'sharp';
import { getCollection } from 'astro:content';
import { buildOgSvg } from '@lib/og-image';
import { SITE } from '@data/site';

export const getStaticPaths: GetStaticPaths = async () => {
  const posts = await getCollection('posts');
  return posts.map((post) => ({
    params: { slug: post.id },
    props: { title: post.data.title },
  }));
};

export const GET: APIRoute = async ({ props }) => {
  const { title } = props as { title: string };
  const svg = buildOgSvg(title, SITE.name);
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  return new Response(new Uint8Array(png), {
    headers: { 'Content-Type': 'image/png' },
  });
};
