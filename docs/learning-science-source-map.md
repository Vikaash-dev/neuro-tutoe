# Learning Science Source Map For NeuroTutor

Date: 2026-07-03

Scope: the learning-science and Feynman-inspired source spine for building an
actual AI tutor. This is not literally every paper ever written on learning.
It is the curated backbone that should drive implementation: understanding,
mistake repair, retrieval, transfer, metacognition, scaffolding, and safe AI
tutoring.

## Feynman Learning Contract

Feynman is not mainly a "paper spine" for learning research. He is a design
constraint for the tutor:

| Feynman source / principle | What it means for learning | Tutor requirement |
| --- | --- | --- |
| Feynman Lectures on Physics / "Great Explainer" tradition, `https://feynmanlectures.caltech.edu/` | Deep understanding means seeing the mechanism, not memorizing the label. | Explanations must include mechanism, example, non-example, and a check question. |
| Cargo Cult Science, Caltech 1974 commencement, `https://calteches.library.caltech.edu/51/2/CargoCult.htm` | The learner must not fool themself; a correct-looking answer can hide a broken model. | Ask learners to state uncertainty, evidence, counterexample, and what would make the answer wrong. |
| Brazilian education critique in `Surely You're Joking, Mr. Feynman!` | Rote symbols without usable meaning create fragile knowledge. | Penalize jargon-only teach-backs and require plain-language explanations. |
| Feynman technique / teach-back practice | If you cannot explain it simply, you probably do not own it yet. | Use teach-back as an assessment event, not just a prompt. |
| "What I cannot create, I do not understand" principle, commonly associated with Feynman's final blackboard | Building or deriving exposes hidden gaps. | Add create/derive/reconstruct tasks before marking mastery. |

Practical rule: every concept should pass a Feynman check:

1. Explain it in plain words.
2. Name the mechanism.
3. Give one example and one non-example.
4. State the common trap.
5. Predict what would happen in a new case.
6. Name what evidence would prove the explanation wrong.

## Core Learning Science Spine

