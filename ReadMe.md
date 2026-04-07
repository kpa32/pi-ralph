

[人机协作文件]
00讨论需求.md
00讨论开发环境.md

[agent使用到的提示词]



# 快速开始

0. /ralph init  复制 .ralph 和doc 到用户的根目录,后续插件读取的文件都是用户项目目录，不读取和修改本项目文件

1. 告诉agent  @ 00讨论需求.md   说明你的需求，要制作的产品 ，例如  "@ doc/00讨论需求.md  我想制作一个TODO应用"
agent会根据 [00讨论需求.md] 制作一份合格的需求规格说明书(specs)

2. 检查下spec下的文件是否符合你的需求，如果不符合，继续流程1

3. 告诉agent @00讨论开发环境.md 说明下本项目如何构建编译验证测试  例如  "@00讨论开发环境.md 根据文档创建本项目开发环境"
    agent会根据和你的对话和项目上下文生成 [ralph_agent.md] 每次启动新agent 文件会注入到开始部分
    
4. 使用 /ralph plan 命令让agent创建实施计划。 [makefile.md] [ralph_plan.md]会作为提示词注入到agent中。然后读取spec文件创作出 Tasks.md

5. 使用 /ralph build 命令让agent开发工程。 [makefile.md] [ralph_build.md] 会作为提示词注入到agent中,agent会自己去读取Tasks.md选择任务开始执行





为什么不把 00讨论需求.md 制作成  /ralph init 命令. 00讨论需求.md 作为一个模板，你可以修改其中内容以符合你的实际项目需求。不是固定不变的