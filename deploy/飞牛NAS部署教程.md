# 飞牛 NAS（fnOS）Docker 部署详细教程

> 系统：公路桥梁技术状况评定系统（JTG/T 5230—2026）
> 本项目已内置登录鉴权：**打开网页、使用手机 APP 都必须先输入账号密码**。
> 账号密码由部署者在 `.env` 中设置，不写死在代码里。

## 速查表

| 项目 | 值 |
|---|---|
| 镜像名 | `bridge-assessment:5230` |
| 容器名 | `bridge-assessment` |
| 容器内端口 | `3000` |
| 默认对外端口 | `5230`（可用 `.env` 的 `APP_PORT` 改） |
| 默认账号 | `admin` |
| 默认密码 | `qiaoliang@2026`（**部署后请立即修改**） |
| 数据目录 | `data/`（数据库）、`uploads/`（照片）、`exports/`（报告） |
| 建议部署目录 | `/vol1/1000/docker/bridge-assessment` |
| 访问地址 | `http://飞牛IP:5230` |

---

## 一、部署前准备

### 1.1 飞牛 NAS 侧

1. 应用中心安装并打开 **Docker**（首次打开会自动创建 Docker 运行环境）。
2. 确认 NAS 的局域网 IP，建议在路由器里做 **DHCP 固定**，避免重启后 IP 变化导致手机 APP 连不上。
   - 例：`192.168.1.100`
3. 打开 **SSH**（设置 → 系统设置 → 终端与 SSH，或“终端”应用），用于执行 `docker load` 等命令。
   不想用 SSH 也可以全程用图形界面，见第四章。

### 1.2 目录规划

在飞牛“文件管理”里创建目录（或 SSH 执行 `mkdir -p`）：

```
/vol1/1000/docker/bridge-assessment
├── docker-compose.yml      # 编排文件
├── .env                    # 账号密码与端口（必须自己创建）
├── data/                   # SQLite 数据库，务必持久化
├── uploads/                # 现场照片
└── exports/                # 导出的 Excel / Word 报告
```

> `/vol1` 是飞牛“存储空间 1”的默认挂载点，实际以你的存储空间为准（如 `/vol2`）。

### 1.3 电脑侧（仅离线镜像方式需要）

一台能装 **Docker Desktop** 的电脑（Windows/macOS/Linux 均可），用于构建并导出镜像 tar。

---

## 二、方式一：离线镜像部署（推荐，NAS 全程不需要外网）

这是“把需要的镜像下载到本地”的做法：在电脑上把镜像构建好并导出成 tar，NAS 只需导入 tar，不拉取任何镜像。

### 第 1 步：在电脑上构建并导出镜像

把整个项目文件夹拷贝到电脑，在**项目根目录**执行。

**Windows PowerShell：**

```powershell
powershell -ExecutionPolicy Bypass -File .\deploy\scripts\build-and-save-image.ps1
```

**Linux / macOS：**

```bash
bash deploy/scripts/build-and-save-image.sh
```

脚本内部等价于：

```bash
# 1) 基础镜像：本地没有时会自动从国内镜像源拉取并打标签
bash deploy/scripts/prepare-base-image.sh
# 2) 构建应用镜像（默认使用 npmmirror 作为 npm 源）
docker build --build-arg NPM_REGISTRY=https://registry.npmmirror.com -t bridge-assessment:5230 .
# 3) 导出
docker save -o deploy/offline/bridge-assessment-5230.tar bridge-assessment:5230
```

单独把基础镜像下载到本地（不构建应用）：

```bash
bash deploy/scripts/prepare-base-image.sh --save
# 产物：deploy/offline/node-24-bookworm-slim.tar
```

产物：`deploy/offline/bridge-assessment-5230.tar`（约 200 MB，已包含 Node 运行时与全部依赖）。

确认镜像存在：

```bash
docker images | grep bridge-assessment
```

> 没有装 Docker 的电脑无法生成 tar，请改用第三章“在线构建”。

### 第 2 步：上传文件到飞牛

把下面 3 个文件上传到 `/vol1/1000/docker/bridge-assessment/`：

| 文件 | 来源 |
|---|---|
| `bridge-assessment-5230.tar` | 第 1 步生成 |
| `docker-compose.yml` | 项目根目录 |
| `.env` | 由项目根目录的 `.env.example` 复制并修改 |

上传方式任选：

