// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import react from '@astrojs/react';
import node from '@astrojs/node';

// https://astro.build/config
export default defineConfig({
	site: process.env.SITE_URL || 'http://localhost:4321',
	output: 'server',
	adapter: node({
		mode: 'standalone',
	}),
	integrations: [react()],
	image: {
		service: {
			entrypoint: 'astro/assets/services/sharp'
		}
	},
	favicon: '/favicon.ico',
	server: {
		host: '0.0.0.0',
		port: parseInt(process.env.PORT || '4321'),
	},
	vite: {
		plugins: [tailwindcss()],
		ssr: {
			external: ['@supabase/supabase-js'],
		},
	},
});
