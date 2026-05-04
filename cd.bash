cd /home/claude && python3 << 'EOF'
import pandas as pd
pd.set_option('display.max_colwidth', None)
df = pd.read_excel('/mnt/user-data/uploads/0422_Learner-AI_Trust_Papers.xlsx')
teacher_ids = [2, 7, 8, 9, 10, 20, 22, 23]
student_df = df[~df['编号'].isin(teacher_ids)].copy()

for i, row in student_df.iterrows():
    val = str(row['影响人机信任的因素和机制']).strip()
    if val and val != 'nan':
        print(f"\n{'='*60}")
        print(f"编号 {row['编号']} | {row['作者']}({row['发表年份']})")
        print(f"{'='*60}")
        print(val)
EOF
Output


============================================================
编号 1 | Nazaretsky et al.(2025)
============================================================
问卷结果：
对 AI-EdTech 有用性的感知；
对障碍/风险的感知，尤其透明性、隐私、伦理问题；
学生对自身使用 AI 的准备度；
学生对 AI 的感知信任；
人口学差异（男性学生感知到的风险/障碍显著低于少数性别群体；工程、数学、物理专业学生感知 usefulness 低于计算机与通信专业学生；硕士生 perceived obstacles 略高；年龄与四个因子无显著关系。）
开放题结果：
决策过程不透明；
数据来源、收集方式、责任归属不清；
隐私风险、监控、画像；
偏见、缺乏多样性、AI mistakes；
AI 难以理解学习中的社会情感因素与学生在系统外的真实学习情境；
对 AI 输出准确性与偏差的担忧

============================================================
编号 3 | Pitts & Motamedi(2025)
============================================================
作者区分：human-like trust
和system-like trust。前者包括：ability，benevolence，integrity。system-like trust 包括：functionality，helpfulness，reliability。
作者认为 AI chatbot 的 anthropomorphic characteristics 会使 trust 的形成变得模糊和复杂。影响学生 trust 的关键机制包括：anthropomorphism；social affordances；natural language conversation；responsiveness； simulated social cues； CASA（Computers Are Social Actors）机制。
当 chatbot 展现 conversational abilities、empathy 或 personality cues 时，学生可能会像评价 social partner 一样评价它；
但由于它仍是 software system，学生又会基于功能性进行评价。
**容易产生tension的地方
其他发现：reliability items 分数相对较低，说明学生看到 AI 的潜力，但对其 dependability 有担心；integrity 和 benevolence 的若干条目分数偏低，说明学生对 AI 是否真正 prioritise learning needs、是否 truthful 仍有顾虑。

============================================================
编号 5 | Zhang et al.(2025)
============================================================
最核心的相关机制是：AI literacy，AI trust，AI dependency，三者之间的关系

============================================================
编号 6 | Karayianni, Klidas, C. Karakitsou(2025)
============================================================
anthropomorphism：ChatGPT 的人类式界面和连贯自然语言会增强 trust；AI literacy / familiarity：对 AI 更熟悉会带来更正面的态度和更高 perceived usefulness；institutional support：培训、明确政策、工作坊和教师指导可提升 trust；

具体结果：student engagement 与 ChatGPT trust 正相关（r = 0.273, p < 0.01）；
ChatGPT trust 与 general AI attitudes 正相关（r = 0.444, p < 0.01）；
与 perceived usefulness 正相关（r = 0.566, p < 0.01）；
与 institutional support 正相关（r = 0.270, p < 0.01）；
与 academic support from instructors 正相关（r = 0.295, p < 0.01）。

============================================================
编号 12 | Chiu et al.(2023)
============================================================
影响学生与 chatbot 形成正向互动体验的关键机制包括：

student expertise（SRL、DL）；
teacher support；
chatbot 回应的准确性、清晰性与可追问性；
学生是否感觉自己有 competence；
以及 whether the chatbot is seen as facilitator/proxy teacher/tool。

============================================================
编号 13 | Chan & Hu(2023)
============================================================
影响因素（感知层面）：
1. 感知有用性：个性化学习支持、写作与头脑风暴辅助、研究与分析能力提升、省时提效
2. 感知风险：信息准确性担忧、隐私与数据安全、伦理问题、对个人发展与批判性思维的负面影响、对职业前景和社会价值的冲击。
3. 熟悉度：学生对GenAI越熟悉，使用意愿越高，但熟悉不等于信任。
4. 学科差异与学历层次：研究生表现出更高的批判分析参与度。
机制：学生对GenAI的感知（3P模型中的Presage因素）影响其学习方法（Process）和学习结果（Product）。

============================================================
编号 14 | Abbas et al.(2024)
============================================================
前因变量（驱动ChatGPT使用的因素）：
1. 学业负担：正向预测ChatGPT使用。
2. 学业时间压力：正向预测使用。
3. 奖励敏感性：正向预测使用，追求快速完成任务的学生更倾向使用。
4. 质量敏感性：负向预测使用，注重作业质量的学生使用较少。
机制：学业压力与奖励动机驱动学生将认知负担外包给AI，而质量关注形成使用的抑制因素。

