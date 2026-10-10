# 正式服入口

## 代码更新来源

`NeoPecos/Stronghold-Protocol` 的 `master` 是本部署的代码发布来源。原作者仓库仅作为人工对照的 `upstream` 保留；不设置定时抓取、自动合并或强制重置。需要引入上游改动时，先单独审查并测试，再合入本 fork。生产服务器不直接运行 `git pull upstream`。客户端的签名增量更新与上游 Git 同步是两套机制，不因此停用。

自 2026-10-09 起，`sp.bs.leio.fun` 在 JING 的 Nginx 直接回源 `127.0.0.1:3810`，与旧 `sp2.bs.leio.fun` 指向同一个 `/opt/sp2` 游戏进程。旧 leioserver `3800` 已停止；切换入口不重启游戏进程。

`sp2.bs.leio.fun` 暂不能删除：已发布的 Windows/Android 1.2.4 客户端从该域名读取**不跟随重定向**的签名更新清单，部分用户也将其保存为游戏地址。它只是兼容别名，不再有独立测试服。后续客户端更新迁移地址、验证老用户完成升级后，才能下线别名。

正式服 Nginx 配置见 `nginx/sp.bs.leio.fun.conf`。JING 的原配置保存在 `/etc/nginx/sites-available/sp.bs.leio.fun.pre-cutover-20261009`。回退时先恢复该文件，再执行 `nginx -t` 与平滑重载；但旧 leioserver `3800` 目前没有进程，回退前必须先恢复旧服务，否则正式域名会返回 502。

## 连接容量与静态资源（2026-10-11）

2026-10-10 22:10 的公网 Nginx 日志确认 `768 worker_connections are not enough`。公网 master 下实际有两个 worker；容器里的另两个 worker 属于其他实例，不能加到公网容量里。请求数、499 数量与房间里的 `humans` 席位数都不能直接当成在线玩家数或掉线数。

公网 `/etc/nginx/nginx.conf` 已设置 `worker_connections 16384`、`worker_rlimit_nofile 65535`，新 worker 的实际软/硬文件描述符上限均为 65535。容量计数包括客户端和上游连接，不是可承诺的玩家人数。

两个 HTTPS 站点都包含 `/etc/nginx/snippets/stronghold-static.conf`（源码见 `nginx/stronghold-static.conf`），缓存映射位于 `/etc/nginx/conf.d/stronghold-cache.conf`（源码见 `nginx/stronghold-cache.conf`）。脚本、模拟器 ES modules、素材和客户端下载由 Nginx 直接读文件，避免每个静态请求再创建到 Node 的连接。`/ws`、`/healthz`、账号/战绩、`/data.js`、内容包和媒体仍交给 Node；模拟器的 Node-only loader 与隐藏文件禁止直接访问。缓存与 Node 的规则保持一致：HTML 与普通代码重新验证，素材/字体/前端库缓存一天，带 `v=` 的非 HTML 文件使用 immutable。支持 ETag、Range 和文本压缩。

配置备份：`/root/migration-backups/sp-nginx-20261011/`。恢复备份的三个配置文件后执行 `nginx -t && systemctl reload nginx`。平滑重载无需重启游戏服务；旧 worker 可能因持有现有 WebSocket 而暂时保留，检查限额应观察新 worker。

## 正式服部署保护

正式服与兼容域名共用进程是有意设计；不要把旧客户端切到独立试验服。试验运行使用单独目录、端口和账号/战绩文件，例如仅本机可达的 3811，不能修改 `/opt/sp2` 或重启 `sp2.service`。

服务器上的 `/opt/sp2/ops/deploy-production.sh` 是正式部署入口：先运行 `sh /opt/sp2/ops/deploy-production.sh --check-only`；检查通过后传入已审查的代码归档以及可选素材归档。它检查归档、串行部署、备份，并在备份前和停止服务前各检查一次对局数。有对局时退出 20，保留服务和文件；健康状态无法确认也拒绝更新。不要绕过检查直接重启。两个检查之间仍可能有人开始新对局，因此正式更新应安排空闲窗口；这个保护不提供跨进程的原子排空。

账号与战绩保存在 `/var/lib/sp2`，部署不覆盖它们。更新失败会恢复旧代码；新增素材不删除，内容已改的素材需从发布前素材备份恢复。脚本只接受维护者生成的可信归档，不接受用户上传的任意归档。
