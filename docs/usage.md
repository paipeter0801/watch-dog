# Watch-Dog Sentinel 使用指南

## 概述

Watch-Dog Sentinel 是一個**被動監控系統**（Dead Man's Switch）。服務主動向 Watch-Dog 報告心跳，如果停止報告，系統會發送警報。

---

## 核心概念

### 1. Project Token（項目 Token）
- 每個項目有自己獨立的 Token
- 用於**客戶端 API 認證**
- 發送 pulse 或 config 時需要提供

### 2. Slack API Token（全局設置）
- 用於向 Slack 發送通知
- 在 `/admin` 的 Settings 頁面配置
- 統一管理所有警報發送

### 3. Monitor 開關
- 勾選 = 排程檢查該項目
- 不勾選 = 跳過該檢查（不會觸發 Slack 警報）

---

## 快速開始

### 第一步：創建項目

1. 訪問 `/admin`
2. 切換到 **Projects** 標籤
3. 點擊 **New Project**
4. 填寫：
   - **Project ID**: `my-service`（小寫英文、數字、連字符）
   - **Display Name**: `我的服務`
   - **Token**: 生成一個安全的 Token（至少 16 字元）
5. 點擊 **Create**

### 第二步：配置 Slack 通知

1. 訪問 `/admin`
2. 切換到 **Settings** 標籤
3. 填寫：
   - **Slack API Token**: `xoxb-...`（從 [Slack Apps](https://api.slack.com/apps) 獲取）
   - **Critical Channel**: 嚴重警報頻道 ID
   - **Success Channel**: 恢復通知頻道 ID
   - **Warning Channel**: 警告頻道 ID
   - **Info Channel**: 信息日誌頻道 ID
   - **Silence Period**: 重複警報間隔時間（秒）
4. 點擊 **Save Settings**

### 第三步：客戶端集成

在你的服務中集成 Watch-Dog 客戶端：

#### Python 範例

```python
import requests
import threading

class WatchDogClient:
    def __init__(self, base_url: str, token: str, project_id: str):
        self.base_url = base_url.rstrip("/")
        self.headers = {"Authorization": f"Bearer {token}"}
        self.project_id = project_id

    def register_checks(self, checks: list):
        """註冊檢查規則"""
        payload = {"checks": checks}
        threading.Thread(target=self._do_register, args=(payload,)).start()

    def _do_register(self, payload):
        try:
            requests.put(f"{self.base_url}/api/config", json=payload, headers=self.headers, timeout=10)
        except Exception:
            pass

    def pulse(self, check_name: str, status="ok", message="OK", latency=0):
        """發送心跳"""
        payload = {
            "check_name": check_name,
            "status": status,
            "message": str(message),
            "latency": latency
        }
        threading.Thread(target=self._send, args=(payload,)).start()

    def _send(self, payload):
        try:
            requests.post(f"{self.base_url}/api/pulse", json=payload, headers=self.headers, timeout=5)
        except Exception:
            pass

# 使用範例
wd = WatchDogClient(
    base_url="https://watch-dog.your-domain.com",
    token="your-project-token-here",
    project_id="my-service"
)

# 啟動時註冊
wd.register_checks([{
    "name": "db_health",
    "display_name": "資料庫健康檢查",
    "type": "heartbeat",
    "interval": 60,   # 60秒一次
    "grace": 10,      # 10秒緩衝
    "threshold": 3,   # 連續失敗3次才警報
    "cooldown": 300   # 5分鐘內不重複警報
}])

# 定期發送心跳
def health_check():
    try:
        # 檢查資料庫
        db.ping()
        wd.pulse("db_health", status="ok", latency=50)
    except Exception as e:
        wd.pulse("db_health", status="error", message=str(e))

# 每60秒執行一次
```

#### Node.js / TypeScript 範例

```typescript
class WatchDog {
  constructor(
    private baseUrl: string,
    private token: string
  ) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  async register(checks: any[]) {
    await fetch(`${this.baseUrl}/api/config`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ checks })
    }).catch(() => {});
  }

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
    }).catch(() => {});
  }
}

// 使用範例
const wd = new WatchDog(
  "https://watch-dog.your-domain.com",
  "your-project-token-here"
);

await wd.register([{
  name: "api_server",
  display_name: "API Server",
  type: "heartbeat",
  interval: 30,
  grace: 5
}]);

// 定期發送心跳
setInterval(() => {
  wd.pulse("api_server", "ok", "Server running");
}, 30000);
```

---

## Admin 管理

### 訪問 `/admin`

| 標籤 | 功能 |
|------|------|
| **Settings** | 配置 Slack Token 和頻道 ID |
| **Projects** | 查看、創建、刪除項目 |
| **Checks** | 查看所有檢查、啟用/禁用監控、刪除檢查 |

### Checks 欄位說明

| 欄位 | 說明 |
|------|------|
| **Type** | `heartbeat` = 定期心跳, `event` = 事件觸發 |
| **Interval** | 心跳間隔（秒） |
| **Grace** | 寬限期（秒），超過 interval+grace 才算逾期 |
| **Threshold** | 連續失敗幾次才觸發警報 |
| **Cooldown** | 警報冷卻時間（秒），避免重複通知 |
| **Monitor** | 勾選=監控，不勾選=暫停監控 |

---

## API 端點

### 發送心跳

```bash
POST /api/pulse
Authorization: Bearer {project_token}
Content-Type: application/json

{
  "check_name": "my_check",
  "status": "ok",           # ok 或 error
  "message": "一切正常",
  "latency": 50             # 毫秒（可選）
}
```

### 註冊/更新檢查規則

```bash
PUT /api/config
Authorization: Bearer {project_token}
Content-Type: application/json

{
  "checks": [
    {
      "name": "my_check",
      "display_name": "我的檢查",
      "type": "heartbeat",
      "interval": 60,
      "grace": 10,
      "threshold": 3,
      "cooldown": 300
    }
  ]
}
```

---

## 安全建議

1. **Project Token** - 保密，不要提交到公開代碼庫
2. **Slack API Token** - 使用 Bot Token，不要使用 User Token
3. **傳輸** - 使用 HTTPS
4. **存儲** - Token 存儲在環境變量或密鑰管理服務中

---

## 故障排查

### 沒有收到 Slack 通知？
1. 檢查 Settings 中的 Slack API Token 是否正確
2. 檢查頻道 ID 是否正確（右鍵頻道 → Copy Link → 提取最後一段 ID）
3. 檢查該 Check 的 Monitor 是否勾選
4. 查看 Dashboard 確認 Check 狀態

### Check 一直顯示 DEAD？
1. 確認客戶端正在發送 pulse
2. 檢查 Token 是否正確
3. 查看 Interval 和 Grace 設定是否合理
