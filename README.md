# Watch-Dog: 專案監控框架

> **目的**: 中央集權式監控所有專案的健康狀態
> **架構**: 協議驅動 + 插件式檢查腳本

---

## 架構概覽

```
watch-dog/
├── bin/                    # 執行器
│   ├── runner.py          # 主執行器
│   └── alert.py           # 警報發送器
├── projects/              # 各專案的監控配置
│   ├── topreview-edge/
│   │   ├── config.yaml    # 協議配置檔
│   │   └── checks/        # 該專案的檢查腳本
│   │       ├── smoke.py
│   │       └── consistency.py
│   ├── ai-auditor-fastapi/
│   │   └── config.yaml
│   └── card-edge/
│       └── config.yaml
├── logs/                  # 執行日誌
├── state/                 # 狀態快照 (.test-status.json 等)
├── reports/               # 報告輸出
└── protocol/              # 協議定義
    ├── schema.yaml        # 配置檔 Schema
    └── interface.md       # 介面定義
```

---

## 協議檔格式 (config.yaml)

每個專案必須提供 `config.yaml`，定義監控配置：

```yaml
# 專案基本資訊
project:
  name: "topreview-edge"
  display_name: "TopReview Edge"
  base_url: "https://topreview.cc"

# 檢查項目定義
checks:
  - name: "smoke_test"
    display_name: "Smoke Test (關鍵頁面)"
    script: "checks/smoke.py"
    schedule: "0 2 * * *"     # Crontab 格式
    timeout: 180              # 秒
    enabled: true

  - name: "consistency"
    display_name: "Consistency Check (三位一體)"
    script: "checks/consistency.py"
    schedule: "0 2 * * *"
    timeout: 300
    enabled: true

# 警報設定
alerts:
  slack:
    enabled: true
    channel: "#tr-warnings"
    on_failure: true
    on_recovery: true

  email:
    enabled: false
    recipients: []

# 狀態檔案路徑 (相對於專案根目錄)
status_file: ".test-status.json"

# 專案根目錄 (絕對路徑)
project_root: "/home/peterpai/work/topreview-edge"
```

---

## 檢查腳本介面 (Check Script Interface)

所有檢查腳本必須遵循協定：

### 輸入

```bash
./checks/smoke.py --base-url https://topreview.cc --output-format json
```

### 輸出格式 (JSON to stdout)

```json
{
  "check_name": "smoke_test",
  "status": "pass",           // pass | fail | error | skip
  "exit_code": 0,
  "summary": {
    "total": 20,
    "passed": 20,
    "failed": 0
  },
  "details": [
    {
      "url": "/",
      "status": "pass",
      "message": "OK",
      "seo_score": 95
    }
  ],
  "timestamp": "2026-02-02T12:00:00Z",
  "duration_ms": 3500
}
```

### 錯誤輸出

```json
{
  "check_name": "smoke_test",
  "status": "error",
  "exit_code": 1,
  "error": "Connection timeout",
  "timestamp": "2026-02-02T12:00:00Z"
}
```

---

## 執行器介面

watch-dog 提供統一的執行器：

```bash
# 執行單一專案的所有檢查
bin/runner.py --project topreview-edge

# 執行單一檢查
bin/runner.py --project topreview-edge --check smoke_test

# 執行所有專案
bin/runner.py --all

# 列出所有專案
bin/runner.py --list

# 驗證配置
bin/runner.py --validate
```

---

## 警報系統

### 警報等級

| 等級 | 說明 | 通知頻道 |
|-----|------|---------|
| `CRITICAL` | 關鍵失敗 (404, 服務down) | #warnings |
| `WARNING` | 警告 (一致性低於閾值) | #warnings |
| `INFO` | 執行記錄 | #system-logs |
| `RECOVERY` | 從失敗恢復 | #system-logs |

### 警報格式

```python
{
  "project": "topreview-edge",
  "check": "smoke_test",
  "level": "CRITICAL",
  "message": "3 pages returned 404",
  "details": {...},
  "timestamp": "2026-02-02T12:00:00Z"
}
```

---

## 狀態管理

每個專案的狀態記錄在 `state/{project_name}/`:

```
state/
└── topreview-edge/
    ├── current.json         # 最新狀態
    ├── history/             # 歷史記錄
    │   ├── 2026-02-01.json
    │   └── 2026-02-02.json
    └── trends.json          # 趨勢統計
```

---

## 下一步

1. [ ] 建立 `protocol/schema.yaml` - 配置檔驗證規則
2. [ ] 建立 `bin/runner.py` - 主執行器
3. [ ] 建立 `bin/alert.py` - 警報發送器
4. [ ] 複製 topreview-edge 檢查腳本到 `projects/topreview-edge/checks/`
5. [ ] 建立 `projects/topreview-edge/config.yaml`
6. [ ] 設定 Crontab

---

**版本**: 0.1.0
**狀態**: 規劃中
