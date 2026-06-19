import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro:content';

const projects = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/projects' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    image: z.string().optional(),
    github: z.string().optional(),
    demo: z.string().optional(),
    tags: z.array(z.string()).optional(),
  }),
});

export const collections = { projects };
