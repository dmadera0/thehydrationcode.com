import rss from '@astrojs/rss';
import type { APIRoute } from 'astro';
import { SITE } from '@data/site';
import { getPublishedPosts } from '@lib/posts';

export const GET: APIRoute = async (context) => {
  const posts = await getPublishedPosts();

  return rss({
    title: SITE.name,
    description: SITE.description,
    site: context.site ?? SITE.url,
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.dek,
      pubDate: post.data.publishedAt,
      link: `/research/${post.id}`,
    })),
  });
};