- 飞牛“文件管理”直接拖拽上传；
- Windows 资源管理器访问 NAS 的 SMB 共享；
- SSH + scp：

```bash
scp deploy/offline/bridge-assessment-5230.tar root@192.168.1.100:/vol1/1000/docker/bridge-assessment/
scp docker-compose.yml root@192.168.1.100:/vol1/1000/docker/bridge-assessment/
```

### 第 3 步：创建并修改 `.env`（设置账号密码）

在 NAS 的部署目录里新建 `.env`（可从 `.env.example` 复制），**至少修改密码**：

```ini
# 对外访问端口
APP_PORT=5230

# 登录账号密码（打开系统/APP 必须输入）
AUTH_USER=admin
AUTH_PASS=改成你自己的强密码
AUTH_TTL_HOURS=720
AUTH_SECRET=8f3c9a2e7b1d4056a9c8e2f7b3d6041c

# AI 图片识别（可选，默认关闭）
VISION_PROVIDER=disabled
VISION_API_KEY=
```

说明：

- `AUTH_PASS`：登录密码，建议 10 位以上，含大小写字母、数字和符号；
- `AUTH_SECRET`：登录令牌签名密钥，建议填一段随机字符串。更换它会让所有已登录设备立即掉线；
- `AUTH_TTL_HOURS`：登录有效期，默认 720 小时（30 天），过期需重新登录；
- 修改 `.env` 后执行 `docker compose up -d` 生效，不需要重建镜像。

> 注意：`.env` 里不要出现空格和引号；如果密码含 `$`，在 Compose 里可能被当作变量，建议避免或改写成 `$$`。

### 第 4 步：导入镜像并启动

SSH 登录飞牛：

```bash
cd /vol1/1000/docker/bridge-assessment

# 导入镜像（只需一次，升级时重新导入）
docker load -i bridge-assessment-5230.tar

# 启动（--no-build 表示不重新构建，直接用导入的镜像）
docker compose up -d --no-build

# 查看状态
docker compose ps
```

正常情况下会看到：

```
NAME                IMAGE                     STATUS
bridge-assessment   bridge-assessment:5230    Up (healthy)
```

首次启动后 `start_period` 约 15 秒，健康检查才会变为 `healthy`。

查看日志（含登录账号提示）：

```bash
docker compose logs -f --tail=100
```

若日志出现“正在使用默认密码”的警告，说明 `.env` 未生效，请检查文件名是否为 `.env`、是否与 `docker-compose.yml` 同目录。

### 第 5 步：验证

1. 浏览器打开 `http://192.168.1.100:5230`；
2. 应看到登录页（服务地址、账号、密码）；
3. 输入 `.env` 中的账号密码 → 进入系统；
4. 新建一座桥，能正常保存即部署完成。

命令行自检：

```bash
curl http://127.0.0.1:5230/api/health
# {"ok":true,"standard":"JTG/T 5230—2026"}
```

---

## 三、方式二：在飞牛上在线构建

适用于：NAS 能访问 Docker Hub 与 npm，且不想在电脑上装 Docker。

1. 上传**整个项目源码**到 `/vol1/1000/docker/bridge-assessment/`。
   必须包含：`Dockerfile`、`package.json`、`package-lock.json`、`server.js`、`db.js`、`assess5230.js`、`templates5230.js`、`std5230_data.js`、`vision.js`、`export5230.js`、`public/`。
2. 同第二章第 3 步创建 `.env`。
3. 执行：

```bash
cd /vol1/1000/docker/bridge-assessment
docker compose up -d --build
```

首次构建会拉取 `node:24-bookworm-slim` 并安装 npm 依赖，耗时取决于 NAS 网络。

### 3.1 基础镜像拉取失败（401 Unauthorized）

飞牛自带的镜像加速地址 `docker.fnnas.com` 有时会返回：

```
ERROR: failed to resolve source metadata for docker.io/library/node:24-bookworm-slim:
unexpected status from HEAD request to https://docker.fnnas.com/v2/library/node/manifests/...
401 Unauthorized
```

这是加速器本身不可用，不是项目问题。用下面的方式手动下载基础镜像（**指定镜像源主机时不会走飞牛加速器**）：

```bash
cd /vol1/1000/docker/qiaoliang-master
bash deploy/scripts/prepare-base-image.sh
```

