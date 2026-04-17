#!/bin/bash
# FYMail 智能邮件队列处理器
# 每天最多发 DAILY_LIMIT 封，每批 BATCH 封，间隔 INTERVAL 秒
DAILY_LIMIT=10000
BATCH=200
INTERVAL=120
API_URL="http://localhost:3000/api/queue/process"
LOG="/var/log/fymail-queue.log"
COUNTER_FILE="/tmp/fymail-daily-sent"
LOCK_FILE="/tmp/fymail-process-queue.lock"

# flock：防止两个 cron tick 重叠（每 2 分钟的 cron 偶尔会和上一个慢 tick 撞车，
# 并发 POST /api/queue/process 会让同一批 PENDING 被发两遍）
exec 9>"$LOCK_FILE"
flock -n 9 || { echo "$(date) 上一个 tick 还在跑，跳过" >> "$LOG"; exit 0; }

# 从 .env.local 读 API_KEY（不硬编码，避免泄漏到 git/脚本）
API_KEY=$(grep '^API_SECRET_KEY=' /home/ubuntu/fymail/.env.local 2>/dev/null | sed 's/^API_SECRET_KEY=//' | tr -d '"' | head -1)
if [ -z "$API_KEY" ]; then
  echo "$(date) API_SECRET_KEY 未找到，跳过" >> "$LOG"
  exit 1
fi

# 读取今天已发数量（每天重置）
TODAY=$(date +%Y%m%d)
if [ -f "$COUNTER_FILE" ]; then
  COUNTER_DATE=$(head -1 "$COUNTER_FILE")
  COUNTER_VAL=$(tail -1 "$COUNTER_FILE")
  if [ "$COUNTER_DATE" != "$TODAY" ]; then
    COUNTER_VAL=0
  fi
else
  COUNTER_VAL=0
fi

# 检查是否超过日限
if [ "$COUNTER_VAL" -ge "$DAILY_LIMIT" ]; then
  echo "$(date) 今日已发${COUNTER_VAL}封，达到上限${DAILY_LIMIT}，跳过" >> "$LOG"
  exit 0
fi

# 发送一批
RESULT=$(curl -s -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $API_KEY" \
  -d "{\"limit\":$BATCH}" 2>&1)

PROCESSED=$(echo "$RESULT" | grep -o '"processed":[0-9]*' | cut -d: -f2)
if [ -z "$PROCESSED" ]; then PROCESSED=0; fi

# 统计实际成功的（不含失败）
# Match per-email success objects inside the "results" array, not the outer
# wrapper {"success":true,"processed":N,"results":[...]}. Each per-email
# success looks like {"id":"...","success":true,"result":{...}} while a
# failure is {"id":"...","success":false,"error":"..."}.
SENT=$(echo "$RESULT" | grep -o '"success":true,"result"' | wc -l)

COUNTER_VAL=$((COUNTER_VAL + SENT))
echo "$TODAY" > "$COUNTER_FILE"
echo "$COUNTER_VAL" >> "$COUNTER_FILE"

echo "$(date) 处理${PROCESSED}封 成功${SENT}封 今日累计${COUNTER_VAL}/${DAILY_LIMIT}" >> "$LOG"
