FROM node:20-alpine

WORKDIR /app

# copy package files first for better layer caching
COPY package.json pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/package.json
COPY apps/backend/package.json ./apps/backend/package.json

# install pnpm then dependencies
RUN npm install -g pnpm && pnpm install --frozen-lockfile

# copy full source
COPY packages/shared ./packages/shared
COPY apps/backend ./apps/backend

# build
RUN pnpm --filter @murmur/backend build

WORKDIR /app/apps/backend

EXPOSE 3001

CMD ["node", "dist/index.js"]