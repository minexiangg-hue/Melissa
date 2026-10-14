import { scene } from "../authoring";

export const workScenes = [
  scene({
    id: "work-first-day",
    title: "Your first day",
    goal: "work",
    levels: ["A1", "A2"],
    description: "Introduce your work and arrange a short conversation.",
    tags: ["work", "team", "introductions", "office"],
    focus: "Name your role, explain a task and suggest a meeting time.",
    reading:
      "Kim joins a small design team. On her first morning, she meets Omar. He writes the team's weekly news. Kim works on pictures for a new website. She needs to ask Omar about the words. They agree to talk after lunch. Kim writes the time in her notebook.",
    dialogue: [
      ["Kim", "Hi, I'm Kim. I work on the design team."],
      ["Omar", "Welcome, Kim. I'm Omar. I write our team news."],
      ["Kim", "I'm working on pictures for the new website."],
      ["Omar", "Great. Do you need any help?"],
      ["Kim", "Yes, please. Can we talk after lunch?"],
      ["Omar", "Of course. Let's meet at two."],
    ],
    phrases: [
      [
        "work on",
        "spend time doing a task or project",
        "I work on our website.",
      ],
      [
        "team",
        "a group of people working together",
        "Our team has five people.",
      ],
      [
        "after lunch",
        "at a time later than the midday meal",
        "Let's talk after lunch.",
      ],
    ],
    checks: [
      [
        "Which team does Kim join?",
        "The design team",
        "The travel team",
        "The kitchen team",
        "Kim introduces herself as part of the design team.",
      ],
      [
        "What does Omar write?",
        "The team news",
        "Train tickets",
        "A restaurant menu",
        "Omar says that he writes the team's news.",
      ],
      [
        "When do they agree to meet?",
        "At two",
        "Before breakfast",
        "At midnight",
        "Omar suggests two, after Kim asks to talk after lunch.",
      ],
    ],
    prompts: [
      [
        "Introduce your role",
        "I'm your new teammate. Tell me your name and role.",
        "Hi, I'm Alex. I work on the design team.",
      ],
      [
        "Describe a task",
        "Tell me what you are working on.",
        "I'm working on pictures for our website.",
      ],
      [
        "Arrange a chat",
        "Ask me to meet at a time that suits you.",
        "Can we talk after lunch?",
      ],
    ],
  }),
  scene({
    id: "work-project-update",
    title: "A clear update",
    goal: "work",
    levels: ["B1", "B2"],
    description: "Give a useful project update and make a specific request.",
    tags: ["project", "update", "deadline", "meeting"],
    focus:
      "State progress, explain a blocker and request a concrete next step.",
    sources: ["nara-plain-language"],
    reading:
      "During a fictional team meeting, Priya gives an update on a customer guide. The first draft is ready, but two illustrations still need review. Instead of describing every step she has taken, she begins with the decision the team needs to make. Can a reviewer check the illustrations by Thursday? If so, Priya can prepare the final version on Friday. Her colleague Ben agrees to review them but asks for a short explanation of the intended audience. Priya offers to add that context to the shared document. The exchange ends with a clear owner, a specific action and a date, so everyone understands the next step.",
    dialogue: [
      [
        "Priya",
        "The first draft is ready. I need a review of two illustrations by Thursday.",
      ],
      ["Ben", "I can do that. Who is the guide for?"],
      ["Priya", "New customers who have not used our product before."],
      ["Ben", "Could you add that context to the document?"],
      [
        "Priya",
        "Certainly. If the review is ready on Thursday, I'll finish on Friday.",
      ],
      ["Ben", "Agreed. I'll leave my comments in the document."],
    ],
    phrases: [
      [
        "first draft",
        "an early version that can still change",
        "The first draft is ready for feedback.",
      ],
      [
        "intended audience",
        "the people a piece of communication is meant for",
        "The intended audience is new customers.",
      ],
      [
        "by Thursday",
        "no later than Thursday",
        "Please send your comments by Thursday.",
      ],
    ],
    checks: [
      [
        "What does Priya need next?",
        "A review of two illustrations",
        "A new customer list",
        "A new meeting room",
        "Her update begins with a request to review the illustrations.",
      ],
      [
        "Who is the guide for?",
        "New customers",
        "Only the design team",
        "Experienced reviewers",
        "Priya explains that the guide is for people new to the product.",
      ],
      [
        "What does Ben ask Priya to add?",
        "Context about the intended audience",
        "A second deadline next month",
        "The team's holiday photos",
        "Ben asks her to explain the audience in the document.",
      ],
    ],
    prompts: [
      [
        "Lead with progress",
        "Give me a short update on a project, real or imagined.",
        "The first draft is ready, but two illustrations still need review.",
      ],
      [
        "Make a clear request",
        "Tell me exactly what help you need and by when.",
        "Could you review the illustrations by Thursday?",
      ],
      [
        "Confirm next steps",
        "I can review them on Thursday. What will you do next?",
        "Thanks. I'll prepare the final version on Friday.",
      ],
    ],
  }),
  scene({
    id: "work-proposal",
    title: "Make room for a better idea",
    goal: "work",
    levels: ["C1", "C2"],
    description:
      "Challenge a proposal constructively and turn uncertainty into a useful next step.",
    tags: ["proposal", "negotiation", "strategy", "feedback"],
    focus:
      "Distinguish evidence from assumption and propose a proportionate experiment.",
    sources: ["nara-plain-language"],
    reading:
      "A fictional product team is considering replacing its monthly customer workshop with a recorded tutorial. The proposal promises lower preparation costs, but its effect on customer questions is uncertain. Ellis supports making the information easier to revisit, while doubting that a recording can replace the conversation entirely. In the meeting, she avoids framing the disagreement as resistance to change. She separates the aim, which she shares, from the proposed method, which she wants to test. Her suggestion is a six-week pilot: provide a short recording before the workshop, shorten the live session and use it for questions. The team could then compare attendance, recurring questions and preparation time. Her manager asks what result would justify keeping the hybrid approach. Ellis proposes agreeing those criteria before the pilot begins. The team leaves with a testable question rather than a confident prediction, and with a decision process that both supporters and sceptics can regard as fair.",
    dialogue: [
      [
        "Ellis",
        "I support the aim of reducing preparation time. I'm less convinced that removing the live session is the only way.",
      ],
      ["Manager", "What alternative would let us test that concern?"],
      [
        "Ellis",
        "A short recording followed by a smaller question session could give us useful evidence.",
      ],
      ["Manager", "What would count as a successful pilot?"],
      [
        "Ellis",
        "We should agree that in advance, including both preparation time and unanswered questions.",
      ],
      [
        "Manager",
        "That seems proportionate. Let's write down the criteria before we start.",
      ],
    ],
    phrases: [
      [
        "testable",
        "able to be checked using evidence",
        "Let's turn that assumption into a testable question.",
      ],
      [
        "proportionate",
        "appropriate in size or effort for the problem",
        "A short pilot is a proportionate first step.",
      ],
      [
        "criteria",
        "standards used to judge an outcome",
        "We need clear criteria for the decision.",
      ],
    ],
    checks: [
      [
        "Which part of the proposal does Ellis support?",
        "Reducing preparation time",
        "Removing every live conversation immediately",
        "Increasing workshop length",
        "She shares the aim but questions whether the proposed method is the only option.",
      ],
      [
        "What does she propose before starting the pilot?",
        "Agreeing how success will be judged",
        "Declaring the pilot successful",
        "Cancelling all customer questions",
        "She wants the evaluation criteria to be agreed in advance.",
      ],
      [
        "Why is the pilot useful?",
        "It can produce evidence about competing concerns",
        "It guarantees that all costs disappear",
        "It removes the need to make a decision",
        "The pilot lets the team observe preparation time and customer questions before deciding.",
      ],
    ],
    prompts: [
      [
        "Disagree constructively",
        "You share a proposal's goal but question its method. Express that distinction.",
        "I support the aim, although I'm not yet persuaded that this is the best way to achieve it.",
      ],
      [
        "Propose a test",
        "Suggest a small experiment to investigate your concern.",
        "Could we run a short hybrid pilot and compare the results?",
      ],
      [
        "Define success",
        "How would you make the decision after the experiment fair?",
        "I'd agree the criteria beforehand so we don't judge the results selectively.",
      ],
    ],
  }),
  scene({
    id: "work-short-message",
    title: "The message that helps",
    goal: "work",
    levels: ["A2", "B1"],
    description:
      "Write a friendly message that makes the next action easy to find.",
    tags: ["email", "message", "writing", "request"],
    focus: "Make the request clear, give a short reason and close politely.",
    sources: ["nara-plain-language"],
    reading:
      "Ari needs a colleague to check a short welcome note for new customers. His first message contains a long story about the whole project. He reads it again and realizes that the request is difficult to find. In his new version, he asks for a check by Tuesday in the first sentence. Then he explains that the note will be sent on Wednesday. He attaches the draft and thanks his colleague. The shorter message still sounds friendly, and its next step is much clearer.",
    dialogue: [
      ["Ari", "Could you check this welcome note by Tuesday?"],
      ["Bea", "Of course. Who will receive it?"],
      ["Ari", "New customers. We plan to send it on Wednesday."],
      ["Bea", "Thanks. Where is the draft?"],
      ["Ari", "I've attached it to the message."],
      ["Bea", "Great. I'll send you my comments tomorrow."],
    ],
    phrases: [
      [
        "attach",
        "include a file with a message",
        "Please attach the draft to your email.",
      ],
      [
        "request",
        "something you ask another person to do",
        "Put the main request near the beginning.",
      ],
      [
        "comments",
        "notes that give feedback",
        "Thanks for your helpful comments.",
      ],
    ],
    checks: [
      [
        "What does Ari ask Bea to check?",
        "A welcome note",
        "A train timetable",
        "A lunch menu",
        "The message asks Bea to review a note for new customers.",
      ],
      [
        "When does Ari want the check completed?",
        "By Tuesday",
        "After Wednesday",
        "Next month",
        "His revised message puts the Tuesday deadline in the first sentence.",
      ],
      [
        "Why is the revised message easier to use?",
        "The request is clear near the beginning",
        "It removes every polite word",
        "It includes the whole project history",
        "Ari starts with the request and then gives the short reason.",
      ],
    ],
    prompts: [
      [
        "Ask clearly",
        "Ask a colleague to check a short document.",
        "Could you check this welcome note by Tuesday?",
      ],
      [
        "Give a reason",
        "Explain briefly why that timing would help.",
        "We plan to send it to new customers on Wednesday.",
      ],
      [
        "Close warmly",
        "Finish your request in a friendly way.",
        "I've attached the draft. Thanks for your help.",
      ],
    ],
  }),
];
