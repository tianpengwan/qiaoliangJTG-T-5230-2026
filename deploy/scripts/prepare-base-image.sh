#!/usr/bin/env bash
# 拉取并准备基础镜像 node:24-bookworm-slim（国内镜像源自动重试）
# 用法：
#   bash deploy/scripts/prepare-base-image.sh            # 只拉取并打上 node:24-bookworm-slim 标签
#   bash deploy/scripts/prepare-base-image.sh --save     # 同时导出 node-24-bookworm-slim.tar
#   MIRROR=docker.m.daocloud.io bash ...                 # 指定某个镜像源
set -uo pipefail

TARGET="node:24-bookworm-slim"
IMAGE="node:24-bookworm-slim"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
OUT="$ROOT/deploy/offline"
SAVE=""
[ "${1:-}" = "--save" ] && SAVE="1"

if docker image inspect "$TARGET" >/dev/null 2>&1; then
  echo "==> 本地已存在 $TARGET，无需拉取"
  docker image inspect "$TARGET" --format '    镜像ID: {{.Id}}  大小: {{.Size}}'
  exit 0
fi

if [ -n "${MIRROR:-}" ]; then
  MIRRORS=("$MIRROR")
else
  MIRRORS=(
    "docker.m.daocloud.io"
    "docker.1ms.run"
    "docker.xuanyuan.me"
    "dockerproxy.net"
    "hub.rat.dev"
    "docker.1panel.live"
    "docker.imgdb.de"
  )
fi

ok=""
for m in "${MIRRORS[@]}"; do
  echo "==> 尝试镜像源：$m"
  if docker pull "$m/library/node:24-bookworm-slim"; then
    docker tag "$m/library/node:24-bookworm-slim" "$TARGET"
    ok="$m"
    break
  fi
  echo "    × $m 不可用，换下一个"
done

if [ -z "$ok" ]; then
  echo
  echo "所有镜像源均失败。可尝试：" >&2
  echo "  1) 用 MIRROR=xxx 指定一个可用的镜像加速地址；" >&2
  echo "  2) 在电脑上构建并 docker save，把 tar 拷到 NAS 导入（见部署教程第二章）。" >&2
  exit 1
fi

echo "==> 已准备基础镜像：$TARGET（来自 $ok）"
docker image inspect "$TARGET" --format '    镜像ID: {{.Id}}  大小: {{.Size}}'

if [ -n "$SAVE" ]; then
  mkdir -p "$OUT"
  echo "==> 导出基础镜像到 $OUT/node-24-bookworm-slim.tar"
  docker save -o "$OUT/node-24-bookworm-slim.tar" "$TARGET"
  ls -lh "$OUT/node-24-bookworm-slim.tar"
fi
