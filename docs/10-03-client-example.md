# Watch-Dog 客戶端整合指南

## 服務地址

**Watch-Dog Sentinel URL:** `https://watch-dog.paipeter-gui.workers.dev/`

---

## 概述

本指南提供 Python、Node.js/TypeScript 和 Bash 的客戶端範例，讓你的服務快速整合 Watch-Dog 監控。

### 兩種監控模式

1. **Heartbeat（定期心跳）** - 定期報告服務健康狀態
2. **Event（事件觸發）** - 只在發生錯誤時通知

---

## 🟢 Python Client

適用於 Django、FastAPI、Flask、排程腳本等。

### 客戶端實作

```python
# utils/watchdog.py
import requests
import logging
import threading

logger = logging.getLogger(__name__)

class WatchDogClient:
    def __init__(self, token: str, project_id: str):
        self.base_url = "https://watch-dog.paipeter-gui.workers.dev"
        self.headers = {"Authorization": f"Bearer {token}"}
        self.project_id = project_id

    def register_checks(self, checks: list):
        """註冊檢查規則（服務啟動時調用）"""
        payload = {"checks": checks}
        try:
            threading.Thread(target=self._do_register, args=(payload,)).start()
        except Exception as e:
            logger.error(f"[WatchDog] Register Failed: {e}")

    def _do_register(self, payload):
        try:
            requests.put(f"{self.base_url}/api/config", json=payload, headers=self.headers, timeout=10)
        except Exception as e:
            logger.warning(f"[WatchDog] Config Sync Failed: {e}")

    def pulse(self, check_name: str, status="ok", message="OK", latency=0):
        """發送心跳（Fire-and-forget，不阻塞主程式）"""
        payload = {
            "check_name": check_name,
            "status": status,
            "message": str(message),
            "latency": latency
        }

        def _send():
            try:
                requests.post(f"{self.base_url}/api/pulse", json=payload, headers=self.headers, timeout=5)
            except Exception:
                pass  # 監控系統掛了不影響主程式

        threading.Thread(target=_send).start()
```

### 使用範例：定期心跳監控

```python
# main.py 或 app.py
from utils.watchdog import WatchDogClient

# 初始化（請替換成你的 token 和 project_id）
wd = WatchDogClient(
    token="your-project-token-here",
    project_id="my-service"
)

# 服務啟動時註冊檢查規則
wd.register_checks([{
    "name": "db_health",
    "display_name": "資料庫健康檢查",
    "type": "heartbeat",
    "interval": 60,    # 60秒回報一次
    "grace": 10,       # 10秒緩衝
    "threshold": 3,    # 連續失敗3次才警報
    "cooldown": 300    # 5分鐘內不重複警報
}])

# 定期執行健康檢查
def health_check():
    import time
    start = time.time()

    try:
        # 執行你的健康檢查邏輯
        # db.execute("SELECT 1")
        time.sleep(0.1)  # 模擬延遲

        latency = int((time.time() - start) * 1000)
        wd.pulse("db_health", status="ok", latency=latency)

    except Exception as e:
        wd.pulse("db_health", status="error", message=str(e))

# 使用 APScheduler 或 Celery Beat 定期執行
# sched.add_job(health_check, 'interval', seconds=60)
```

### 使用範例：事件觸發警報

```python
def payment_process():
    """處理付款，失敗時發送警報"""
    # 註冊事件型檢查
    wd.register_checks([{
        "name": "payment_failure",
        "display_name": "付款失敗",
        "type": "event",      # 事件型，平常不用報平安
        "threshold": 1,
        "cooldown": 300
    }])

    try:
        # 處理付款邏輯
        # ...
        print("Payment processed")

    except Exception as e:
        # 只在出錯時通知
        wd.pulse("payment_failure", status="error", message=f"Payment failed: {e}")
        raise  # 重新拋出例外讓上層處理
```

---

## 🔵 Node.js / TypeScript Client

適用於 Hono、Express、Next.js、NestJS 等。

### 客戶端實作