============================================================
编号 15 | Yeung et al.(2025)
============================================================
影响信任与误用的因素：
1. AI代理性感知：将ChatGPT视为有自主性的代理者 -> 情感型信任增强 -> 误用倾向增加。
2. 自动化偏见：误用者表现出更强的自动化偏见，倾向于接受AI输出而不批判评估。
3. 使用动机差异：Enhancement型（增强学习质量）较少误用；Disburdenment型（减轻学习负担）多为误用。
4. AI幻觉意识：部分误用者即使知道ChatGPT可能产生错误，仍继续依赖，因为核查成本被视为次要负担。
机制：代理性感知 -> 情感型信任 -> 自动化偏见 -> 误用行为。

============================================================
编号 16 | Pitts et al.(2025)
============================================================
影响依赖模式的因素
1. 编程自我效能感：正相关于适当依赖，负相关于依赖不足。
2. 编程素养：正相关于适当依赖，负相关于依赖不足。
3. 认知需求：正相关于适当依赖，负相关于依赖不足。
4. 任务后信任：正相关于过度依赖，负相关于适当依赖。
5. 满意度：正相关于过度依赖，负相关于适当依赖。
6. 自动化偏见：学生倾向于接受AI建议而非依靠自身判断。
机制：领域能力越强、认知需求越高的学生越能批判评估AI建议，形成适当依赖；对AI越信任和满意的学生越可能过度依赖，接受错误建议。

============================================================
编号 17 | Zhao & Li(2025)
============================================================
1. Intrinsic trust（学习者-GenAI 交互中产生），由两组编码构成：
① GenAI reasoning 的可解释性：comprehensive explanatory support、real-time interaction、consistent outputs、transparent error handling；
② 与学习者先验的认知对齐：familiarity with AI technology、cognitive load management（输出难度既不过简也不过繁）、personalized feedback（契合学习风格/目标/水平/节奏/动机）、contextual appropriateness（文化敏感性、任务契合、伦理考量）。

2. Extrinsic trust（外部因素与 GenAI 本身影响），三组编码：
① Key informants：教师、同伴、政策制定者对 GenAI 的意见（注：受访者中只有 22.5% 感到教师/机构明确支持，37.5% 无明确支持，40% 不确定）；
② Evidence-supported evaluation：来自研究、新闻等媒体的证据支持的评价；
③ Ancillary attributes：用户友好界面、情感支持感知、拟人化元素。

机制：信任作为 SOR 框架中的stimulus，通过影响 reliance 和 resistance，进而影响使用意愿和实际使用。信任与 reliance/resistance 之间还存在边界条件 perceived risk。

============================================================
编号 18 | Darvishi et al.(2024)
============================================================
1. 核心影响因素
①AI提示的持续可用性：AI撤除后（NR组），Flag Rate从0.14升至0.31（Cohen d=-0.61，中到大效应）；Similarity Score从0.28升至0.32（d=-0.30）；Relatedness Score从0.31降至0.27（d=0.33）；Comment Length从23.38降至19.43词（d=0.28）。所有差异p<0.001。
②自我监控工具：SR组在Flag Rate和Similarity上虽优于NR组但仍显著弱于AI组；但Comment Length无显著差异，表明SRL在维持评论长度方面有效。
③认知负荷：AI + 清单叠加→负荷↑，SRL在维持评论长度方面有效
2. 作用机制
AI提示充当分布式元认知，学生将质量评估外包给AI而非内化评估标准，形成依赖而非学习。

============================================================
编号 19 | Wang et al.(2021)
============================================================
1. 主要影响因素（从语言线索推断）
论文通过回归分析发现，学生与JW对话的语言特征能够显著反映他们对JW的感知。这些特征可视作影响或关联感知（进而可能影响信任）的因素
①负面关联：冗余度（帖子的独特词数量、句子复杂度）越高，感知越负面。
②正面关联：可读性（Coleman-Liau指数）、情感（VADER情感分析得分）、语言多样性（词向量与平均向量的余弦距离）、③适应性（学生问题与JW回答之间的词向量余弦相似度）越高，对JW的拟人化、智能和好感度的感知越积极。
2. 机制解释：这些语言特征反映了用户如何根据他们对对话代理的心智模型来调整自己的沟通方式。例如，更高的可读性和适应性可能意味着用户认为代理更能理解，从而获得更满意的互动和更积极的感知。

============================================================
编号 21 | Pal et al.(2026)
============================================================
核心机制：心智理论（ToM）与共同心智理论（MToM）。学生为AI构建心智模型（如“它像人一样理解”或“它只是统计工具”），该模型直接影响信任评估。
信任驱动因素：
①能力感知：解释的准确性、深度、是否存在幻觉或数学错误。
②可解释性：推理过程是否透明。
③依赖驱动因素：依赖行为主要受社交因素驱动，而非信任本身，包括可访问性（Accessibility，24/7可用）、匿名性（Anonymity，无社交成本）、无评判感（Judgment-free）。
