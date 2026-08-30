# 浦东地图

一个可以自己维护地点和备注，并在手机、电脑上查看公交/骑行/驾车路线的高德地图网页。

## 文件说明

- `index.html`：公开地图页，给别人看的
- `admin.html`：管理页，你自己添加、修改地点和备注
- `js/config.js`：配置高德 Key、管理密码、云端信息
- `supabase-setup.sql`：云端数据库初始化脚本

## 日常使用

1. 打开 `index.html` 查看地图。
2. 打开 `admin.html`，输入管理密码进入。
3. 新增地点：填名称、地址后点“定位”，或点“在地图上点选”。
4. 点“保存地点”，地图页就能看到。
5. 支持“批量添加”，每行一个：`名称,地址,备注`。
6. 经常点“导出备份”，把数据保存成文件，防止丢失。

## 首次发布到 GitHub

1. 登录 GitHub，新建一个仓库，名字随便填（比如 `pudong-map`），选择公开（Public），不要勾选初始化文件。
2. 在仓库页面点“Add file” → “Upload files”，把本项目里的文件全部拖进去（`index.html`、`admin.html`、`css`、`js`、`supabase-setup.sql`、`README.md` 等）。
3. 提交后，进仓库 “Settings” → “Pages” → “Source” 选 “Deploy from a branch”，分支选 `main`，目录选 `/ (root)`，点保存。
4. 等一两分钟，你的网址就是 `https://aliciawu226.github.io/pudong-map/`。

发布后还要回高德控制台，在 Key 的“白名单”里加上你的网址域名，例如：

```
aliciawu226.github.io
```

## 开启云端保存（可选）

本机版数据保存在当前浏览器里。想要换手机、换电脑都能看到，需要接 Supabase：

1. 注册 `supabase.com`，创建一个免费项目。
2. 项目创建后，打开 “SQL Editor”，把 `supabase-setup.sql` 的内容全部粘贴进去运行。
3. 打开 “Authentication” → “Users”，点 “Add user”，添加一个管理员账号（邮箱用 `aliciawu226@gmail.com`，密码自己设一个）。
4. 打开 “Project Settings” → “API”，复制 “Project URL” 和 “anon / public” key。
5. 把这两个值填到 `js/config.js` 的 `supabase` 里，重新上传到 GitHub。
6. 之后管理页登录用的就是 Supabase 管理员账号的密码。

注意：如果更新了 `supabase-setup.sql`（比如新增图片功能），需要回 Supabase 的
“SQL Editor” 把整个文件内容重新运行一次，旧的语句会安全跳过，不会影响已有数据。

## 地点图片

管理页里每个地点可以上传多张图片。图片会自动压缩后存到 Supabase 的免费图床里，
在地图弹窗里以缩略图显示，点击可以打开原图。图片上传需要先配置好 Supabase。

## 注意事项

- 管理密码默认是 `pudong2026`，以指纹形式保存在 `js/config.js` 里；想换密码告诉助手重新生成即可。
- 公开地图页能看到所有地点和备注，网址请只发给信任的人。