```typescript
// utils/watchdog.ts
type CheckConfig = {
  name: string;
  display_name: string;
  type: 'heartbeat' | 'event';
  interval?: number;
  grace?: number;
  threshold?: number;
  cooldown?: number;
};

export class WatchDog {
  private baseUrl = "https://watch-dog.paipeter-gui.workers.dev";

  constructor(private token: string) {}

  // 註冊檢查規則
  async register(checks: CheckConfig[]) {
    try {
      await fetch(`${this.baseUrl}/api/config`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ checks })
      });
      console.log('[WatchDog] Config synced');
    } catch (e) {
      console.error('[WatchDog] Register failed', e);
    }
  }

  // 發送心跳（不等待回應）
  pulse(checkName: string, status: 'ok' | 'error', message = 'OK', latency = 0) {
    fetch(`${this.baseUrl}/api/pulse`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        check_name: checkName,
        status,
        message,
        latency
      })
    }).catch(err => console.error('[WatchDog] Pulse failed', err));
  }
}
```

### 使用範例

```typescript
// main.ts 或 app.ts
import { WatchDog } from './utils/watchdog';

const wd = new WatchDog('your-project-token-here');

// 服務啟動時註冊
await wd.register([{
  name: 'api_server',
  display_name: 'API Server',
  type: 'heartbeat',
  interval: 30,
  grace: 5
}]);

// 定期發送心跳
setInterval(() => {
  const memUsage = process.memoryUsage().heapUsed / 1024 / 1024;
  wd.pulse('api_server', 'ok', `RAM: ${memUsage.toFixed(1)}MB`);
}, 30000);

// 捕捉特定錯誤
app.use('/api/payment', async (req, res) => {
  try {
    // 處理付款...
    res.json({ success: true });
  } catch (error) {
    wd.pulse('payment_error', 'error', error.message);
    res.status(500).json({ error: 'Payment failed' });
  }
});
```

---

## 🟠 Shell Script / Cron

適用於備份腳本、定時任務等。

```bash
#!/bin/bash

# 設定參數
WD_URL="https://watch-dog.paipeter-gui.workers.dev"
TOKEN="your-project-token-here"
CHECK_NAME="daily_db_backup"

# 執行備份
START=$(date +%s%3N)
pg_dump my_db > backup.sql
EXIT_CODE=$?
END=$(date +%s%3N)
LATENCY=$((END-START))

# 回報結果
if [ $EXIT_CODE -eq 0 ]; then
  curl -X POST "$WD_URL/api/pulse" \
       -H "Authorization: Bearer $TOKEN" \
       -H "Content-Type: application/json" \
       -d "{\"check_name\": \"$CHECK_NAME\", \"status\": \"ok\", \"latency\": $LATENCY}" \
       --max-time 5 > /dev/null 2>&1 &
else
  curl -X POST "$WD_URL/api/pulse" \
       -H "Authorization: Bearer $TOKEN" \
       -H "Content-Type: application/json" \
       -d "{\"check_name\": \"$CHECK_NAME\", \"status\": \"error\", \"message\": \"Backup failed with code $EXIT_CODE\"}" \
       --max-time 5 > /dev/null 2>&1 &
fi
```

---

## 💡 重要提示

### 1. Fire-and-Forget 設計
所有範例都使用非阻塞方式發送心跳，**監控系統掛掉不會影響主程式**。

### 2. Token 安全
- Token 在 `/admin` 的 Projects 頁面創建項目時獲得
- 每個項目有獨立的 Token
- 請妥善保管，不要提交到公開代碼庫

### 3. 檢查參數說明

| 參數 | 說明 |
|------|------|
| `name` | 檢查唯一識別名（snake_case） |
| `type` | `heartbeat` = 定期監控, `event` = 事件觸發 |
| `interval` | 心跳間隔（秒），僅 heartbeat 使用 |
| `grace` | 寬限期（秒），超過 interval+grace 才算逾期 |
| `threshold` | 連續失敗幾次才觸發警報 |
| `cooldown` | 警報冷卻時間（秒），避免重複通知 |

### 4. 在 Admin 頁面管理

訪問 `https://watch-dog.paipeter-gui.workers.dev/admin` 可以：
- 查看/創建/刪除項目
- 查看所有檢查狀態
- 啟用/禁用監控（Monitor checkbox）
- 配置 Slack 通知

---

## 快速開始

1. 訪問 `https://watch-dog.paipeter-gui.workers.dev/admin`
2. 切換到 **Projects** 標籤，點擊 **New Project** 創建項目
3. 複製生成的 **Token**
4. 對照上方範例整合到你的服務
5. 完成！你的服務現在被監控了
