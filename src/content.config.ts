import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const daily = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/daily' }),
  schema: z.object({
    title: z.string(),
    date: z.string(),
    description: z.string().optional(),
    published: z.string().optional(),
  }),
});

const weekly = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/weekly' }),
  schema: z.object({
    title: z.string(),
    date: z.string(),
    description: z.string().optional(),
  }),
});

const items = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/items' }),
  schema: z.object({
    title: z.string(),
    date: z.string(),
    description: z.string().optional(),
    source: z.string().optional(),
    url: z.string(),
    score: z.coerce.number().optional(),
  }),
});

export const collections = { daily, weekly, items };
