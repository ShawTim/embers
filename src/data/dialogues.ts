export interface DialogueLine {
  speaker: string;      // unit def.id, or "narrator"
  speakerName?: { en: string; zh: string };
  text: { en: string; zh: string };
  mood?: "neutral" | "angry" | "sad" | "determined" | "surprised" | "happy" | "worried" | "desperate" | "urgent" | "terrified";
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
    { speaker: "narrator", text: { en: "In the border province of Ashwood, the Black Knight stands watch. He has guarded these lands for years. Tonight, the watch ends.", zh: "在邊境省份 Ashwood，黑騎士佇立守夜。他守護這片土地已有多年。今夜，守望終結。" } },
    { speaker: "kael", text: { en: "Lyra! Borin! To arms — the estate is under attack!", zh: "萊拉！波林！拿起武器——莊園被襲擊了！" }, mood: "surprised" },
    { speaker: "borin", text: { en: "Bandits. A dozen at least. They dare strike at House Ashwood?", zh: "強盜。至少十幾個。他們竟敢襲擊 Ashwood 家族？" }, mood: "angry" },
    { speaker: "lyra", text: { en: "My lord, the villagers are still in the manor. We must not let the enemy past us.", zh: "領主大人，村民們還在宅邸裡。我們不能讓敵人越過防線。" }, mood: "determined" },
    { speaker: "kael", text: { en: "Then we hold the line. For Aetheria! For the Embers!", zh: "那我們就守住防線。為了艾特利亞！為了餘燼！" }, mood: "determined" },
    { speaker: "boss_garrick", text: { en: "Heh. The Black Knight of Ashwood. I expected more from the legend.", zh: "呵。Ashwood 的黑騎士。我對傳說期待更高。" }, mood: "angry" },
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
    { speaker: "cult_captain", text: { en: "The Lord of Endless Night... will not be stopped... by the likes... of you...", zh: "永夜之主……不會被……你們這種人……阻止……" }, mood: "sad" },
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

// === CH3: The Forsaken Shrine ===
export const ch03_pre: DialogueScript = {
  id: "ch03_pre",
  lines: [
    { speaker: "narrator", text: { en: "The Shrine of Embers. A secondary flame-site that once bolstered the Throne's power. Now it is dark.", zh: "餘燼神殿。曾經支撐王座力量的副火源。現在它已黯淡。" } },
    { speaker: "kael", text: { en: "It looks like a warzone. What happened here?", zh: "這裡看起來像戰場。這裡發生了什麼？" }, mood: "neutral" },
    { speaker: "maren", text: { en: "I'm Maren, scholar of the Arcane Academy. I was investigating the cult's activity when I found this place. I can help you understand what you're facing.", zh: "我是 Maren，奧術學院的研究者。我正在調查邪教活動時發現了這地方。我可以幫你了解你面對的敵人。" }, mood: "determined" },
    { speaker: "lyra", text: { en: "Maren! Thank the Embers you're safe. The corruption here... it's strong. I can feel it in the air.", zh: "Maren！感謝餘燼你還安全。這裡的腐化……很強烈。我能在空氣中感覺到。" }, mood: "sad" },
    { speaker: "maren", text: { en: "The cult's leader Acolyte Veyne is here. He is the one who corrupted the flame. He must be stopped.", zh: "邪教領袖信徒 Veyne 在這裡。就是他腐化了火焰。必須阻止他。" }, mood: "determined" },
    { speaker: "kael", text: { en: "Then we end this. For the Embers.", zh: "那我們終結這一切。為了餘燼。" }, mood: "determined" },
    { speaker: "acolyte_veyne", text: { en: "Hmph. You think you can stop what has already begun? The Lord of Endless Night will rise, and the flame will be his first sacrifice.", zh: "哼。你以為你能阻止已經開始的事嗎？永夜之主將會崛起，而火焰將會是他的第一個祭品。" }, mood: "angry" },
  ],
};

export const ch03_boss_death: DialogueScript = {
  id: "ch03_boss_death",
  lines: [
    { speaker: "acolyte_veyne", text: { en: "Impossible! The flame is not yet ready to fall! The Lord warned us it was too early...", zh: "不可能！火焰還未準備好倒下！永夜之主警告過我們這太早了……" }, mood: "sad" },
    { speaker: "lyra", text: { en: "The flame is weakening, but the Shrine's corruption is lifted. It can be restored.", zh: "火焰正在衰弱，但神殿的腐化已經被解除了。它可以恢復。" }, mood: "determined" },
    { speaker: "maren", text: { en: "Veyne spoke of the 'Lord of Endless Night'. If such a being exists, this is bigger than I feared.", zh: "Veyne 提到了'永夜之主'。如果這樣的存在存在，這比我擔心的還要嚴重。" }, mood: "surprised" },
    { speaker: "kael", text: { en: "Then we find the Lord of Night. Before it's too late.", zh: "那我們要找到永夜之主。在為時已晚之前。" }, mood: "determined" },
  ],
};

export const ch03_victory: DialogueScript = {
  id: "ch03_victory",
  lines: [
    { speaker: "lyra", text: { en: "The Shrine's flame stirs. The Ember's light grows stronger.", zh: "神殿的火焰在攪動。餘燼之光變得更強了。" }, mood: "neutral" },
    { speaker: "maren", text: { en: "Kael, Lyra — I have studied the old texts. The Endless Night is real. And the cult is only the beginning.", zh: "凱爾，萊拉——我研究過古籍。永夜是真的。邪教只是開始。" }, mood: "sad" },
    { speaker: "kael", text: { en: "Then we face more than bandits. But we face it together. On to Valdris.", zh: "那我們面對的不只是強盜。但我們一起面對。向 Valdris 出發。" }, mood: "determined" },
    { speaker: "serra", text: { en: "The forest clears ahead. I can see the spires of Valdris on the horizon.", zh: "前方森林清晰了。我能看到地平線上 Valdris 的尖塔。" }, mood: "neutral" },
  ],
};

// === CH4: Crossroads of Fate ===
export const ch04_pre: DialogueScript = {
  id: "ch04_pre",
  lines: [
    { speaker: "narrator", text: { en: "The crossroads where the eastern road meets the western. Refugees flee south.", zh: "東路與西路相交的十字路口。難民向南逃難。" } },
    { speaker: "kael", text: { en: "We need to hold this ground. The people need time to escape.", zh: "我們要守住這片土地。人們需要時間逃離。" }, mood: "determined" },
    { speaker: "borin", text: { en: "Cultists. Coming from the east. A lot of them.", zh: "邪教徒。從東方來。很多。" }, mood: "angry" },
    { speaker: "lyra", text: { en: "Then we make our stand here. Kael — stay close to the villagers.", zh: "那我們就在這裡堅守。凱爾——靠近村民。" }, mood: "determined" },
    { speaker: "kael", text: { en: "For Aetheria. Hold the line.", zh: "為了艾特利亞。守住防線。" }, mood: "determined" },
  ],
};

export const ch04_victory: DialogueScript = {
  id: "ch04_victory",
  lines: [
    { speaker: "narrator", text: { en: "The refugees reach safety. The sun sets on the field of battle.", zh: "難民抵達安全地。夕陽在戰場上落下。" } },
    { speaker: "lyra", text: { en: "They're safe. And we are stronger for standing together.", zh: "他們安全了。而我們因為一起堅守而更強大了。" }, mood: "happy" },
    { speaker: "maren", text: { en: "I saw a figure watching us from the ridge. A hooded man. He did not attack, but he did not help either.", zh: "我看到一個人從山脊上觀察我們。一個蒙面人。他沒有攻擊，但也沒有幫忙。" }, mood: "surprised" },
    { speaker: "kael", text: { en: "Then we have more allies to find — or more enemies to watch. Onward.", zh: "那我們需要找更多盟友——或更多需要警惕的敵人。繼續前進。" }, mood: "neutral" },
  ],
};

// === CH5: Gates of Valdris ===
export const ch05_pre: DialogueScript = {
  id: "ch05_pre",
  lines: [
    { speaker: "narrator", text: { en: "Valdris. The capital of Aetheria. Its gates have been besieged by the cult.", zh: "Valdris。艾特利亞的首都。它的大門已被邪教圍困。" } },
    { speaker: "serra", text: { en: "The walls are tall. The gate is strong. But the banners... they bear the Umbral sigil. They've infiltrated the guards.", zh: "城牆高聳。城門堅固。但旗幟……它們帶著永夜之印。他們已經滲透了守衛。" }, mood: "worried" },
    { speaker: "kael", text: { en: "Then we fight our way in. We must reach the Council.", zh: "那我們殺出一條路進去。我們必須到達議會。" }, mood: "determined" },
    { speaker: "borin", text: { en: "I know these walls. There is a postern gate — a service entrance, east side. We may find allies inside who still hold true.", zh: "我認識這些城牆。有一個邊門——服務入口，東邊。我們可能在裡面找到仍堅持的盟友。" }, mood: "neutral" },
    { speaker: "lyra", text: { en: "Borin, I did not know you were a city guard once.", zh: "波林，我不知道你曾經是城市守衛。" }, mood: "surprised" },
    { speaker: "borin", text: { en: "A long time ago. Before Kael's father. Before the peace. Another life.", zh: "很久以前。在凱爾的父親之前。在和平之前。另一段人生。" }, mood: "sad" },
  ],
};

export const ch05_victory: DialogueScript = {
  id: "ch05_victory",
  lines: [
    { speaker: "kael", text: { en: "We're inside. But something feels wrong. The city is too quiet.", zh: "我們進去了。但有什麼不對勁。城市太安靜了。" }, mood: "neutral" },
    { speaker: "lyra", text: { en: "The Ember Throne is in the center. The Council is gathered. We must reach them.", zh: "餘燼王座在中央。議會在集會。我們必須到達那裡。" }, mood: "determined" },
  ],
};

// === ACT II — Ch6-10 ===
export const ch06_pre: DialogueScript = {
  id: "ch06_pre",
  lines: [
    { speaker: "narrator", text: { en: "The streets of Valdris. The capital is divided — cult patrols on some corners, loyal guards on others.", zh: "Valdris 的街道。首都分裂了——某些街角有邪教巡邏，另一些有忠誠的守衛。" } },
    { speaker: "darius", text: { en: "Hold. I'm Darius, former guard. I've been watching the cult from inside.", zh: "停。我是 Darius，前守衛。我一直從內部監視邪教。" }, mood: "neutral" },
    { speaker: "kael", text: { en: "Why reveal yourself now? We could be cultist spies.", zh: "為什麼現在才現身？我們可能是邪教間諜。" }, mood: "neutral" },
    { speaker: "darius", text: { en: "I saw you fight at the gate. Real soldiers, not the cult's puppets. I know who I can trust.", zh: "我看到你們在城門戰鬥。真正的士兵，不是邪教的傀儡。我知道我信任誰。" }, mood: "determined" },
    { speaker: "borin", text: { en: "Darius. We served together once. I remember you.", zh: "Darius。我們曾經一起服役。我記得你。" }, mood: "surprised" },
    { speaker: "darius", text: { en: "Borin! A face from the old days. Then I know you are who you say. The cult is meeting resistance from the inside — Council members, soldiers, even some of the Ember Keepers. We must reach them.", zh: "Borin！舊日的一張臉。那我知道你如你所說。邪教從內部受到抵抗——議員、士兵，甚至一些餘燼守衛者。我們必須聯繫他們。" }, mood: "determined" },
    { speaker: "kael", text: { en: "Then we have allies in the city. Lead us, Darius.", zh: "那我們在城裡有盟友。帶路，Darius。" }, mood: "determined" },
  ],
};

export const ch06_victory: DialogueScript = {
  id: "ch06_victory",
  lines: [
    { speaker: "darius", text: { en: "The patrol is cleared. The cult will know we're in the city now — we must move fast.", zh: "巡邏被清除了。邪教現在會知道我們進城了——我們必須加快速度。" }, mood: "neutral" },
    { speaker: "lyra", text: { en: "The Ember Keepers are gathering at the old chapel. A handful remain who still hold true.", zh: "餘燼守衛者正在老教堂集合。少數仍堅持的人。" }, mood: "determined" },
  ],
};

export const ch07_pre: DialogueScript = {
  id: "ch07_pre",
  lines: [
    { speaker: "darius", text: { en: "The undercity. The sewers. The cult uses them to move unseen.", zh: "地下城。下水道。邪教用它們暗中行動。" }, mood: "neutral" },
    { speaker: "kael", text: { en: "Lead the way. If they are siphoning power from the Throne, we will find where.", zh: "帶路。如果他們從王座抽取力量，我們會找到地方。" }, mood: "determined" },
    { speaker: "lyra", text: { en: "I can feel it. The corruption runs like a river beneath the streets. Acolyte Veyne is here, again.", zh: "我能感覺到。腐化像河流一樣在街道下流淌。信徒 Veyne 又在這裡。" }, mood: "sad" },
  ],
};

export const ch07_victory: DialogueScript = {
  id: "ch07_victory",
  lines: [
    { speaker: "lyra", text: { en: "The siphon is broken. I can feel the Throne's light growing stronger again.", zh: "抽取已經被破壞了。我能感覺到王座之光再次變強。" }, mood: "neutral" },
    { speaker: "darius", text: { en: "One less way for the cult to drain Aetheria's light. But they have other plans — I heard them speak of a meeting at the Arena.", zh: "邪教少了一條抽取艾特利亞之光的途徑。但他們有其他計劃——我聽到他們提到在競技場的會議。" }, mood: "neutral" },
  ],
};

export const ch08_pre: DialogueScript = {
  id: "ch08_pre",
  lines: [
    { speaker: "narrator", text: { en: "The Arena of Kings. Once a place of games, now a battlefield. The Council is gathered to debate — the cult intends to silence them.", zh: "王者競技場。曾經是比賽之地，現在是戰場。議會在集會辯論——邪教意圖要他們沉默。" } },
    { speaker: "darius", text: { en: "The Council is divided. Some know the truth, some have been turned. We must protect those who would resist — and root out the traitors.", zh: "議會分裂了。一些人知道真相，一些人被收買了。我們必須保護那些會抵抗的人——並剷除叛徒。" }, mood: "determined" },
    { speaker: "lyra", text: { en: "If the Council falls, Aetheria falls. Hold this place with everything you have.", zh: "如果議會倒下，艾特利亞也會倒下。用你們所有的一切守住這裡。" }, mood: "determined" },
  ],
};

export const ch08_victory: DialogueScript = {
  id: "ch08_victory",
  lines: [
    { speaker: "darius", text: { en: "The Council survived. The traitors are exposed. But the cult captain escaped. He'll report to someone above him.", zh: "議會存活了。叛徒被揭露了。但邪教上尉逃走了。他會向他上面的人報告。" }, mood: "neutral" },
    { speaker: "kael", text: { en: "Someone above. Acolyte Veyne? Or higher still?", zh: "上面的人。信徒 Veyne？還是更高？" }, mood: "neutral" },
    { speaker: "lyra", text: { en: "I fear the cult has a name they speak only in whispers. Malachar. A former Guardian of the Ember Throne itself.", zh: "我擔心邪教有一個他們只會低聲提到的名字。Malachar。餘燼王座的前守衛。" }, mood: "sad" },
  ],
};

export const ch09_pre: DialogueScript = {
  id: "ch09_pre",
  lines: [
    { speaker: "narrator", text: { en: "Dawn. The City Guard turns on the party. The traitor is revealed.", zh: "黎明。城市守衛倒戈攻擊隊伍。叛徒被揭露了。" } },
    { speaker: "darius", text: { en: "No. Not Aldric. He was my mentor. He was the best of us.", zh: "不。不是 Aldric。他是我的導師。他曾是我們之中最好的人。" }, mood: "sad" },
    { speaker: "aldric", text: { en: "I am sorry, Darius. The Lord of Endless Night offers salvation from the dying god. The Ember Throne is a lie. I do this for all of you.", zh: "對不起，Darius。永夜之主提供從垂死之神解救出來的救贖。餘燼王座是個謊言。我為你們所有人做這件事。" }, mood: "determined" },
    { speaker: "kael", text: { en: "The Black Knight of Ashwood doesn't fall easily. You of all people should know that.", zh: "Ashwood 的黑騎士不會輕易倒下。你比任何人都應該清楚這一點。" }, mood: "determined" },
  ],
};

export const ch09_victory: DialogueScript = {
  id: "ch09_victory",
  lines: [
    { speaker: "darius", text: { en: "It is done. Aldric was a good man, once. The cult took that from him.", zh: "結束了。Aldric 曾經是個好人。邪教從他那裡奪走了那個。" }, mood: "sad" },
    { speaker: "kael", text: { en: "We cannot undo what was done. We can only move forward.", zh: "我們無法撤銷已做的事。我們只能向前走。" }, mood: "neutral" },
  ],
};

export const ch10_pre: DialogueScript = {
  id: "ch10_pre",
  lines: [
    { speaker: "narrator", text: { en: "The cult launches a full assault. Malachar leads the attack. The Ember Throne flickers.", zh: "邪教全面進攻。Malachar 帶領攻擊。餘燼王座正在閃爍。" } },
    { speaker: "lyra", text: { en: "The flame is weakening. Kael, we must hold the Throne chamber or all is lost.", zh: "火焰正在衰弱。凱爾，我們必須守住王座大廳，否則一切盡失。" }, mood: "desperate" },
    { speaker: "kael", text: { en: "Then we hold it. Whatever it takes. For Aetheria.", zh: "那我們就守住。無論如何。為了艾特利亞。" }, mood: "determined" },
    { speaker: "malachar", text: { en: "Fools! The flame dies tonight! Zethar has spoken — the Endless Night is upon you!", zh: "蠢貨！今晚火焰就會熄滅！Zethar 已經說了——永夜降臨在你們身上！" }, mood: "angry" },
  ],
};

export const ch10_boss_death: DialogueScript = {
  id: "ch10_boss_death",
  lines: [
    { speaker: "malachar", text: { en: "Impossible! I was the strongest of the Guardians! How could a border knight best me?", zh: "不可能！我曾是守衛之中最強的！一個邊境騎士怎麼可能勝過我？" }, mood: "surprised" },
    { speaker: "lyra", text: { en: "The Ember Throne... it's flickering. The flame is dimming. But we stopped him.", zh: "餘燼王座……在閃爍。火焰在黯淡。但我們阻止了他。" }, mood: "sad" },
    { speaker: "borin", text: { en: "Wait — Malachar. He carries something. A shard of the Ember.", zh: "等一下——Malachar。他帶著什麼。餘燼的一塊碎片。" }, mood: "surprised" },
    { speaker: "darius", text: { en: "He escapes. And he has a piece of the flame. We cannot stay in this city.", zh: "他逃走了。而且他有一塊火焰碎片。我們不能留在這個城市。" }, mood: "urgent" },
    { speaker: "kael", text: { en: "Then we leave. We regroup beyond the walls. This is far from over.", zh: "那我們離開。我們在城外重新集結。這遠未結束。" }, mood: "determined" },
  ],
};

export const ch10_victory: DialogueScript = {
  id: "ch10_victory",
  lines: [
    { speaker: "narrator", text: { en: "The party escapes the burning city. The Ember Throne still flickers, but it holds.", zh: "隊伍逃離燃燒的城市。餘燼王座仍在閃爍，但它堅持住了。" } },
    { speaker: "lyra", text: { en: "I felt the flame stabilize as we left. But Malachar has a shard. Whatever he does with it, the world will feel it.", zh: "我離開時感覺到火焰穩定了。但 Malachar 有一塊碎片。無論他用它做什麼，世界都會感受到。" }, mood: "sad" },
    { speaker: "kael", text: { en: "Then we follow him. He leads to Zethar.", zh: "那我們跟蹤他。他會引領我們找到 Zethar。" }, mood: "determined" },
  ],
};

// === ACT III — Ch11-15 ===
export const ch11_pre: DialogueScript = {
  id: "ch11_pre",
  lines: [
    { speaker: "narrator", text: { en: "The Frostpeak Mountains. Cold, barren. The path narrows.", zh: "冰峰山脈。寒冷、荒蕪。道路狹窄。" } },
    { speaker: "darius", text: { en: "The mountain clans are proud and suspicious of lowlanders. We must tread carefully.", zh: "山嶽氏族驕傲且對低地人充滿戒心。我們必須謹慎行事。" }, mood: "neutral" },
    { speaker: "borin", text: { en: "Worse — the cold. Half our supplies are gone. We need shelter by nightfall.", zh: "更糟的是——寒冷。我們一半的補給都沒了。我們需要在日落前找到庇護所。" }, mood: "worried" },
  ],
};

export const ch11_victory: DialogueScript = {
  id: "ch11_victory",
  lines: [
    { speaker: "kael", text: { en: "We made it through. The pass opens to the western valleys.", zh: "我們穿越了。山口通向西方的山谷。" }, mood: "neutral" },
    { speaker: "lyra", text: { en: "I see a settlement ahead. Smoke. Someone lives here.", zh: "我看到前方有聚落。煙。有人住在那裡。" }, mood: "neutral" },
    { speaker: "borin", text: { en: "The mountain clans. They will be watching us. We must approach as friends.", zh: "山嶽氏族。他們會監視著我們。我們必須以朋友的身份接近。" }, mood: "neutral" },
  ],
};

export const ch12_pre: DialogueScript = {
  id: "ch12_pre",
  lines: [
    { speaker: "narrator", text: { en: "A dragon's roost. Once a mighty beast, now corrupted by the Umbral.", zh: "一條龍的巢穴。曾經是強大的野獸，現在被永夜腐化。" } },
    { speaker: "borin", text: { en: "That beast was a guardian of these peaks. The corruption has twisted it.", zh: "那野獸曾是這些山脈的守護者。腐化扭曲了它。" }, mood: "sad" },
    { speaker: "yuki", text: { en: "The clans have spoken of this. It must be freed or put down. There is no other way.", zh: "氏族已經說過了。必須將它解放或殺死。沒有其他方法。" }, mood: "determined" },
    { speaker: "kael", text: { en: "Then we try to free it. If there is still a spark of what it was within it...", zh: "那我們嘗試解放它。如果它裡面仍有曾經的火花……" }, mood: "determined" },
  ],
};

export const ch12_victory: DialogueScript = {
  id: "ch12_victory",
  lines: [
    { speaker: "yuki", text: { en: "It is done. The dragon is freed. You fought with honor. The clans will remember.", zh: "結束了。龍被解放了。你戰鬥得很光榮。氏族會記住。" }, mood: "happy" },
    { speaker: "kael", text: { en: "Yuki. The pegasus riders of the mountain clans. Will you join us?", zh: "Yuki。山嶽氏族的天馬騎士。你願意加入我們嗎？" }, mood: "neutral" },
    { speaker: "yuki", text: { en: "I will. For the beast you freed. For the world that was.", zh: "我願意。為了你解放的龍獸。為了曾經的世界。" }, mood: "determined" },
  ],
};

export const ch12_boss_death: DialogueScript = {
  id: "ch12_boss_death",
  lines: [
    { speaker: "umbral_dragon", text: { en: "Rrrrr... the light... it burns... yet the shadow... loosens...", zh: "嗚嗚……光……灼熱……然而暗影……鬆開了……" }, mood: "sad" },
    { speaker: "lyra", text: { en: "Rest now, ancient one. The corruption is gone. Sleep.", zh: "現在安息吧，古老者。腐化消失了。安睡。" }, mood: "neutral" },
  ],
};

export const ch13_pre: DialogueScript = {
  id: "ch13_pre",
  lines: [
    { speaker: "yuki", text: { en: "The clans have told me. Malachar has built a fortress in the old borderlands. The Umbral Fortress.", zh: "氏族已經告訴我了。Malachar 在舊邊境建了一座堡壘。暗影堡壘。" }, mood: "neutral" },
    { speaker: "darius", text: { en: "If he has the Ember shard, he will use it. And if he reaches Zethar...", zh: "如果他有餘燼碎片，他會用它。如果他到達 Zethar 身邊……" }, mood: "worried" },
    { speaker: "kael", text: { en: "We cannot let that happen. We ride for the fortress. Today.", zh: "我們不能讓那發生。我們今天就騎馬去堡壘。" }, mood: "determined" },
  ],
};

export const ch13_victory: DialogueScript = {
  id: "ch13_victory",
  lines: [
    { speaker: "yuki", text: { en: "The fortress lies ahead. The wind smells of ash.", zh: "堡壘就在前方。風帶著灰燼的味道。" }, mood: "neutral" },
    { speaker: "maren", text: { en: "Malachar is inside. And the shard.", zh: "Malachar 在裡面。還有碎片。" }, mood: "determined" },
  ],
};

export const ch14_pre: DialogueScript = {
  id: "ch14_pre",
  lines: [
    { speaker: "lyra", text: { en: "The lake is frozen solid. I can feel the corruption beneath — Umbral energy frozen in the ice.", zh: "湖面完全結冰了。我能感覺到下方的腐化——永夜能量凍結在冰中。" }, mood: "worried" },
    { speaker: "borin", text: { en: "Heavy units will crack the ice. I can feel it groan.", zh: "重型單位會踩裂冰面。我能感覺到冰在呻吟。" }, mood: "worried" },
    { speaker: "kael", text: { en: "Then we move quickly. Light units first. And we pray.", zh: "那我們快走。輕型單位先走。然後我們祈禱。" }, mood: "determined" },
  ],
};

export const ch14_victory: DialogueScript = {
  id: "ch14_victory",
  lines: [
    { speaker: "yuki", text: { en: "The far shore. The ice held — for most of us.", zh: "遠處的岸。冰撐住了——對我們大多數人來說。" }, mood: "neutral" },
    { speaker: "darius", text: { en: "Some of the ice cracked. Some fell. We lost Borin for a moment — but we found each other again.", zh: "有些冰裂開了。有些人掉下去了。我們一度失去了波林——但我們再次找到了彼此。" }, mood: "sad" },
  ],
};

export const ch15_pre: DialogueScript = {
  id: "ch15_pre",
  lines: [
    { speaker: "narrator", text: { en: "The Umbral Fortress. Cold. Dark. The Ember shard glows faintly in Malachar's hand.", zh: "暗影堡壘。寒冷。黑暗。餘燼碎片在 Malachar 手裡微弱地發光。" } },
    { speaker: "malachar", text: { en: "You followed me. Good. Witness what Zethar begins. The Endless Night comes — and the Ember will be the first to fall.", zh: "你跟著我來了。好。見證 Zethar 的開端。永夜降臨——而餘燼將第一個倒下。" }, mood: "angry" },
    { speaker: "kael", text: { en: "A Guardian of the Ember. How did you fall so far?", zh: "餘燼的守衛。你怎麼墮落到這個地步？" }, mood: "neutral" },
    { speaker: "malachar", text: { en: "I saw the truth. The flame is not salvation. It is a chain that binds us to a dying god. Zethar offers freedom.", zh: "我看到了真相。火焰不是救贖。它是將我們束縛於一個垂死之神身上的鎖鏈。Zethar 提供自由。" }, mood: "determined" },
    { speaker: "lyra", text: { en: "Malachar, please. I felt what you felt. But the answer isn't destruction — it's renewal.", zh: "Malachar，拜託。我感覺到了你感覺到的東西。但答案不是毀滅——是更新。" }, mood: "desperate" },
    { speaker: "malachar", text: { en: "Renewal? The dying god cannot be renewed. Only freed. And freedom requires the Endless Night.", zh: "更新？垂死之神不能被更新。只能被解放。而解放需要永夜。" }, mood: "determined" },
  ],
};

export const ch15_boss_death: DialogueScript = {
  id: "ch15_boss_death",
  lines: [
    { speaker: "malachar", text: { en: "The shard... the shard must reach Zethar. He will know what to do. I failed, but the Endless Night will not...", zh: "碎片……碎片必須到達 Zethar 手中。他會知道該怎麼做。我失敗了，但永夜不會……" }, mood: "sad" },
    { speaker: "kael", text: { en: "The shard. We must take it. We must finish this.", zh: "碎片。我們必須取回它。我們必須完成這件事。" }, mood: "determined" },
    { speaker: "darius", text: { en: "Kael, before I die — the Lord of Night has a fortress at the world's edge. A Void Gate. He is opening it.", zh: "凱爾，在我死之前——永夜之主在世界邊緣有一座堡壘。虛空之門。他正在打開它。" }, mood: "urgent" },
    { speaker: "lyra", text: { en: "The Void Gate... a direct channel to the Umbral realm. If he opens it fully, the Endless Night floods the world.", zh: "虛空之門……直通暗影領域的通道。如果他完全打開它，永夜會淹沒世界。" }, mood: "terrified" },
  ],
};

export const ch15_victory: DialogueScript = {
  id: "ch15_victory",
  lines: [
    { speaker: "lyra", text: { en: "I can feel the Ember shard in my hands. The flame is wounded, but still alive.", zh: "我能感覺到手中的餘燼碎片。火焰受了傷，但仍然活著。" }, mood: "neutral" },
    { speaker: "kael", text: { en: "We press on. Zethar's Void Gate must be closed. Or we all perish.", zh: "我們繼續。Zethar 的虛空之門必須關閉。否則我們都會滅亡。" }, mood: "determined" },
  ],
};

// === ACT IV — Ch16-20 ===
export const ch16_pre: DialogueScript = {
  id: "ch16_pre",
  lines: [
    { speaker: "narrator", text: { en: "The Void Gate. A tear in the world itself, black light spilling through. The Endless Night pours in.", zh: "虛空之門。世界本身的一道裂痕，黑光從中湧出。永夜灌入。" } },
    { speaker: "darius", text: { en: "We must close it. Reach the gate. Whatever the cost.", zh: "我們必須關閉它。到達大門。無論代價如何。" }, mood: "urgent" },
    { speaker: "lyra", text: { en: "The Ember shard reacts. It can seal the gate — if we can reach the heart of it.", zh: "餘燼碎片有反應。如果我們能到達它的核心，它能封印大門。" }, mood: "determined" },
  ],
};

export const ch16_victory: DialogueScript = {
  id: "ch16_victory",
  lines: [
    { speaker: "lyra", text: { en: "The gate is closed. The Endless Night retreats — for now. But the cost...", zh: "大門關上了。永夜撤退了——暫時。但代價……" }, mood: "sad" },
    { speaker: "kael", text: { en: "The Ember shard. You used it.", zh: "餘燼碎片。你用了它。" }, mood: "neutral" },
    { speaker: "lyra", text: { en: "I had to. And the flame... is now in me. I am the Ember's vessel now.", zh: "我必須這樣做。而火焰……現在在我體內。我是餘燼的器皿了。" }, mood: "determined" },
  ],
};

export const ch17_pre: DialogueScript = {
  id: "ch17_pre",
  lines: [
    { speaker: "narrator", text: { en: "Twenty years ago. A younger Ashwood, a young Malachar, a mysterious guardian — Zethar before his fall. The origin of the conflict.", zh: "二十年前。較年輕的 Ashwood，年輕的 Malachar，一個神秘的守衛——Zethar 墮落之前。衝突的起源。" } },
    { speaker: "young_kael_father", text: { en: "Zethar, the flame grows strong. We have held the border for a generation.", zh: "Zethar，火焰越來越強。我們守護邊境已經一代人了。" }, mood: "neutral" },
    { speaker: "young_malachar", text: { en: "And the cost? The god beneath the flame is weakening. We serve it by feeding it our own people.", zh: "代價呢？火焰之下的神正在衰弱。我們透過將自己的人民餵給它來侍奉它。" }, mood: "worried" },
    { speaker: "young_zethar", text: { en: "I have seen the truth. The flame is not salvation. It is a slow death. The god feeds on us. We feed on each other.", zh: "我看到了真相。火焰不是救贖。它是緩慢的死亡。神以我們為食。我們以彼此為食。" }, mood: "determined" },
  ],
};

export const ch17_victory: DialogueScript = {
  id: "ch17_victory",
  lines: [
    { speaker: "lyra", text: { en: "Now you understand. The choice that tore them apart. The choice you now face.", zh: "現在你明白了。那撕裂他們的選擇。你現在面對的選擇。" }, mood: "sad" },
    { speaker: "kael", text: { en: "The Ember... or the Endless Night. Two answers to the same suffering.", zh: "餘燼……或永夜。同一個苦難的兩個答案。" }, mood: "neutral" },
  ],
};

export const ch18_pre: DialogueScript = {
  id: "ch18_pre",
  lines: [
    { speaker: "narrator", text: { en: "The Throne's foundation. Where the Ember was first kindled. And where Zethar awaits.", zh: "王座的根基。餘燼第一次被點燃的地方。也是 Zethar 等待的地方。" } },
    { speaker: "zethar", text: { en: "So. You followed me here, Kael Ashwood. You carry the Ember's light.", zh: "如此。你跟著我來到這裡，Kael Ashwood。你帶著餘燼的光。" }, mood: "neutral" },
    { speaker: "kael", text: { en: "I do. And I know what you are. The first Guardian. The one who walked away.", zh: "是的。我知道你係咩人。第一任守衛。那個離開咗嘅人。" }, mood: "determined" },
    { speaker: "zethar", text: { en: "I walked away from a lie. I will offer you the same choice I gave Malachar — the same choice your father refused.", zh: "我從謊言中走開。我會俾你同 Malachar 一樣嘅選擇——你父親拒絕嗰個。" }, mood: "determined" },
    { speaker: "zethar", text: { en: "Join me. End the god's suffering. Let Aetheria breathe free. Or fight — and the dying god will drag us all into the dark with it.", zh: "加入我。終結神嘅痛苦。讓艾特利亞自由呼吸。抑或戰鬥——而垂死之神會將我哋全部拖入黑暗。" }, mood: "determined" },
  ],
};

export const ch18_boss_death: DialogueScript = {
  id: "ch18_boss_death",
  lines: [
    { speaker: "zethar", text: { en: "Impossible. I held this flame for a thousand years. I knew its every secret. How can one knight—", zh: "不可能。我守護這火焰一千年。我知道它所有秘密。一個騎士怎麼可能——" }, mood: "surprised" },
    { speaker: "lyra", text: { en: "He carries the Ember now. I am its vessel. And the flame is not what it was — it is what it is meant to be. Renewed, through sacrifice. Through love.", zh: "他現在帶著餘燼。我是它的器皿。而火焰不是它曾經的樣子——是它應該成爲的樣子。更新了，通過犧牲。通過愛。" }, mood: "determined" },
    { speaker: "zethar", text: { en: "Through... love? You would choose this path? You would bear this weight? For a world that knows you not?", zh: "通過……愛？你會選擇這條路？你會承擔這重量？為一個不認識你的世界？" }, mood: "neutral" },
    { speaker: "kael", text: { en: "Yes. For Lyra. For the people. For you — who deserved better than a thousand years of silent suffering.", zh: "是的。為萊拉。為人民。為你——你值得比一千年沉默的痛苦更好嘅對待。" }, mood: "determined" },
    { speaker: "zethar", text: { en: "...then I am glad. To fall to one such as you. May Aetheria remember us both — kindly.", zh: "……那我很高興。能倒在像你這樣的人手上。願艾特利亞記住我們兩個——帶著仁慈。" }, mood: "neutral" },
  ],
};

export const ch18_victory: DialogueScript = {
  id: "ch18_victory",
  lines: [
    { speaker: "lyra", text: { en: "The Throne is restored. The Endless Night retreats. Aetheria breathes free.", zh: "王座已恢復。永夜撤退。艾特利亞自由地呼吸。" }, mood: "neutral" },
    { speaker: "kael", text: { en: "But the god is wounded. Without Zethar's strength to sustain it—", zh: "但神受傷了。沒有 Zethar 的力量維持它——" }, mood: "neutral" },
    { speaker: "lyra", text: { en: "I am the vessel now. I will sustain it. As long as I live, the Ember burns.", zh: "我現在是器皿了。我會維持它。只要我活著，餘燼就會燃燒。" }, mood: "determined" },
  ],
};

export const ch19_pre: DialogueScript = {
  id: "ch19_pre",
  lines: [
    { speaker: "lyra", text: { en: "The ritual takes time. I cannot move, I cannot fight. I can only hold the flame and pray.", zh: "儀式需要時間。我不能移動，我不能戰鬥。我只能持著火焰祈禱。" }, mood: "neutral" },
    { speaker: "kael", text: { en: "Then we will hold this place for you. For as long as it takes. Whatever comes through that gate.", zh: "那我們會為你守住這裡。需要多久就多久。無論什麼從那個門出來。" }, mood: "determined" },
    { speaker: "darius", text: { en: "Fifteen turns. Hold for fifteen. The ritual must complete.", zh: "十五回合。守住十五回合。儀式必須完成。" }, mood: "urgent" },
  ],
};

export const ch19_victory: DialogueScript = {
  id: "ch19_victory",
  lines: [
    { speaker: "lyra", text: { en: "It's done. The god is at peace. The Ember burns steady. The Endless Night is no more.", zh: "完成了。神平靜了。餘燼穩定燃燒。永夜不再存在。" }, mood: "happy" },
    { speaker: "kael", text: { en: "Lyra. How do you feel?", zh: "萊拉。你感覺怎樣？" }, mood: "happy" },
    { speaker: "lyra", text: { en: "Warm. I feel the whole world. Every hearth, every home. I am the Ember now.", zh: "溫暖。我能感覺到整個世界。每個爐灶，每個家。我現在是餘燼了。" }, mood: "happy" },
  ],
};

export const ch20_pre: DialogueScript = {
  id: "ch20_pre",
  lines: [
    { speaker: "lyra", text: { en: "Kael. The void — something is fighting the gate. I can feel it. Zethar's works, unfinished. A last surge of Endless Night.", zh: "凱爾。虛空——有什麼正在對抗大門。我能感覺到。Zethar 的未完成之作。最後一波永夜。" }, mood: "urgent" },
    { speaker: "kael", text: { en: "Then we end it. Today. Once and for all.", zh: "那我們終結它。今天。一次而永遠。" }, mood: "determined" },
  ],
};

export const ch20_boss_death: DialogueScript = {
  id: "ch20_boss_death",
  lines: [
    { speaker: "narrator", text: { en: "Zethar's last surge falls silent. The void closes. Dawn breaks over Aetheria for the first time in a thousand years.", zh: "Zethar 的最後一波沉默下來。虛空關閉。艾特利亞迎來了一千年以來的第一個黎明。" } },
    { speaker: "kael", text: { en: "Dawn. It is truly dawn.", zh: "黎明。真的是黎明。" }, mood: "happy" },
    { speaker: "lyra", text: { en: "The Ember is whole. The god is at peace. The Endless Night is over.", zh: "餘燼完整。神平靜。永夜結束。" }, mood: "happy" },
    { speaker: "kael", text: { en: "And we... we begin again. Together.", zh: "而我們……我們重新開始。在一起。" }, mood: "happy" },
    { speaker: "borin", text: { en: "For Aetheria. For the dawn.", zh: "為了艾特利亞。為了黎明。" }, mood: "happy" },
    { speaker: "serra", text: { en: "For everyone we lost.", zh: "為了我們失去的每一個人。" }, mood: "happy" },
    { speaker: "darius", text: { en: "For those yet to come.", zh: "為了還未來到的。" }, mood: "happy" },
    { speaker: "maren", text: { en: "For the light that endures.", zh: "為了那持續的光。" }, mood: "happy" },
    { speaker: "yuki", text: { en: "For the wind and the sky.", zh: "為了風和天空。" }, mood: "happy" },
    { speaker: "narrator", text: { en: "And so the story of Embers in the Night comes to its end. But the story of Aetheria — that is only beginning.", zh: "如此，暗夜餘燼的故事來到了終結。但艾特利亞的故事——那只是開始。" } },
  ],
};

export const ch20_victory: DialogueScript = {
  id: "ch20_victory",
  lines: [
    { speaker: "narrator", text: { en: "Embers of Aetheria. The story concludes. Thank you for playing.", zh: "艾特利亞餘燼。故事結束。感謝你的遊玩。" } },
  ],
};
export const DIALOGUES: Record<string, DialogueScript> = {
  ch01_pre, ch01_boss_death, ch01_victory,
  ch02_pre, ch02_boss_death, ch02_victory,
  ch03_pre, ch03_boss_death, ch03_victory,
  ch04_pre, ch04_victory,
  ch05_pre, ch05_victory,
  ch06_pre, ch06_victory,
  ch07_pre, ch07_victory,
  ch08_pre, ch08_victory,
  ch09_pre, ch09_victory,
  ch10_pre, ch10_boss_death, ch10_victory,
  ch11_pre, ch11_victory,
  ch12_pre, ch12_boss_death, ch12_victory,
  ch13_pre, ch13_victory,
  ch14_pre, ch14_victory,
  ch15_pre, ch15_boss_death, ch15_victory,
  ch16_pre, ch16_victory,
  ch17_pre, ch17_victory,
  ch18_pre, ch18_boss_death, ch18_victory,
  ch19_pre, ch19_victory,
  ch20_pre, ch20_boss_death, ch20_victory,
};

export function getDialogue(id: string): DialogueScript | null {
  return DIALOGUES[id] || null;
}

// === Map chapter + trigger to dialogue id ===
export function getDialogueForTrigger(chapterId: string, trigger: "pre" | "boss_death" | "victory"): string | null {
  const id = `${chapterId}_${trigger}`;
  return DIALOGUES[id] ? id : null;
}
