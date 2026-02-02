沒問題。作為你的 CTO，我必須確保這套系統不僅架構漂亮，還要讓終端開發者（也就是未來的你或同事）覺得**「好用到哭」**。

這裡整理了 **Python** 與 **Node.js/TypeScript** 的完整 Client 範例。涵蓋了你要求的：
1.  **定期監控 (Heartbeat)**：如「每分鐘檢查 DB 連線」。
2.  **不定時觸發 (Event)**：如「發生例外錯誤 (Exception) 時報警」。

---

### 🟢 範例一：Python Client (適用於 Django, FastAPI, 排程腳本)

這是最完整的封裝。建議將 `WatchDogClient` 存為 `utils/watchdog.py`，然後在各處引用。

```python
# utils/watchdog.py
import requests
import logging
import threading

logger = logging.getLogger(__name__)

class WatchDogClient:
    def __init__(self, base_url: str, token: str, project_id: str):
        self.base_url = base_url.rstrip("/")
        self.headers = {"Authorization": f"Bearer {token}"}
        self.project_id = project_id

    def register_checks(self, checks: list):
        """
        系統啟動時呼叫：註冊/更新檢查規則
        """
        payload = {"checks": checks}
        try:
            # 使用 threading 避免卡住主程式啟動
            threading.Thread(target=self._do_register, args=(payload,)).start()
        except Exception as e:
            logger.error(f"WatchDog Register Failed: {e}")

    def _do_register(self, payload):
        try:
            requests.put(f"{self.base_url}/api/config", json=payload, headers=self.headers, timeout=10)
        except Exception as e:
            logger.warning(f"WatchDog Config Sync Failed: {e}")

    def pulse(self, check_name: str, status="ok", message="OK", latency=0):
        """
        發送心跳 (Fire-and-forget，不等待回傳，不拋出錯誤)
        """
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
                pass # 監控系統掛了不應該影響主程式
        
        threading.Thread(target=_send).start()

# --- 使用場景 A: 定期監控 (Heartbeat) ---
# 放在排程任務中，例如 Celery Beat 或 Crontab

def run_periodic_health_check():
    # 1. 初始化
    wd = WatchDogClient(
        base_url="https://watchdog.your-domain.com", 
        token="topreview-secret-123",
        project_id="topreview"
    )

    # 2. 註冊 (通常放在 App 啟動時做一次就好，這裡為了示範放在一起)
    wd.register_checks([{
        "name": "db_connectivity",
        "display_name": "資料庫連線檢查",
        "type": "heartbeat",   # 定期檢查
        "interval": 60,        # 承諾 60秒 回報一次
        "grace": 10,           # 給 10秒 緩衝
        "threshold": 3         # 連續失敗 3 次才叫
    }])

    # 3. 執行檢查邏輯
    import time
    start = time.time()
    
    try:
        # 模擬檢查 DB
        # db.execute("SELECT 1") 
        time.sleep(0.1) # 模擬延遲
        
        latency = int((time.time() - start) * 1000)
        
        # 4. 回報成功
        wd.pulse("db_connectivity", status="ok", latency=latency)
        print("Heartbeat sent: OK")
        
    except Exception as e:
        # 5. 回報失敗 (雖然 WatchDog 沒收到也會報警，但主動報錯可以帶上錯誤訊息)
        wd.pulse("db_connectivity", status="error", message=str(e))
        print("Heartbeat sent: Error")

# --- 使用場景 B: 不定時觸發 (Event/Ad-hoc) ---
# 放在 try-catch block 中，捕捉預期外的嚴重錯誤

def critical_payment_process():
    wd = WatchDogClient("https://watchdog.your-domain.com", "topreview-secret-123", "topreview")
    
    # 註冊事件型檢查 (注意 type 是 'event')
    wd.register_checks([{
        "name": "payment_failure",
        "display_name": "金流交易失敗",
        "type": "event",       # 事件型 (平常不用報平安)
        "threshold": 1,        # 錯 1 次馬上叫
        "cooldown": 300        # 5分鐘內不要重複轟炸
    }])

    try:
        # ... 處理金流 ...
        # raise ValueError("Stripe API Connection Refused")
        print("Payment processed.")
        
    except Exception as e:
        # 只有出錯時才通知
        wd.pulse("payment_failure", status="error", message=f"Payment Exception: {e}")
        # 這裡通常還會 raise e 讓程式正常崩潰或重試
```

---

