# 正式服入口

## 代码更新来源

`NeoPecos/Stronghold-Protocol` 的 `master` 是本部署的代码发布来源。原作者仓库仅作为人工对照的 `upstream` 保留；不设置定时抓取、自动合并或强制重置。需要引入上游改动时，先单独审查并测试，再合入本 fork。生产服务器不直接运行 `git pull upstream`。客户端的签名增量更新与上游 Git 同步是两套机制，不因此停用。

自 2026-10-09 起，`sp.bs.leio.fun` 在 JING 的 Nginx 直接回源 `127.0.0.1:3810`，与旧 `sp2.bs.leio.fun` 指向同一个 `/opt/sp2` 游戏进程。旧 leioserver `3800` 已停止；切换入口不重启游戏进程。

`sp2.bs.leio.fun` 暂不能删除：已发布的 Windows/Android 1.2.4 客户端从该域名读取**不跟随重定向**的签名更新清单，部分用户也将其保存为游戏地址。它只是兼容别名，不再有独立测试服。后续客户端更新迁移地址、验证老用户完成升级后，才能下线别名。

正式服 Nginx 配置见 `nginx/sp.bs.leio.fun.conf`。JING 的原配置保存在 `/etc/nginx/sites-available/sp.bs.leio.fun.pre-cutover-20261009`。回退时先恢复该文件，再执行 `nginx -t` 与平滑重载；但旧 leioserver `3800` 目前没有进程，回退前必须先恢复旧服务，否则正式域名会返回 502。
