import { scene } from "../authoring";

export const travelScenes = [
  scene({
    id: "station-next-stop",
    title: "The right platform",
    goal: "travel",
    levels: ["A1", "A2"],
    description: "Ask for help and check one important travel detail.",
    tags: ["station", "train", "directions", "transport"],
    focus: "Ask for a place, repeat a detail and check the destination.",
    reading:
      "Ada is at a fictional station. She wants to go to Westbridge. She asks a member of staff for help. The train is on platform four. Ada repeats the number to check it. The staff member points to the stairs. Ada thanks him and walks to the platform.",
    dialogue: [
      ["Ada", "Excuse me. Which platform is the train to Westbridge on?"],
      ["Staff", "Platform four. The stairs are on your left."],
      ["Ada", "Platform four, is that right?"],
      ["Staff", "Yes. Go up the stairs and turn right."],
      ["Ada", "Thank you. Does this train stop at Westbridge?"],
      ["Staff", "Yes, it does."],
    ],
    phrases: [
      [
        "platform",
        "the place where you get on a train",
        "The train leaves from platform four.",
      ],
      [
        "on your left",
        "on the left side of where you are facing",
        "The stairs are on your left.",
      ],
      [
        "Is that right?",
        "a question used to check information",
        "The next stop is Westbridge. Is that right?",
      ],
    ],
    checks: [
      [
        "Which platform does Ada need?",
        "Four",
        "Two",
        "Six",
        "The staff member says platform four.",
      ],
      [
        "Where are the stairs?",
        "On Ada's left",
        "Behind the ticket office",
        "On platform one",
        "The staff member tells Ada that the stairs are on her left.",
      ],
      [
        "Why does Ada repeat the platform number?",
        "To check she understood",
        "To buy a second ticket",
        "To change the destination",
        "Repeating an important detail is a simple way to confirm it.",
      ],
    ],
    prompts: [
      [
        "Ask for help",
        "I work at a station. Ask me where to find your train.",
        "Excuse me, which platform is the train to Westbridge on?",
      ],
      [
        "Check the detail",
        "I say platform four. How would you check the number?",
        "Platform four, is that right?",
      ],
      [
        "Confirm the destination",
        "Before you get on, ask whether this train goes to your destination.",
        "Does this train stop at Westbridge?",
      ],
    ],
  }),
  scene({
    id: "travel-fallback",
    title: "A different way there",
    goal: "travel",
    levels: ["B1", "B2"],
    description:
      "Compare travel options and ask for the detail that matters to you.",
    tags: ["travel", "journey", "delay", "alternatives"],
    focus: "Explain a constraint, compare options and confirm a decision.",
    reading:
      "In a fictional coastal town, Jules discovers that the morning ferry has been cancelled. She wants to meet a friend across the bay before lunch. A station assistant suggests a direct bus or a train followed by a short walk. The bus is simpler, but the road may be busy. The train involves a change, yet its arrival time leaves more room for delay. Jules is carrying a light bag, so walking is not a problem. She chooses the train and asks the assistant to write down the change of station. Before leaving, she messages her friend with the new plan.",
    dialogue: [
      ["Jules", "My ferry was cancelled. Is there another way across the bay?"],
      [
        "Assistant",
        "You could take a direct bus or change trains at Hillford.",
      ],
      [
        "Jules",
        "I'd rather avoid traffic. How far is the walk from the station?",
      ],
      ["Assistant", "It's a short walk in this example."],
      [
        "Jules",
        "That should be fine. Could you write down where I need to change?",
      ],
      ["Assistant", "Of course. Change at Hillford."],
    ],
    phrases: [
      [
        "I'd rather",
        "a natural way to express a preference",
        "I'd rather take the train.",
      ],
      [
        "leave room for",
        "allow extra time or space for something",
        "Let's leave room for a delay.",
      ],
      [
        "change trains",
        "leave one train and take another",
        "We need to change trains at Hillford.",
      ],
    ],
    checks: [
      [
        "Why does Jules need a new plan?",
        "Her ferry was cancelled",
        "She forgot her bag",
        "Her friend moved away",
        "The cancelled ferry prevents her from using the original route.",
      ],
      [
        "Why does she prefer the train?",
        "She wants to avoid possible road traffic",
        "She has a very heavy bag",
        "The bus goes to another country",
        "Jules explicitly says she would rather avoid traffic.",
      ],
      [
        "What does she ask the assistant to write down?",
        "Where to change trains",
        "Her friend's phone number",
        "A restaurant review",
        "She wants a written reminder of the station where she must change.",
      ],
    ],
    prompts: [
      [
        "Explain a problem",
        "Your original journey is no longer possible. Explain what happened.",
        "My ferry was cancelled, and I need another way across the bay.",
      ],
      [
        "Compare options",
        "You can take a direct bus or change trains. Explain your preference.",
        "I'd rather take the train because the roads may be busy.",
      ],
      [
        "Check the next step",
        "Ask me for one practical detail before you leave.",
        "Could you write down where I need to change?",
      ],
    ],
  }),
  scene({
    id: "travel-fair-visit",
    title: "A thoughtful visitor",
    goal: "travel",
    levels: ["C1", "C2"],
    description:
      "Balance a memorable trip with consideration for a place and its residents.",
    tags: ["tourism", "residents", "responsible travel", "debate"],
    focus:
      "Separate intentions from effects and negotiate a considerate alternative.",
    reading:
      "Two friends are planning a photography walk through a fictional village. One is drawn to a narrow street that appears frequently in travel posts; the other worries that a large group would make an ordinary residential space uncomfortable. Neither thinks visitors should avoid the village altogether. The disagreement concerns how a visit is organized. They decide to ask their local guide for a less intrusive route and to keep the group small. They also agree that permission to take a photograph should never be assumed simply because a place is visible from a public path. The guide proposes a workshop courtyard whose owner welcomes visitors at an agreed time. The friends realize that changing the route need not make the visit less interesting. It may produce a more meaningful conversation than reproducing a familiar photograph. Their final plan remains flexible, because a considerate intention is only useful if they pay attention to the people they actually meet.",
    dialogue: [
      [
        "Rae",
        "I understand why that street is popular, but arriving as a large group could be intrusive.",
      ],
      [
        "Milan",
        "Would a smaller group address the concern, or is the location itself the problem?",
      ],
      [
        "Rae",
        "It depends on what residents are comfortable with. I'd rather ask than assume.",
      ],
      [
        "Milan",
        "We could ask the guide for an alternative with a similar atmosphere.",
      ],
      [
        "Rae",
        "Yes. A change of route might make the visit more interesting, not less.",
      ],
      [
        "Milan",
        "Then let's treat the photo as a possibility rather than the purpose of the trip.",
      ],
    ],
    phrases: [
      [
        "intrusive",
        "unwelcome because it interrupts someone's space or privacy",
        "The questions felt intrusive.",
      ],
      [
        "address a concern",
        "take action that responds to a particular worry",
        "A smaller group may address that concern.",
      ],
      [
        "take for granted",
        "assume something without checking or appreciating it",
        "We should not take a warm welcome for granted.",
      ],
    ],
    checks: [
      [
        "What is the main disagreement about?",
        "How to organize the visit considerately",
        "Whether the village exists",
        "Which camera brand to buy",
        "Both friends want to visit; they differ over the route and group size.",
      ],
      [
        "What alternative does the guide suggest?",
        "A courtyard visit agreed with its owner",
        "A larger group on the same street",
        "Cancelling every future trip",
        "The courtyard owner welcomes visitors at an agreed time.",
      ],
      [
        "What does Rae prefer to assuming residents' wishes?",
        "Asking what they are comfortable with",
        "Copying the most popular travel post",
        "Taking the photo quickly",
        "Rae explicitly says she would rather ask than assume.",
      ],
    ],
    prompts: [
      [
        "Qualify your concern",
        "Explain a concern about the proposed visit without blaming the other traveller.",
        "I can see the attraction, though a large group could interrupt residents' routines.",
      ],
      [
        "Negotiate an alternative",
        "Suggest an alternative that preserves what your friend values.",
        "Could the guide suggest a quieter place with the same character?",
      ],
      [
        "Express a principle",
        "What would make the visit meaningful to you? Give a nuanced answer.",
        "I'd value a welcome conversation more than a photograph, while remaining open to both.",
      ],
    ],
  }),
  scene({
    id: "park-visit",
    title: "Ask a ranger",
    goal: "travel",
    levels: ["A2", "B1"],
    description: "Plan a park visit and check unfamiliar guidance politely.",
    tags: ["park", "wildlife", "nature", "ranger"],
    focus: "Ask for local guidance and check what a rule means.",
    sources: ["nps-wildlife"],
    reading:
      "Tess wants to watch wildlife during a park visit. Before leaving the visitor centre, she asks a ranger about the local guidance. The ranger explains that different parks have different rules, so Tess should check the instructions for this park. She brings binoculars to watch from a distance. After lunch, she closes the food container and puts her rubbish in the correct bin. She enjoys the afternoon without approaching the animals. This fictional scene uses general information from the National Park Service, not directions for a particular park.",
    dialogue: [
      ["Tess", "I'd like to watch wildlife. What should I check before I go?"],
      [
        "Ranger",
        "Please read this park's guidance. The rules can differ between parks.",
      ],
      ["Tess", "Can I use binoculars to watch from a distance?"],
      ["Ranger", "Yes. Give the animals plenty of space."],
      ["Tess", "Where should I put my food after lunch?"],
      [
        "Ranger",
        "Use the suitable closed containers described in the park guidance.",
      ],
    ],
    phrases: [
      [
        "wildlife",
        "animals living in their natural surroundings",
        "We hope to see wildlife from the trail.",
      ],
      [
        "from a distance",
        "without getting close",
        "We watched the birds from a distance.",
      ],
      [
        "guidance",
        "information that helps you decide what to do",
        "Check the park's guidance before you leave.",
      ],
    ],
    checks: [
      [
        "Why does Tess ask about this particular park?",
        "Rules can differ between parks",
        "Every park has the same rules",
        "She wants to feed the animals",
        "The ranger explains that local rules need to be checked.",
      ],
      [
        "What does Tess use to see animals from far away?",
        "Binoculars",
        "A food container",
        "A train ticket",
        "Binoculars help Tess watch without approaching the animals.",
      ],
      [
        "What does Tess do after lunch?",
        "Closes her food container and disposes of rubbish properly",
        "Leaves food beside the trail",
        "Offers lunch to the animals",
        "The reading describes storing food and using the correct bin.",
      ],
    ],
    prompts: [
      [
        "Ask before you go",
        "I am a park ranger. Ask what you should check before your walk.",
        "What guidance should I read before I go?",
      ],
      [
        "Check a meaning",
        "I mention watching from a distance. Ask me to explain.",
        "Could you explain what that means for this park?",
      ],
      [
        "Explain your plan",
        "Tell me how you plan to enjoy the visit.",
        "I'll use binoculars and follow this park's guidance.",
      ],
    ],
  }),
];
