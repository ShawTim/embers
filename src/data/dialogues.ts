export interface DialogueLine {
  speaker: string;      // unit def.id, or "narrator"
  speakerName?: { en: string; zh: string };
  text: { en: string; zh: string };
  mood?: "neutral" | "angry" | "sad" | "determined" | "surprised" | "happy";
}

export interface DialogueScript {
  id: string;
  lines: DialogueLine[];
}

// === CH1: Pre-battle ===
export const ch01_pre: DialogueScript = {
  id: "ch01_pre",
  lines: [
    { speaker: "narrator", text: { en: "The realm of Aetheria has known a hundred years of peace under the Ember Throne. But shadows gather at the borders.", zh: "艾特利亞在 Ember 王座之下享有了百年的和平。但暗影正在邊境聚集。" } },
    { speaker: "narrator", text: { en: "In the quiet province of Ashwood, young Lord Kael prepares for bed, unaware that this night will change everything.", zh: "在寧靜的 Ashwood 省，年輕的凱爾領主正準備就寢，渾然不知今夜將改變一切。" } },
    { speaker: "kael", text: { en: "Lyra! Borin! To arms — the estate is under attack!", zh: "萊拉！波林！拿起武器——莊園被襲擊了！" }, mood: "surprised" },
    { speaker: "borin", text: { en: "Bandits. A dozen at least. They dare strike at House Ashwood?", zh: "強盜。至少十幾個。他們竟敢襲擊 Ashwood 家族？" }, mood: "angry" },
    { speaker: "lyra", text: { en: "My lord, the villagers are still in the manor. We must not let the enemy past us.", zh: "領主大人，村民們還在宅邸裡。我們不能讓敵人越過防線。" }, mood: "determined" },
    { speaker: "kael", text: { en: "Then we hold the line. For Aetheria! For the Embers!", zh: "那我們就守住防線。為了艾特利亞！為了餘燼！" }, mood: "determined" },
    { speaker: "boss_garrick", text: { en: "Heh. A boy-lord playing soldier. Kill them all — leave nothing standing!", zh: "呵。一個扮士兵的小鬼領主。殺光他們——一個不留！" }, mood: "angry" },
  ],
};

// === CH1: Boss death ===
export const ch01_boss_death: DialogueScript = {
  id: "ch01_boss_death",
  lines: [
    { speaker: "boss_garrick", text: { en: "Gah... you... think this changes anything? The shadow... comes for you all...", zh: "呃啊……你以為……這能改變什麼？暗影……會來找你們所有人的……" }, mood: "sad" },
    { speaker: "kael", text: { en: "What shadow? What did he mean?", zh: "什麼暗影？他是什麼意思？" }, mood: "surprised" },
    { speaker: "lyra", text: { en: "Look — this mark on his wrist. I've seen it in the old texts. It is the sigil of the Endless Night.", zh: "看——他手腕上的印記。我在古籍中見過。這是永夜之印。" }, mood: "surprised" },
    { speaker: "borin", text: { en: "The Endless Night? That's a children's tale. A story to frighten the young.", zh: "永夜？那是哄小孩的故事罷了。" }, mood: "neutral" },
    { speaker: "kael", text: { en: "Perhaps not. The bandits fled into the Whispering Forest. We must follow.", zh: "也許不是。強盜們逃進了低語之森。我們必須追擊。" }, mood: "determined" },
  ],
};

// === CH1: Victory ===
export const ch01_victory: DialogueScript = {
  id: "ch01_victory",
  lines: [
    { speaker: "kael", text: { en: "The estate is safe. But I fear this is only the beginning.", zh: "莊園安全了。但我恐怕這只是個開始。" }, mood: "neutral" },
    { speaker: "serra", text: { en: "My lord! I caught one of the stragglers. He spoke of a gathering — a cult massing in the deep forest.", zh: "領主大人！我抓到了一個落單的強盜。他說有一個聚會——一個邪教在森林深處集結。" }, mood: "surprised" },
    { speaker: "kael", text: { en: "Then we ride at dawn. Serra, you will come with us. Your eyes will serve us well among the trees.", zh: "那我們黎明出發。瑟拉，你跟我們一起。你的眼力在樹林中會派上用場。" }, mood: "determined" },
  ],
};

