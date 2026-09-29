FROM node:20-alpine AS builder
WORKDIR /workspace
COPY package.json package-lock.json* ./
COPY tsconfig.base.json ./
COPY libs/observability ./libs/observability
COPY apps/events-service ./apps/events-service
RUN npm install --workspaces --include-workspace-root
RUN npm run build --workspace @tickets/observability
RUN npm run build --workspace @tickets/events-service

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /workspace ./
WORKDIR /app/apps/events-service
EXPOSE 5001
CMD ["npm", "start"]
