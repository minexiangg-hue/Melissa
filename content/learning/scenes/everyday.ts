import { scene } from "../authoring";

export const everydayScenes = [
  scene({
    id: "coffee-first-hello",
    title: "The first hello",
    goal: "everyday",
    levels: ["A1", "A2"],
    description: "Turn a shared table into a small conversation.",
    tags: ["coffee", "introductions", "cafe", "friends"],
    focus: "Introduce yourself, give one detail and ask a simple question.",
    reading:
      "Maya is at a small café. She has a book and a cup of tea. The café is busy. Leo asks to sit at her table. Maya says yes. They introduce themselves. Leo lives nearby. Maya asks about his book. A simple question helps them start a conversation.",
    dialogue: [
      ["Leo", "Hi. Is this seat free?"],
      ["Maya", "Yes, it is. I'm Maya."],
      ["Leo", "Nice to meet you. I'm Leo. I live nearby."],
      ["Maya", "Nice to meet you too. What do you like to read?"],
      ["Leo", "I like stories about travel. How about you?"],
      ["Maya", "I like short stories."],
    ],
    phrases: [
      ["nearby", "not far from here", "I work nearby."],
      [
        "Is this seat free?",
        "a polite way to ask whether you can sit down",
        "Excuse me, is this seat free?",
      ],
      [
        "How about you?",
        "a way to ask the other person the same question",
        "I like tea. How about you?",
      ],
    ],
    checks: [
      [
        "Where does Leo live?",
        "Near the café",
        "Above the café",
        "In another country",
        "Leo says that he lives nearby.",
      ],
      [
        "What does Maya ask about?",
        "Leo's reading interests",
        "The cost of tea",
        "The time of a train",
        "Maya asks what Leo likes to read.",
      ],
      [
        "Which phrase returns a question to the other person?",
        "How about you?",
        "Nice to meet you.",
        "I live nearby.",
        "How about you asks the other person for their own answer.",
      ],
    ],
    prompts: [
      [
        "Start a conversation",
        "We are sharing a café table. How would you introduce yourself?",
        "Hi, I'm Alex. Nice to meet you.",
      ],
      [
        "Share one detail",
        "Tell me one thing you enjoy doing.",
        "I like reading short stories.",
      ],
      [
        "Keep it going",
        "I enjoy reading too. What could you ask me?",
        "What kind of stories do you like?",
      ],
    ],
  }),
  scene({
    id: "weekend-switch",
    title: "When plans change",
    goal: "everyday",
    levels: ["B1", "B2"],
    description:
      "Suggest a new plan without losing the warmth of an invitation.",
    tags: ["weekend", "plans", "rain", "friends"],
    focus: "Explain a change, offer an alternative and negotiate a detail.",
    reading:
      "Nora and Sam planned to spend Saturday walking by the river. On Friday, Nora checks the weather and sees that rain is likely. She does not want to cancel their time together, so she suggests visiting a small photography exhibition instead. Sam likes the idea but has a family call at three. They agree to meet at eleven and have lunch afterward. Nora sends a short message confirming the place and time. The activity has changed, but the purpose of the day has not: they still want time to catch up.",
    dialogue: [
      ["Nora", "It looks like rain tomorrow. Shall we change our plan?"],
      ["Sam", "Good idea. What did you have in mind?"],
      ["Nora", "We could see the photography exhibition instead."],
      ["Sam", "That works for me, as long as we finish before three."],
      ["Nora", "How about meeting at eleven?"],
      ["Sam", "Perfect. Let's get lunch afterward."],
    ],
    phrases: [
      [
        "have in mind",
        "be thinking of a particular idea",
        "What place did you have in mind?",
      ],
      [
        "as long as",
        "on the condition that",
        "I can come as long as we leave by two.",
      ],
      [
        "catch up",
        "talk about what has happened recently",
        "Let's catch up over lunch.",
      ],
    ],
    checks: [
      [
        "Why does Nora suggest a different activity?",
        "Rain is likely",
        "Sam dislikes rivers",
        "The exhibition is closing",
        "The weather forecast leads Nora to suggest an indoor activity.",
      ],
      [
        "What limits Sam's available time?",
        "A family call at three",
        "A train at eleven",
        "A work meeting at lunch",
        "Sam needs to be free for his family call.",
      ],
      [
        "What does 'as long as we finish before three' express?",
        "A condition for agreeing",
        "A criticism of the exhibition",
        "An uncertain invitation",
        "Sam accepts the plan with a clear time condition.",
      ],
    ],
    prompts: [
      [
        "Explain the change",
        "Our outdoor plan may not work. How would you explain the problem?",
        "It looks like rain, so we may need an indoor plan.",
      ],
      [
        "Offer an alternative",
        "Suggest another activity and explain why it would suit us.",
        "We could visit the gallery because it is indoors and nearby.",
      ],
      [
        "Agree on a detail",
        "I need to leave by three. How could we make the plan work?",
        "How about meeting at eleven so we have enough time?",
      ],
    ],
  }),
  scene({
    id: "neighbourhood-change",
    title: "A place worth keeping",
    goal: "everyday",
    levels: ["C1", "C2"],
    description:
      "Explore a neighbourhood change with nuance and a clear point of view.",
    tags: ["neighbourhood", "community", "change", "debate"],
    focus:
      "Acknowledge competing needs, qualify a claim and propose a compromise.",
    reading:
      "A disused workshop in a fictional neighbourhood may become either a quiet reading room or a community repair studio. Elena initially favours the reading room: many residents have little space to study at home. Her neighbour Amir points out that a repair studio could help people share practical skills and keep useful objects in circulation. Neither proposal has a budget yet, and both would depend on volunteers. At a meeting, Elena reframes the choice. Perhaps the question is not which idea deserves to exist, but how the space could accommodate different needs at different times. She suggests a small trial, with quiet mornings and supervised repair sessions twice a week. Amir supports the experiment but asks who would manage the transition between activities. The discussion becomes more productive once they replace a permanent either-or decision with a limited proposal that can be evaluated.",
    dialogue: [
      [
        "Elena",
        "I can see the appeal of a repair studio, though noise could exclude people who need to study.",
      ],
      [
        "Amir",
        "That's a fair concern. Equally, a reading room may leave practical needs unmet.",
      ],
      [
        "Elena",
        "Perhaps we're treating this as a choice that has to be permanent.",
      ],
      [
        "Amir",
        "Are you suggesting a trial with different uses at different times?",
      ],
      ["Elena", "Exactly, provided that someone coordinates the changeovers."],
      [
        "Amir",
        "I'd support that in principle. We would still need a workable rota.",
      ],
    ],
    phrases: [
      [
        "in principle",
        "agreeing with an idea before resolving practical details",
        "I support the plan in principle.",
      ],
      [
        "reframe",
        "present a problem from a different angle",
        "We can reframe the question around shared needs.",
      ],
      [
        "provided that",
        "only if a stated condition is met",
        "The trial could work provided that volunteers are available.",
      ],
    ],
    checks: [
      [
        "What changes the direction of the discussion?",
        "A limited trial that can serve both needs",
        "A confirmed construction budget",
        "An agreement to sell the workshop",
        "Elena suggests testing different uses rather than choosing one forever.",
      ],
      [
        "What remains unresolved at the end?",
        "Who will coordinate activities",
        "Whether the workshop exists",
        "Whether residents may read",
        "Amir asks for a practical rota, and Elena also mentions coordination.",
      ],
      [
        "What does Amir's 'in principle' communicate?",
        "Support with practical details still open",
        "Unconditional approval of every detail",
        "Complete rejection of the proposal",
        "He supports the concept while reserving judgement on implementation.",
      ],
    ],
    prompts: [
      [
        "Recognize another view",
        "You prefer a reading room. How would you acknowledge the strongest argument for the repair studio?",
        "The studio could build practical connections, even though quiet study space remains important.",
      ],
      [
        "Qualify your proposal",
        "Suggest a compromise while making its limits clear.",
        "A short trial could be worthwhile, provided that volunteers can manage the changeovers.",
      ],
      [
        "Adapt your register",
        "Explain that compromise to a neighbour in one natural, less formal sentence.",
        "Why don't we try both for a month and see what actually works?",
      ],
    ],
  }),
  scene({
    id: "planet-conversation",
    title: "One small blue planet",
    goal: "everyday",
    levels: ["B1", "B2"],
    description:
      "Share an interesting fact, explain a comparison and invite curiosity.",
    tags: ["planet", "earth", "ocean", "science", "seasons"],
    focus:
      "Turn a fact into an accessible explanation and a natural follow-up.",
    sources: ["nasa-earth"],
    reading:
      "At a small science club, Lin brings a picture she has drawn of Earth. Most of the drawing is blue because ocean covers about 71 percent of the planet's surface. Her friend Jo is surprised: from their inland town, water does not seem to be everywhere. Lin explains that a local view can make a global fact difficult to imagine. They also discuss the seasons. Earth's tilt, rather than simply being closer to the Sun, helps explain why seasons change. Jo decides to draw two versions of the same park in different seasons. A short conversation about a familiar place has given both friends a new way to notice the planet they share.",
    dialogue: [
      [
        "Lin",
        "Did you know that ocean covers about 71 percent of Earth's surface?",
      ],
      ["Jo", "Really? That's hard to imagine from our town."],
      ["Lin", "A globe makes it easier to see how much of the planet is blue."],
      ["Jo", "What about the seasons? Why do they change?"],
      [
        "Lin",
        "Earth's tilt changes the sunlight different places receive during the year.",
      ],
      [
        "Jo",
        "That makes sense. I'd like to draw our park in summer and winter.",
      ],
    ],
    phrases: [
      [
        "surface",
        "the outer part of something",
        "Ocean covers much of Earth's surface.",
      ],
      [
        "tilt",
        "a position that leans away from straight upright",
        "Earth's tilt helps explain the seasons.",
      ],
      [
        "hard to imagine",
        "difficult to picture in your mind",
        "That distance is hard to imagine.",
      ],
    ],
    checks: [
      [
        "Why is most of Lin's drawing blue?",
        "Ocean covers about 71 percent of Earth's surface",
        "Every country uses blue paint",
        "Earth has no land",
        "The amount of blue reflects how much surface is covered by ocean.",
      ],
      [
        "What helps explain Earth's seasons in the reading?",
        "The tilt of Earth",
        "The number of towns",
        "The colour of the ocean",
        "The reading and dialogue identify Earth's tilt as the explanation.",
      ],
      [
        "What does Jo decide to draw?",
        "The same park in different seasons",
        "A map of every ocean",
        "A new train station",
        "Jo wants to compare the familiar park in summer and winter.",
      ],
    ],
    prompts: [
      [
        "Share a fact",
        "Tell me an interesting fact from this material in your own words.",
        "About 71 percent of Earth's surface is covered by ocean.",
      ],
      [
        "Make it clear",
        "Help me picture that fact using an everyday comparison or object.",
        "A globe can show you how much of the planet is blue.",
      ],
      [
        "Invite curiosity",
        "Ask me a follow-up question that keeps the conversation going.",
        "Which change do you notice most between summer and winter?",
      ],
    ],
  }),
];
