# Watch-Dog

---

## Dev 啟動

\`\`\`bash
# 只啟動本地服務 (http://192.168.1.200:8789)
DEV_PORT=8789 ./dev-tunnel.sh

# 啟動 + ngrok tunnel
DEV_PORT=8789 ./dev-tunnel.sh ngrok

# 停止服務
./dev-tunnel.sh stop
\`\`\`

### 環境

| 項目 | 值 |
|------|-----|
| **Port** | 8789 |
| **Network URL** | http://192.168.1.200:8789 |

---

## 專案資訊

- **GitHub**: git@github.com:paipeter0801/watch-dog.git
