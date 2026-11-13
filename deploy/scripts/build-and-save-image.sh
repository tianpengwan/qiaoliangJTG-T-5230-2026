#!/usr/bin/env bash
# 在有 Docker 的电脑/NAS 上构建并导出离线镜像
# 基础镜像拉不到时（国内网络常见），会先通过多个镜像源自动重试
set -euo pipefail
TAG="${1:-bridge-assessment:5230}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
OUT="$ROOT/deploy/offline"
mkdir -p "$OUT"

# 1. 准备基础镜像 node:24-bookworm-slim（本地已有则跳过）
if ! docker image inspect node:24-bookworm-slim >/dev/null 2>&1; then
  echo "==> 本地没有 node:24-bookworm-slim，尝试从国内镜像源拉取"
  bash "$ROOT/deploy/scripts/prepare-base-image.sh"
fi

# 2. 构建应用镜像（使用本地基础镜像，不再访问 Docker Hub）
echo "==> 构建镜像 $TAG"
docker build \
  --build-arg NPM_REGISTRY="${NPM_REGISTRY:-https://registry.npmmirror.com}" \
  -t "$TAG" "$ROOT"

# 3. 导出镜像（含基础镜像层，NAS 导入后无需再拉取任何镜像）
echo "==> 导出镜像到 $OUT/bridge-assessment-5230.tar"
docker save -o "$OUT/bridge-assessment-5230.tar" "$TAG"
ls -lh "$OUT/bridge-assessment-5230.tar"
echo "完成。把 tar 与 docker-compose.yml 拷贝到飞牛 NAS 导入。"