### 🔵 範例二：Node.js / TypeScript Client (適用於 Hono, Express, Next.js)

Node.js 天然非同步，所以不需要像 Python 那樣開 Thread。

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
  private baseUrl: string;
  private token: string;

  constructor(baseUrl: string, token: string) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.token = token;
  }

  // 註冊檢查
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

  // 發送心跳
  pulse(checkName: string, status: 'ok' | 'error', message = 'OK', latency = 0) {
    // 不用 await，背景發送即可
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

// --- 使用場景 A: 伺服器存活監控 (Server Liveness) ---
// 在 app.listen 之後啟動

const wd = new WatchDog("https://watchdog.your-domain.com", "ai-auditor-token-888");

async function startServer() {
  // 1. 註冊
  await wd.register([{
    name: "api_server_process",
    display_name: "API Server Process",
    type: "heartbeat",
    interval: 30, // 30秒一次
    grace: 5
  }]);

  // 2. 啟動伺服器
  // app.listen(3000)...

  // 3. 設定定時器回報
  setInterval(() => {
    const memoryUsage = process.memoryUsage().heapUsed / 1024 / 1024;
    wd.pulse("api_server_process", "ok", `RAM: ${memoryUsage.toFixed(1)} MB`);
  }, 30000); // 30s
}

// --- 使用場景 B: 捕捉特定錯誤 (Event) ---

async function thirdPartySync() {
  // 這裡假設已經 register 過了 (通常在 index.ts 統一註冊)
  
  try {
    // 呼叫 OpenAI API...
    // await openai.chat.completions...
  } catch (error: any) {
    console.error("Sync failed", error);
    
    // 只有發生錯誤時才發送
    wd.pulse(
        "openai_api_error", 
        "error", 
        `OpenAI 500 Error: ${error.message}`
    );
  }
}
```

---

### 🟠 範例三：Shell Script / Cron (適用於簡單的備份腳本)

如果你有些舊的 Linux Cron Job (比如每天備份資料庫)，不想寫 Python，可以直接用 `curl`。

```bash
#!/bin/bash

# 設定參數
WD_URL="https://watchdog.your-domain.com"
TOKEN="legacy-project-token"
CHECK_NAME="daily_db_backup"

# 1. 執行備份命令
START=$(date +%s%3N)
pg_dump my_db > backup.sql
EXIT_CODE=$?
END=$(date +%s%3N)
LATENCY=$((END-START))

# 2. 判斷結果並回報 WatchDog
if [ $EXIT_CODE -eq 0 ]; then
  # 成功：回報 OK
  curl -X POST "$WD_URL/api/pulse" \
       -H "Authorization: Bearer $TOKEN" \
       -H "Content-Type: application/json" \
       -d "{\"check_name\": \"$CHECK_NAME\", \"status\": \"ok\", \"latency\": $LATENCY, \"message\": \"Backup Success\"}" \
       --max-time 5 > /dev/null 2>&1 &
else
  # 失敗：回報 Error
  curl -X POST "$WD_URL/api/pulse" \
       -H "Authorization: Bearer $TOKEN" \
       -H "Content-Type: application/json" \
       -d "{\"check_name\": \"$CHECK_NAME\", \"status\": \"error\", \"message\": \"pg_dump failed with code $EXIT_CODE\"}" \
       --max-time 5 > /dev/null 2>&1 &
fi
```

---

### 💡 CTO 的叮嚀

1.  **容錯設計 (Fire and Forget)**：
    *   你看我在 Python 和 Node.js 範例裡，發送 `pulse` 時都用了 `try...catch` 或者 `catch()` 吞掉錯誤。
    *   **重點**：**監控系統掛掉，絕不能導致主程式跟著掛掉**。Watch-Dog 是配角，不能搶戲。
2.  **統一註冊 (Registration)**：
    *   建議在每個專案的 `main` 或 `app.ts` 入口處，統一呼叫一次 `register()`。
    *   這樣如果未來你改了檢查頻率 (例如從 60s 改成 300s)，只要改專案代碼並重啟，Watch-Dog 那邊的設定就會自動更新 (Upsert)。
3.  **命名規範**：
    *   `check_name` 建議用 snake_case，例如 `daily_backup`, `api_health`。
    *   `message` 盡量簡短，但如果出錯，一定要帶上關鍵的 Exception Message。

這三套範例（Python, Node, Bash）應該能覆蓋你 99% 的使用場景了。