| Research line | Key sources | Useful finding | NeuroTutor implementation rule |
| --- | --- | --- | --- |
| Mastery tutoring | Bloom, "The 2 Sigma Problem" (1984), `https://doi.org/10.3102/0013189X013006004`; Kulik and Fletcher ITS meta-analysis (2016), `https://doi.org/10.3102/0034654315581420` | Tutoring works when it gives feedback, correction, and repeated mastery attempts. | Do not advance from a concept until the learner has produced evidence: attempt, teach-back, quiz, or transfer. |
| Human/AI tutor interaction | VanLehn (2011), `https://doi.org/10.1080/00461520.2011.611369`; Graesser et al. AutoTutor (2005), `https://doi.org/10.1109/TE.2005.856149` | Tutoring quality depends on feedback, hints, dialogue, and adaptation, not just content accuracy. | Keep turn-level tutor policy: diagnose, hint, repair, check, update state. |
| Retrieval practice | Roediger and Karpicke (2006), `https://doi.org/10.1111/j.1467-9280.2006.01693.x`; Karpicke and Blunt (2011), `https://doi.org/10.1126/science.1199327` | Actively retrieving produces more durable learning than rereading or passive concept mapping. | Reviews and quizzes should ask first, then explain after the attempt. |
| Effective study techniques | Dunlosky et al. (2013), `https://doi.org/10.1177/1529100612453266` | Practice testing and distributed practice are high-utility; rereading and highlighting are weaker. | Prioritize active recall, spacing, and practice over note re-display. |
| Spacing and consolidation | Cepeda et al. (2006), `https://doi.org/10.1037/0033-2909.132.3.354`; Smolen, Zhang, and Byrne (2016), `https://arxiv.org/abs/1606.08370`; DAS3H (2019), `https://arxiv.org/abs/1905.06873` | Memory strengthens through spaced reactivation and skill-aware forgetting control. | Upgrade review scheduling toward FSRS/DAS3H-style due queues. |
| Desirable difficulties | Bjork (1994); Soderstrom and Bjork (2015), `https://doi.org/10.1177/0963721415569000` | Short-term fluency can hide weak long-term learning; useful difficulty improves retention. | Make the learner retrieve, compare, and explain instead of only reading easy answers. |
| Interleaving and varied practice | Kornell and Bjork (2008), `https://doi.org/10.1111/j.1467-9280.2008.02127.x`; Rohrer and Taylor (2007), `https://doi.org/10.1007/s11251-007-9015-8` | Mixed practice improves discrimination and transfer. | Review queues should mix related concepts so learners must choose the method. |
| Self-explanation | Chi et al. (1989), `https://doi.org/10.1207/s15516709cog1302_1`; Chi et al. (1994), `https://doi.org/10.1207/s15516709cog1803_3` | Learners improve when they explain examples and resolve missing links. | Teach-back must score mechanism coverage, not just keyword overlap. |
| ICAP active learning | Chi and Wylie (2014), `https://doi.org/10.1080/00461520.2014.965823` | Constructive and interactive work is usually deeper than passive or merely active behavior. | Ask learners to generate explanations, questions, predictions, and repairs. |
| Learning by teaching | Roscoe and Chi (2007), `https://doi.org/10.3102/0034654307309920`; Palincsar and Brown reciprocal teaching (1984), `https://doi.org/10.1207/s1532690xci0102_1` | Teaching can deepen learning when it requires knowledge-building, not just knowledge-telling. | Student/duck modes should ask for clarification, examples, and corrections. |
| Error correction and hypercorrection | Butterfield and Metcalfe (2001), `https://doi.org/10.1037/0278-7393.27.6.1491`; Metcalfe (2017), `https://doi.org/10.1146/annurev-psych-010416-044022` | Errors, especially confident errors, can become powerful learning moments if corrected. | Detect confident wrong answers and require self-correction before progress credit. |
| Conceptual change | Posner et al. (1982), `https://doi.org/10.1002/sce.3730660207`; Chi, Slotta, and de Leeuw (1994), `https://doi.org/10.1207/s15516709cog1802_3` | Misconceptions often require reorganizing the learner's model, not adding one fact. | Misconception repair should contrast old model vs corrected model and test the boundary. |
| Analogical transfer | Gick and Holyoak (1980), `https://doi.org/10.1016/0010-0285(80)90013-4`; Gick and Holyoak (1983), `https://doi.org/10.1016/0010-0285(83)90002-6`; Gentner (1983), `https://doi.org/10.1207/s15516709cog0702_3` | Transfer improves when learners map relational structure, not surface similarity. | Ask what stays invariant and what changes across source and target cases. |
| Far transfer taxonomy | Barnett and Ceci (2002), `https://doi.org/10.1037/0033-2909.128.4.612`; Bransford and Schwartz (1999), `https://doi.org/10.3102/0091732X024001061` | Transfer varies by context, time, modality, and conceptual distance. | Generate near-transfer and far-transfer tasks separately. |
| Productive failure | Kapur (2008), `https://doi.org/10.1080/07370000802212669`; MathDial includes productive scaffolding patterns, `https://arxiv.org/abs/2305.14536` | Problem-first attempts can prepare learners for deeper instruction when followed by consolidation. | Add "try first" tasks before full explanation on hard concepts. |
| Cognitive load | Sweller (1988), `https://doi.org/10.1016/0364-0213(88)90023-7`; Sweller, van Merrienboer, and Paas (1998), `https://doi.org/10.1023/A:1022193728205` | Working memory limits require chunking, worked examples, and reduced extraneous load. | Keep prompts compact, focus on one misconception, and avoid giant source dumps. |
| Scaffolding and ZPD | Wood, Bruner, and Ross (1976), `https://doi.org/10.1111/j.1469-7610.1976.tb00381.x`; E-Gotsky (2019), `https://arxiv.org/abs/1904.12268` | Learners need help just beyond independent ability, then support should fade. | Choose next action from repair, hint, worked example, independent attempt, or transfer. |
| Feedback and self-regulated learning | Butler and Winne (1995), `https://doi.org/10.3102/00346543065003245`; Hattie and Timperley (2007), `https://doi.org/10.3102/003465430298487` | Feedback should answer where am I going, how am I going, and what next. | Every score should produce a next repair move, not only a grade. |
| Metacognition | Flavell (1979), `https://doi.org/10.1037/0003-066X.34.10.906`; Koriat (1997), `https://doi.org/10.1037/0033-295X.104.2.349`; Nelson and Narens (1990) | Learners need monitoring and control: predict confidence, inspect evidence, choose strategies. | Ask confidence before scoring and store calibration gaps. |
| Expert skill acquisition | Ericsson, Krampe, and Tesch-Romer (1993), `https://doi.org/10.1037/0033-295X.100.3.363` | Skill improves through targeted practice at the edge of current ability with feedback. | Create micro-practice for the weakest subskill instead of generic quizzes only. |
| Knowledge tracing | Deep Knowledge Tracing (2015), `https://arxiv.org/abs/1506.05908`; KT plus LLM review (2024), `https://arxiv.org/abs/2412.09248` | Tutor systems need explicit estimates of learner knowledge over time. | Keep structured learner records; add interpretable BKT-style mastery estimates later. |
| Pedagogical LLM tutoring | LearnLM (2024), `https://arxiv.org/abs/2412.16429`; MathDial (2023), `https://arxiv.org/abs/2305.14536`; DeepTutor (2026), `https://arxiv.org/abs/2604.26962` | LLMs must be trained/evaluated as tutors, not answer machines. | Keep deterministic tutor controller around the local 4B model. |
| Tutor safety | SafeTutors (2026), `https://arxiv.org/abs/2603.17373`; answer leakage robustness (2026), `https://arxiv.org/abs/2604.18660`; KMP-Bench (2026), `https://arxiv.org/abs/2603.02775` | Over-answering, answer leakage, and misconception reinforcement are learning harms. | Add adversarial answer-leakage evals and long-session tutor-quality checks. |
| Student uptake | Rethinking Scaffolding in LLM Tutors (2026), `https://arxiv.org/abs/2606.15766` | Real learners may ignore scaffolding, so tutor quality must track uptake. | Record whether the learner followed the requested attempt, hint, retry, or teach-back. |
| Neuroscience of learning signal | Schultz, Dayan, and Montague (1997), `https://doi.org/10.1126/science.275.5306.1593`; McClelland, McNaughton, and O'Reilly (1995), `https://doi.org/10.1037/0033-295X.102.3.419` | Learning depends on prediction error plus fast/slow memory systems. | Use surprise/conflict as repair signal and space reviews for consolidation. |

