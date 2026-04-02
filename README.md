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