// === CH2: Pre-battle ===
export const ch02_pre: DialogueScript = {
  id: "ch02_pre",
  lines: [
    { speaker: "narrator", text: { en: "The Whispering Forest. Ancient trees older than Aetheria itself, their roots drinking from deep waters that remember the world before the Ember.", zh: "低語之森。比艾特利亞還古老的巨木，其根系飲著記得餘燼之前世界的深水。" } },
    { speaker: "serra", text: { en: "The forest is quiet. Too quiet. The birds have fled.", zh: "森林太安靜了。太安靜了。鳥都飛走了。" }, mood: "neutral" },
    { speaker: "borin", text: { en: "I don't like this. The trees here are old. They remember things.", zh: "我不喜歡這裡。這些樹很老。它們記得一些事情。" }, mood: "sad" },
    { speaker: "lyra", text: { en: "I can feel it too. A corruption in the earth. The Ember light grows dim here.", zh: "我也感覺到了。大地上有腐化。餘燼之光在這裡變得黯淡。" }, mood: "sad" },
    { speaker: "kael", text: { en: "Stay alert. Whatever we face, we face together.", zh: "保持警覺。無論面對什麼，我們一起面對。" }, mood: "determined" },
    { speaker: "umbral_mage", text: { en: "The children of Ember walk into our embrace. The Night takes all.", zh: "餘燼之子走進了我們的懷抱。永夜吞噬一切。" }, mood: "angry" },
  ],
};

// === CH2: Boss death ===
export const ch02_boss_death: DialogueScript = {
  id: "ch02_boss_death",
  lines: [
    { speaker: "boss_garrick", text: { en: "The Lord of Endless Night... will not be stopped... by the likes... of you...", zh: "永夜之主……不會被……你們這種人……阻止……" }, mood: "sad" },
    { speaker: "lyra", text: { en: "There — deeper in the forest. Do you see it? A structure. Ancient.", zh: "那裡——森林更深處。你們看到了嗎？一座建築。很古老。" }, mood: "surprised" },
    { speaker: "kael", text: { en: "A shrine. Or what remains of one. The corruption is strongest there.", zh: "一座神殿。或者說是其殘骸。腐化在那裡最強。" }, mood: "neutral" },
    { speaker: "borin", text: { en: "Whatever they're planning, we put a stop to it. Now.", zh: "不管他們在計劃什麼，我們現在就去阻止。" }, mood: "determined" },
  ],
};

// === CH2: Victory ===
export const ch02_victory: DialogueScript = {
  id: "ch02_victory",
  lines: [
    { speaker: "kael", text: { en: "The forest breathes again. Whatever dark hold gripped it has lifted.", zh: "森林又呼吸了。無論什麼黑暗束縛了它，都已經消散了。" }, mood: "neutral" },
    { speaker: "lyra", text: { en: "But the source lies deeper still. I feel it calling. The Shrine of Embers... it has been corrupted.", zh: "但根源更深。我感覺到它在呼喚。餘燼神殿……已經被腐化了。" }, mood: "sad" },
    { speaker: "kael", text: { en: "Then we press on. The shrine is three days east. We rest, and then we march.", zh: "那我們繼續前進。神殿在東方三天路程。我們休息，然後行軍。" }, mood: "determined" },
  ],
};

// === Helper: get dialogue by id ===
export const DIALOGUES: Record<string, DialogueScript> = {
  ch01_pre, ch01_boss_death, ch01_victory,
  ch02_pre, ch02_boss_death, ch02_victory,
};

export function getDialogue(id: string): DialogueScript | null {
  return DIALOGUES[id] || null;
}

// === Map chapter + trigger to dialogue id ===
export function getDialogueForTrigger(chapterId: string, trigger: "pre" | "boss_death" | "victory"): string | null {
  const id = `${chapterId}_${trigger}`;
  return DIALOGUES[id] ? id : null;
}