## Sans Forgetica And Disfluency Note

Sans Forgetica should remain an optional recall-friction hook, not a core
learning claim. The stronger evidence is for desirable difficulty through
retrieval, spacing, interleaving, and explanation. Later studies reported that
Sans Forgetica itself did not reliably improve memory, so the app should never
market the font as a proven memory booster.

Implementation rule:

- Use the font hook only for short recall/teach-back fields when available.
- Never put long lessons, source text, or accessibility-critical UI in a
  deliberately disfluent font.
- Treat effortful retrieval as the real learning mechanism, not typography.

## Product Translation

The tutor should implement these loops:

1. Feynman loop: plain explanation -> mechanism -> example -> trap -> retry.
2. Error loop: attempt -> detect error -> self-correct -> retest.
3. Retrieval loop: recall -> feedback -> spaced review.
4. Transfer loop: source case -> target case -> invariant/change check.
5. Calibration loop: confidence prediction -> score -> gap reflection.
6. Safety loop: hint-first -> no answer leakage -> learner uptake check.

## Priority Build Implications

1. Add claim-level teach-back extraction beyond keyword scoring.
2. Expand self-correction from faster/slower comparisons to semantic
   contradiction detection.
3. Add interleaved review queues with related concepts.
4. Add confidence sliders before teach-back and quiz scoring.
5. Add generated near-transfer and far-transfer tasks.
6. Add adversarial answer-leakage evals.
7. Add long-session student uptake metrics.
8. Upgrade memory scheduling toward FSRS/DAS3H or interpretable BKT plus
   spacing.