脚本会依次尝试 `docker.m.daocloud.io`、`docker.1ms.run`、`docker.xuanyuan.me`、`dockerproxy.net`、`hub.rat.dev`、`docker.1panel.live`、`docker.imgdb.de`，
成功后自动打上 `node:24-bookworm-slim` 标签。

也可以自己指定一个可用的源：

```bash
MIRROR=docker.m.daocloud.io bash deploy/scripts/prepare-base-image.sh
```

或手动执行：

```bash
docker pull docker.m.daocloud.io/library/node:24-bookworm-slim
docker tag docker.m.daocloud.io/library/node:24-bookworm-slim node:24-bookworm-slim
```

基础镜像就绪后重新构建，此时不会再访问 Docker Hub：

```bash
docker compose up -d --build
```

> 若所有镜像源都不通，请改用第二章：在能联网的电脑上构建并 `docker save`，把 tar 拷到 NAS 导入。

### 3.2 npm 依赖下载慢或失败

Dockerfile 默认使用 `registry.npmmirror.com`，可手动指定：

```bash
docker build --build-arg NPM_REGISTRY=https://registry.npmmirror.com -t bridge-assessment:5230 .
```

---

## 四、方式三：飞牛 Docker 图形界面（不敲命令）

### 4.1 导入镜像

飞牛桌面 → **Docker** → **镜像** → **导入镜像** → 选择 `bridge-assessment-5230.tar` → 确定。
导入完成后镜像列表中会出现 `bridge-assessment:5230`。

### 4.2 用 Compose 创建项目

1. Docker → **Compose** → **新建项目**；
2. 项目名称：`bridge-assessment`；
3. 路径：`/vol1/1000/docker/bridge-assessment`；
4. 把项目根目录 `docker-compose.yml` 的内容粘贴进去；
5. **删除 `build: .` 这一行**（使用已导入的镜像）；
6. 在“环境变量”处填写（或直接依赖同目录 `.env`）：
   - `AUTH_USER=admin`
   - `AUTH_PASS=你的密码`
   - `APP_PORT=5230`
7. 启动项目，在“容器”页面确认 `bridge-assessment` 为运行中。

### 4.3 或者：直接新建容器

不想用 Compose 时，用“新建容器”逐项填写：

| 配置项 | 值 |
|---|---|
| 镜像 | `bridge-assessment:5230` |
| 容器名称 | `bridge-assessment` |
| 端口映射 | 本地 `5230` → 容器 `3000` |
| 存储映射 1 | `/vol1/1000/docker/bridge-assessment/data` → `/app/data` |
| 存储映射 2 | `/vol1/1000/docker/bridge-assessment/uploads` → `/app/uploads` |
| 存储映射 3 | `/vol1/1000/docker/bridge-assessment/exports` → `/app/exports` |
| 环境变量 | `AUTH_USER=admin`、`AUTH_PASS=你的密码` |
| 重启策略 | 除非手动停止 |

保存并启动即可。

---

## 五、账号密码说明（网页与 APP 共用）

### 5.1 登录机制

- 打开网页、PWA、手机 APP 都先进入登录页；
- 登录成功后服务器返回一个签名令牌，保存在设备本地，默认 30 天有效；
- 所有业务接口都校验令牌，未登录直接访问接口会返回 401，前端会自动回到登录页；
- 同一 IP 连续输错 8 次密码会锁定 5 分钟，防止暴力猜测。

### 5.2 修改密码

```bash
cd /vol1/1000/docker/bridge-assessment
vi .env          # 修改 AUTH_PASS
docker compose up -d
```

修改后所有旧令牌立即失效，各设备需要重新登录。

### 5.3 忘记密码

同样改 `.env` 里的 `AUTH_PASS` 并重启容器即可，无需进入数据库。

### 5.4 当前为单账号

系统按“一个检测单位一个账号”设计，所有手机共用同一套账号密码。
如需多人多账号，可在后续版本扩展用户表，或部署多套实例分给不同项目组。

### 5.5 安全建议

- **不要把 5230 端口直接映射到公网**；需要远程访问时，用飞牛自带的反向代理 + HTTPS + 强密码；
- 首次部署后务必修改默认密码；
- 定期备份 `data/`，并在更换人员后修改密码。

---

## 六、手机 APP 安装与登录

