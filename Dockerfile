FROM node:22-alpine AS base
WORKDIR /app

# Copiar package.json y .npmrc
COPY package*.json .npmrc ./

# Limpiar cache y establecer registry
RUN npm cache clean --force
RUN npm set registry https://registry.npmjs.org/

# Install dependencies con flags optimizados
RUN npm install --legacy-peer-deps

# Copiar el resto del codigo
COPY . .

# Build args para variables de entorno necesarias en build time
ARG PUBLIC_SUPABASE_URL
ARG PUBLIC_SUPABASE_ANON_KEY

# Build la app
RUN npm run build

# --- Etapa de produccion ---
FROM node:22-alpine AS runtime
WORKDIR /app

# Copiar solo lo necesario para produccion
COPY --from=base /app/dist ./dist
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/package.json ./

# Exponer puertos
EXPOSE 4321

# Variables de entorno para el runtime
ENV HOST=0.0.0.0
ENV PORT=4321
ENV NODE_ENV=production

# Start con manejo de senales
STOPSIGNAL SIGTERM
CMD ["node", "--no-warnings=ExperimentalWarning", "dist/server/entry.mjs"]
