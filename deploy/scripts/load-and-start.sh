#!/usr/bin/env bash
# 在飞牛 NAS 上导入离线镜像并启动
set -euo pipefail
TAR="${1:-./bridge-assessment-5230.tar}"
if [ ! -f "$TAR" ]; then
  echo "未找到镜像文件：$TAR" >&2
  exit 1
fi
echo "==> 导入镜像"
docker load -i "$TAR"
echo "==> 启动服务"
docker compose up -d --no-build
echo "==> 状态"
docker compose ps
IP=$(hostname -I 2>/dev/null | awk '{print $1}')
echo "访问地址： http://${IP:-NAS_IP}:5230"
