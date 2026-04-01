# 最新上下文快照

## 当前阶段

- Execution

## 当前任务

- 恢复并收敛 GitHub 自动化部署配置

## 剩余任务

- 无

## 关键决策

- 不恢复历史中的多条工作流
- 仅保留 `.github/workflows/deploy.yml`
- 使用 `gh-pages` 分支发布而不是切换到 Pages Artifact 模式

## 当前问题

- 当前自动部署链路已恢复
- 后续只需保持唯一的 `deploy.yml`，不要重新引入重复 Pages 工作流

## 下一步计划

- 继续功能开发时直接在 `main` 提交，GitHub Actions 会自动构建并发布到 `gh-pages`
