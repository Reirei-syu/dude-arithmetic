# dude-arithmetic

自动生成算术题的纯本地网页工具。

支持自定义：
- A 的位数
- 运算符号
- C 的位数
- 答案上限 D
- 打印预览时的列数和字体大小

项目当前不依赖任何外部 API，也不需要配置环境变量。

## 本地运行

```bash
npm install
npm run dev
```

默认地址：

```text
http://127.0.0.1:3000/dude-arithmetic/
```

## 常用命令

```bash
npm run lint
npm run build
npm run clean
```

## 部署

推送到 `main` 后，GitHub Actions 会自动构建并部署到 GitHub Pages。

## 集中管理与 Cloudflare

源码位于 `D:\coding\domain\tools\dude-arithmetic`，保留独立 Git 仓库。根目录执行 `node build.mjs` 将工具构建到 `dist/dude-arithmetic/`，在 `https://taxcalculatetools.com/dude-arithmetic/` 使用；页面统一导航页玻璃风格并提供返回导航入口。

页面包含 `noindex, nofollow` 元标签，Cloudflare 站点通配响应头同样禁止收录；无需登录，保持网址直接访问。生成计算仍在浏览器本地进行，原有打印排版逻辑保持不变。