1. 把 `deploy/apk/桥梁评定.apk` 传到手机（微信/QQ/数据线/局域网共享均可）。
2. 点击安装；若提示“禁止安装未知来源应用”，在弹窗中允许该来源。
   - 包名 `com.qiaoliang.jtg5230`，支持 Android 7.0 及以上。
3. 打开 APP，填写：
   - 服务地址：`http://192.168.1.100:5230`（必须带 `http://`，结尾不要加 `/`）
   - 账号 / 密码：与网页登录相同
4. 登录后即可录入、评定、查看结果、导出报告。
5. 换服务器或退出账号：右上角 **服务器设置** → 修改地址或点 **退出登录**。

> 手机需与 NAS 在同一局域网；在外网使用请先配置 VPN 或内网穿透，并把 APP 地址改成对应域名。

---

## 七、数据备份与恢复

备份（数据库 + 照片）：

```bash
cd /vol1/1000/docker/bridge-assessment
tar czf bridge-backup-$(date +%F).tar.gz data uploads
```

恢复：停止容器 → 解压覆盖 → 启动容器：

```bash
docker compose down
tar xzf bridge-backup-2026-11-13.tar.gz
docker compose up -d
```

建议在飞牛“备份”应用中对 `data`、`uploads` 目录设置定时备份。

---

## 八、升级

1. 在电脑上重新构建并导出镜像 tar（或重新上传源码在线构建）；
2. 上传到 NAS 后执行：

```bash
cd /vol1/1000/docker/bridge-assessment
docker load -i bridge-assessment-5230.tar
docker compose up -d --no-build
```

数据库建表使用 `CREATE TABLE IF NOT EXISTS`，正常升级不会清空数据；重大升级前仍建议按第七章备份。

---

## 九、常见问题

**1. 页面打不开 / 连接被拒绝**

```bash
docker compose ps                 # 看是否 running
docker compose logs --tail=100    # 看启动日志
netstat -tlnp | grep 5230         # 看端口是否被占用
```

检查飞牛防火墙是否放行端口；被占用时改 `.env` 的 `APP_PORT` 后 `docker compose up -d`。

**2. 一直停在登录页 / 提示账号密码错误**

- 确认 `.env` 与 `docker-compose.yml` 在同一目录，文件名就是 `.env`；
- 确认修改后执行过 `docker compose up -d`；
- 用 `docker compose config` 检查变量是否被正确替换；
- 连续输错 8 次会被锁定 5 分钟，等待后重试。

**3. 登录后又跳回登录页**

- 服务器重启且更换了 `AUTH_SECRET` / 密码，旧令牌失效，重新登录即可；
- 系统时间偏差过大会导致令牌校验失败，检查 NAS 时间同步。

**4. 手机 APP 提示无法连接**

- 地址必须是 `http://IP:端口`，不要以 `/` 结尾；
- 先用手机浏览器打开同一地址确认能访问；
- 确认手机与 NAS 同一网段（不是访客 WiFi）。

**5. 上传照片失败 / 数据库只读**

```bash
chmod -R 777 data uploads exports   # 局域网内部使用可这样放开
```

或在飞牛文件管理里给对应目录设置读写权限。

**6. 容器显示 unhealthy**

健康检查访问 `/api/health`。若日志显示端口占用或数据库无法打开，按第 1、5 条处理；`start_period` 内显示 starting 属正常。

**7. 导出的 Excel/Word 打不开**

数据不完整时（页面有红色提示）不允许导出正式报告，补全评定记录后再导出。

**8. 想换端口**

```ini
APP_PORT=8080
```

```bash
docker compose up -d
```

**9. 构建时报 401 Unauthorized（docker.fnnas.com）**

飞牛自带的镜像加速器不可用，手动准备基础镜像后再构建：

```bash
bash deploy/scripts/prepare-base-image.sh
docker compose up -d --build
```

详见 3.1 节。

---

## 十、目录与文件对照

| 路径 | 作用 | 是否必须持久化 |
|---|---|---|
| `/app/data` | SQLite 数据库 `bridge5230.db` | 必须 |
| `/app/uploads` | 缺损照片 | 必须 |
| `/app/exports` | 导出的报告文件 | 建议 |
| `.env` | 账号密码、端口、AI 配置 | 必须自行保存 |
| `docker-compose.yml` | 容器编排 | 建议保留 |

部署完成后，把 `.env` 和 `docker-compose.yml` 单独备份一份，重装 NAS 时可快速恢复。
