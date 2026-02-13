import { AiProfile } from '@poker-god/contracts';

export type TrashContext = 'heroFold' | 'heroRaise' | 'heroCall' | 'aiFold' | 'heroWin' | 'aiWin' | 'heroPunished';

const spicyLines: Record<TrashContext, string[]> = {
  heroFold: ['又棄？你在繳學費。', '這手也放？盲注感謝你。'],
  heroRaise: ['喔？終於敢開火了。', '加注可以，別一會兒又縮回去。'],
  heroCall: ['跟得這麼快，是有讀牌還是硬賭？', '這個 call 我記下來了。'],
  aiFold: ['行，這回你偷到我的鍋。', '先讓你一口氣，下手會更重。'],
  heroWin: ['這手你打得像樣，下一手別飄。', '贏一手不算什麼，穩住再說。'],
  aiWin: ['就這？這種線在我這裡行不通。', '你剛剛那步太透明了。'],
  heroPunished: ['這種硬撐就是送分。', '我就等你犯這個錯。'],
};

const softLines: Record<TrashContext, string[]> = {
  heroFold: ['穩一點也不錯，下一手再反擊。', '先保留籌碼，節奏還在。'],
  heroRaise: ['這個進攻有想法。', '有壓力了，我會調整。'],
  heroCall: ['你選擇防守，看看 turn 發展。', '這個 call 很考驗後續判斷。'],
  aiFold: ['你拿下這鍋。', '這回合你壓力給得很好。'],
  heroWin: ['漂亮，這手執行到位。', '這個節點你把握得不錯。'],
  aiWin: ['這手我拿到了。', '你有思路，再修一下下注線會更好。'],
  heroPunished: ['這手有點可惜，下次可以更精準。', '這個點若再想一秒會更好。'],
};

const coldLines: Record<TrashContext, string[]> = {
  heroFold: ['可預期的棄牌。', '你的防守頻率偏低。'],
  heroRaise: ['你的 raise 範圍太可讀。', '下注尺寸資訊量過高。'],
  heroCall: ['你在邊緣區間跟注。', '這個 call 需要更強阻擋牌支持。'],
  aiFold: ['可接受的放棄，保留資源。', '此節點不值得投入。'],
  heroWin: ['本手你執行正確。', '你在這個點位做對了。'],
  aiWin: ['你的線在 turn 已失衡。', 'EV 已在上一街流失。'],
  heroPunished: ['你在錯誤節點投入過多。', '這是典型 overplay。'],
};

function randomPick(lines: string[]): string {
  const index = Math.floor(Math.random() * lines.length);
  return lines[index] ?? '';
}

export function getTrashTalk(ai: AiProfile, context: TrashContext, politeMode: boolean): string {
  if (politeMode) {
    return randomPick(softLines[context]);
  }

  if (ai.trashTalkMode === 'spicy') {
    return randomPick(spicyLines[context]);
  }

  if (ai.trashTalkMode === 'cold') {
    return randomPick(coldLines[context]);
  }

  return randomPick(softLines[context]);
}
