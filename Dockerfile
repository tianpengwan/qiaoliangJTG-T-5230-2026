# 公路桥梁技术状况评定系统（JTG/T 5230—2026）
# Node 24 内置 node:sqlite，无需原生编译，镜像体积小
FROM node:24-bookworm-slim

# npm 源：NAS 直连 registry.npmjs.org 较慢时可用国内源
# 构建时覆盖：docker build --build-arg NPM_REGISTRY=https://registry.npmmirror.com
ARG NPM_REGISTRY=https://registry.npmmirror.com

ENV NODE_ENV=production \
    PORT=3000 \
    TZ=Asia/Shanghai

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --registry=${NPM_REGISTRY} --no-audit --no-fund && npm cache clean --force

COPY server.js db.js assess5230.js templates5230.js std5230_data.js vision.js export5230.js ./
COPY public ./public

RUN mkdir -p data uploads exports

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
