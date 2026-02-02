# Watch-Dog 檢查腳本介面定義

> **目的**: 定義檢查腳本與執行器之間的協議

---

## 1. 執行協議

### 1.1 命令列介面

所有檢查腳本必須支援以下參數：

```bash
./check_script.py [OPTIONS]
```

| 參數 | 必填 | 說明 |
|-----|------|------|
| `--base-url URL` | 否 | 基礎 URL (預設從 config.yaml 讀取) |
| `--output-format FORMAT` | 否 | 輸出格式: `json` (預設) 或 `text` |
| `--timeout SECONDS` | 否 | 逾時秒數 |
| `--config FILE` | 否 | 配置檔路徑 |

### 1.2 執行環境

- **工作目錄**: 專案根目錄 (config.yaml 中的 `paths.project_root`)
- **Python**: 系統預設 Python 或指定虛擬環境
- **環境變數**:
  - `WATCHDOG_PROJECT`: 專案名稱
  - `WATCHDOG_CHECK`: 檢查名稱
  - `WATCHDOG_BASE_URL`: 基礎 URL
  - `WATCHDOG_OUTPUT_FORMAT`: 輸出格式

---

## 2. 輸出格式

### 2.1 成功輸出 (Exit Code: 0)

```json
{
  "check_name": "smoke_test",
  "project": "topreview-edge",
  "status": "pass",
  "exit_code": 0,
  "timestamp": "2026-02-02T12:00:00Z",
  "duration_ms": 3500,

  // 摘要 (必填)
  "summary": {
    "total": 20,           // 總檢查項目數
    "passed": 20,          // 通過數
    "failed": 0,           // 失敗數
    "skipped": 0           // 跳過數
  },

  // 詳細結果 (可選)
  "details": [
    {
      "item": "/",
      "status": "pass",
      "message": "OK",
      "metadata": {
        "seo_score": 95,
        "response_time_ms": 120
      }
    }
  ],

  // 警告列表 (可選)
  "warnings": [
    {
      "item": "/about",
      "message": "SEO score below threshold"
    }
  ]
}
```

### 2.2 失敗輸出 (Exit Code: 1)

```json
{
  "check_name": "smoke_test",
  "project": "topreview-edge",
  "status": "fail",
  "exit_code": 1,
  "timestamp": "2026-02-02T12:00:00Z",
  "duration_ms": 4200,

  "summary": {
    "total": 20,
    "passed": 17,
    "failed": 3,
    "skipped": 0
  },

  // 失敗項目
  "failures": [
    {
      "item": "/shop-999",
      "error": "HTTP 404",
      "severity": "critical"
    }
  ]
}
```

### 2.3 錯誤輸出 (Exit Code: 2)

```json
{
  "check_name": "smoke_test",
  "project": "topreview-edge",
  "status": "error",
  "exit_code": 2,
  "timestamp": "2026-02-02T12:00:00Z",
  "duration_ms": 0,

  "error": {
    "type": "ConnectionError",
    "message": "Connection timeout",
    "recoverable": false
  }
}
```

### 2.4 跳過輸出 (Exit Code: 3)

```json
{
  "check_name": "smoke_test",
  "project": "topreview-edge",
  "status": "skip",
  "exit_code": 3,
  "timestamp": "2026-02-02T12:00:00Z",

  "skip_reason": "Maintenance mode active"
}
```

---

## 3. 欄位定義

### 3.1 Status 值

| 值 | 說明 | Exit Code |
|----|------|-----------|
| `pass` | 所有檢查通過 | 0 |
| `fail` | 部分檢查失敗 | 1 |
| `error` | 執行錯誤 (無法完成檢查) | 2 |
| `skip` | 跳過檢查 | 3 |

### 3.2 Severity 級別

| 級別 | 說明 | 通知頻道 |
|-----|------|---------|
| `critical` | 關鍵失敗 | #warnings |
| `warning` | 警告 | #warnings |
| `info` | 資訊 | #system-logs |

---

## 4. 參考實作

### 4.1 最小範本

```python
#!/usr/bin/env python3
import json
import sys
from datetime import datetime

def main():
    result = {
        "check_name": "example_check",
        "status": "pass",
        "exit_code": 0,
        "timestamp": datetime.now().isoformat() + "Z",
        "duration_ms": 100,
        "summary": {"total": 1, "passed": 1, "failed": 0, "skipped": 0}
    }

    print(json.dumps(result, indent=2))
    return 0

if __name__ == "__main__":
    sys.exit(main())
```

### 4.2 帶錯誤處理的範本

```python
#!/usr/bin/env python3
import json
import sys
from datetime import datetime

def run_check():
    """執行檢查，回傳結果"""
    # ... 檢查邏輯 ...
    return {
        "status": "pass",
        "summary": {"total": 10, "passed": 10, "failed": 0}
    }

def main():
    start = datetime.now()
    try:
        result = run_check()
        duration_ms = int((datetime.now() - start).total_seconds() * 1000)

        output = {
            "check_name": "my_check",
            "status": result["status"],
            "exit_code": 0 if result["status"] == "pass" else 1,
            "timestamp": datetime.now().isoformat() + "Z",
            "duration_ms": duration_ms,
            "summary": result["summary"]
        }

        print(json.dumps(output, indent=2))
        return output["exit_code"]

    except Exception as e:
        output = {
            "check_name": "my_check",
            "status": "error",
            "exit_code": 2,
            "timestamp": datetime.now().isoformat() + "Z",
            "error": {
                "type": type(e).__name__,
                "message": str(e)
            }
        }
        print(json.dumps(output, indent=2))
        return 2

if __name__ == "__main__":
    sys.exit(main())
```

---

## 5. 驗證

檢查腳本應符合以下條件：

- [ ] 可獨立執行 (不依賴 watch-dog)
- [ ] 輸出有效 JSON 到 stdout
- [ ] 正確的 Exit Code
- [ ] 支援 `--base-url` 參數
- [ ] 在逾時時正確處理
- [ ] 錯誤訊息輸出到 stderr (除 JSON 外)
