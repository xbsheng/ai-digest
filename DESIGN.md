# Design — AI 晨报

<!-- impeccable:design-schema 1 -->

## World

新闻早班电报/报社晨版（用户 pin，中文日报头版谱系）。日报就是报纸：每天 09:30 准时出刊，期号连续，过刊可翻。拒绝资讯站的卡片流与暗底霓虹默认。

## Tokens

| Token | 值 | 用途 |
|---|---|---|
| `--paper` | `#f6f1e7` | 纸白底 |
| `--paper-deep` | `#efe7d6` | 引题/弱化面 |
| `--ink` | `#211d15` | 正文墨黑 |
| `--ink-2` | `#6b6455` | 次级信息 |
| `--rule` | `#d6cdb8` | hairline 栏线 |
| `--stamp` | `#a93018` | 印章红：报头戳、强调、hover |

- 印章红只出现在版次戳、电讯条符号、链接 hover 与 focus outline——不铺面。
- 版块分隔一律双细线（`3px double`）或 hairline，不用阴影、不用圆角卡片。

## Typography

- 报头/标题：Noto Serif SC 900（Google Fonts 分片按需加载，`display=swap`），系统宋体栈兜底（Songti SC / STSong / SimSun）。
- 正文：同一 serif 族，17px/1.9（移动 16px），两端对齐。
- 期号/日期/页脚：`ui-monospace`，tabular 数字——mono 只用于数据，不做"技术感"装饰。
- 报名字距 0.18em，版块题字距 0.3em，中文排印节奏。

## Composition

- **头版（index）**：期号栏 → 居中大报名 + 印章戳 → 双细线 → 电讯条 → 头条区（2/3：今日版标题、导语、三条要闻；1/3 右栏：周末特刊 + 出刊说明，栏线分隔非卡片）→ 双细线 → 今日要点三栏简讯（`columns + column-rule`，移动单栏）→ 过刊架（按月分组两栏）。
- **版面页（daily/weekly）**：compact 报头（日期 | 期号）+ 报名 + 版次戳；正文 46rem 单栏；版块题上单细线；前后期导航。
- **周末特刊** = 周报，印章戳文案区分，版式与早版同构。

## Motion

唯一的授权动效：电讯条横向滚动（55s linear 无限循环，hover 暂停，`prefers-reduced-motion` 下静止）。其余交互只有链接下划线颜色/粗细过渡（0.15s ease-out）。无入场动画。

## States

- 链接 hover：墨→印章红，下划线 1px→2px；focus-visible 印章红 outline。
- 空态：无日报时头版显示「首期未出刊」+ 出刊指引；无周报时右栏提示首期出刊时间。
- 长串 URL：`overflow-wrap: anywhere` 防横向溢出。

## Responsive

- `56rem` 以下：头版右栏转全宽（双细线分隔）、过刊单栏。
- `34rem` 以下：正文 16px、报名字距收紧、印章戳字距收紧。
- 移动端与桌面同内容同层级，无删减。

## Notes

- 字体取舍：曾尝试自托管 @fontsource/noto-serif-sc（npm 与网络均不稳定）；采用 Google Fonts unicode-range 分片 + 系统宋体兜底，swap 策略下离线/慢网仍呈现完整报纸气质。
- 品类惯例的暗底霓虹渐变、玻璃拟态、图标卡片被显式排除（见 Base.astro 方向契约注释）。
