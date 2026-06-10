# Smile Support API

Docker 后端统计服务，默认监听 `8001`。

## 部署

```bash
cd support-api
docker compose up -d --build
```

## 接口

```text
GET  /api/support/stats
POST /api/support/applause
POST /api/support/money
GET  /health
```

统计数据保存在 `support-api/data/support-stats.json`。

同一个 IP 每天对同一种支持只统计一次：

- `POST /api/support/applause` 每 IP 每天只增加一次捧人场数
- `POST /api/support/money` 每 IP 每天只增加一次捧钱场数

注意：GitHub Pages 是 HTTPS，直接请求 `http://43.136.181.211:8001` 可能被浏览器拦截。长期建议给 API 配域名和 HTTPS。
