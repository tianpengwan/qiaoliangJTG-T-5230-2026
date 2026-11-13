# 在有 Docker 的电脑上构建并导出离线镜像
# 用法：powershell -ExecutionPolicy Bypass -File .\deploy\scripts\build-and-save-image.ps1
param(
  [string]$Tag = "bridge-assessment:5230",
  [string]$OutDir = "",
  [string]$NpmRegistry = "https://registry.npmmirror.com"
)

$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
if (-not $OutDir) { $OutDir = Join-Path $root "deploy\offline" }
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

# 1. 准备基础镜像（本地已有则跳过；否则依次尝试国内镜像源）
docker image inspect node:24-bookworm-slim *> $null
if ($LASTEXITCODE -ne 0) {
  $mirrors = @("docker.m.daocloud.io", "docker.1ms.run", "docker.xuanyuan.me", "dockerproxy.net", "hub.rat.dev", "docker.1panel.live")
  $ok = $false
  foreach ($m in $mirrors) {
    Write-Host "==> 尝试镜像源 $m 拉取 node:24-bookworm-slim" -ForegroundColor Cyan
    docker pull "$m/library/node:24-bookworm-slim"
    if ($LASTEXITCODE -eq 0) {
      docker tag "$m/library/node:24-bookworm-slim" node:24-bookworm-slim
      if ($LASTEXITCODE -eq 0) { $ok = $true; break }
    }
  }
  if (-not $ok) { throw "基础镜像 node:24-bookworm-slim 拉取失败，请检查网络或指定可用镜像源" }
}

# 2. 构建应用镜像
Write-Host "==> 构建镜像 $Tag（npm 源：$NpmRegistry）" -ForegroundColor Cyan
docker build --build-arg NPM_REGISTRY=$NpmRegistry -t $Tag $root
if ($LASTEXITCODE -ne 0) { throw "docker build 失败" }

# 3. 导出镜像
$tar = Join-Path $OutDir "bridge-assessment-5230.tar"
Write-Host "==> 导出镜像到 $tar" -ForegroundColor Cyan
docker save -o $tar $Tag
if ($LASTEXITCODE -ne 0) { throw "docker save 失败" }

$size = [math]::Round((Get-Item $tar).Length / 1MB, 1)
Write-Host "完成：$tar（$size MB）" -ForegroundColor Green
Write-Host "把该 tar 与 docker-compose.yml 一起拷贝到飞牛 NAS，按教程导入即可。" -ForegroundColor Yellow
