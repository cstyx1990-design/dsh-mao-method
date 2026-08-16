#!/usr/bin/env bash
# 拉取《毛泽东选集》全文语料到 data/corpus/（本地检索用，不随包分发）。
# 来源：https://github.com/lansepeach/maoxuan（毛选 1-7 合集，据人民出版社选集整理）
# 用法：bash scripts/fetch-corpus.sh [target_dir]（缺省 data/corpus）
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TARGET="${1:-$ROOT/data/corpus}"
BASE="https://raw.githubusercontent.com/lansepeach/maoxuan/main"

mkdir -p "$TARGET"

# 精选核心篇目（卷内索引的检索兜底 + 方法论精读依据）
CORE=(
  "028_实践论.md|01_实践论.md"
  "029_矛盾论.md|02_矛盾论.md"
  "040_论持久战.md|03_论持久战.md"
  "018_反对本本主义.md|04_反对本本主义.md"
  "075_改造我们的学习.md|05_改造我们的学习.md"
  "086_关于领导方法的若干问题.md|06_关于领导方法的若干问题.md"
  "165_党委会的工作方法.md|07_党委会的工作方法.md"
  "056_纪念白求恩.md|08_纪念白求恩.md"
  "092_为人民服务.md|09_为人民服务.md"
  "099_愚公移山.md|10_愚公移山.md"
  "011_中国社会各阶级的分析.md|11_中国社会各阶级的分析.md"
  "012_湖南农民运动考察报告.md|12_湖南农民运动考察报告.md"
)

fetch() { # fetch <url> <out>
  for i in 1 2 3; do
    if curl -fsSL --max-time 120 -A "dsh-mao-method" -o "$2" "$1"; then return 0; fi
    sleep 2
  done
  echo "FAILED: $1" >&2
  return 1
}

for entry in "${CORE[@]}"; do
  src="${entry%%|*}"; dst="${entry##*|}"
  fetch "$BASE/$src" "$TARGET/$dst"
done

# 四卷全量（按卷分目录；仅需索引检索可跳过本段——注释掉下方四行即可）
declare -A VOLUMES=( [v1]="011..029" [v2]="032..071" [v3]="073..104" [v4]="107..176" )
for vol in v1 v2 v3 v4; do
  mkdir -p "$TARGET/$vol"
  range="${VOLUMES[$vol]}"
  start="${range%%..*}"; end="${range##*..}"
  for (( n = 10#$start; n <= 10#$end; n++ )); do
    printf -v num "%03d" "$n"
    # 文件名需从仓库 API 获取（含中文与全角标点）；此处用 API 列表匹配
    name=$(curl -fsSL --max-time 60 -H "User-Agent: dsh-mao-method" \
      "https://api.github.com/repos/lansepeach/maoxuan/contents" 2>/dev/null \
      | grep -o "\"name\": \"${num}_[^\"]*\.md\"" | head -1 | sed 's/"name": "//;s/"$//' || true)
    if [ -z "$name" ]; then echo "skip $num (name lookup failed)"; continue; fi
    if [ ! -f "$TARGET/$vol/$name" ]; then
      fetch "$BASE/$name" "$TARGET/$vol/$name"
    fi
  done
done

echo "完成：语料已就位于 $TARGET"
echo "版权提示：全文仅限本地个人检索使用，勿随包分发（见 README 版权声明）。"
