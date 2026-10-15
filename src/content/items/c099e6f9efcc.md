---
title: "Liquid AI 发布 LFM2.5-24B-A2B：为端侧快速 agent 而生"
date: "2026-10-15"
description: "hackernews 的 AI 热点详述"
source: "hackernews"
url: "https://www.liquid.ai/blog/lfm2-5-24b-a2b"
score: "18"
orig_title: "LFM2.5-24B-A2B: Built for fast on-device agents"
---

端侧（on-device）AI 与本地 agent 正在成为模型厂商的新战场：用户希望模型在手机、笔记本上低延迟运行，且数据不必上传云端。Liquid AI 发布 LFM2.5-24B-A2B，明确把「快速端侧 agent」作为设计目标。

从命名可以读出关键规格：总量约 24B 参数、激活参数约 2B（A2B），属于稀疏激活/类 MoE 的架构取向——用较大的总容量保留知识广度，用极小的激活规模换取低延迟与低内存占用。这正好契合 agent 场景的特点：多轮工具调用、频繁的短推理，对首 token 延迟和吞吐的敏感度远高于对单次超长推理的需求。该模型属于 LFM2.5 系列的迭代版本。

后续关注点有三：一是真机实测的 tokens/s 与内存占用，特别是量化后的表现；二是工具调用、结构化输出等 agent 关键能力是否达标，而非只看通用榜单；三是与小参数稠密模型的横向对比——如果 2B 级激活就能完成任务，端侧 agent 的隐私优势与离线可用性会迅速转化为产品卖点。

> 本页摘要由 AI 自动生成，仅供参考，请以原文为准。
