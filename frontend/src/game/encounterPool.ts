import type { EncounterEventData } from './types';

export const ENCOUNTER_POOL: EncounterEventData[] = [
  {
    id: 'enc-merchant-cache',
    type: 'profit',
    title: '漂流商队残骸',
    description: '一支失联商队的残骸漂浮在航道边缘。扫描结果显示还有一批可回收物资，但停留回收会暴露你的航迹。',
    choices: [
      {
        choiceId: 1,
        text: '回收残余货物',
        consequenceHint: '收益：650 CR | 风险：通缉等级 +1',
        effect: { creditsDelta: 650, wantedLevelDelta: 1 },
      },
      {
        choiceId: 2,
        text: '仅记录坐标并离开',
        consequenceHint: '收益：无 | 风险：无',
        effect: {},
      },
    ],
  },
  {
    id: 'enc-patrol-check',
    type: 'risk',
    title: '临检巡逻队',
    description: '一支联邦巡逻编队要求你减速接受临检。你可以尝试配合，也可以花钱打点快速离开。',
    choices: [
      {
        choiceId: 1,
        text: '支付通行费用',
        consequenceHint: '代价：300 CR | 风险：无',
        effect: { creditsDelta: -300 },
      },
      {
        choiceId: 2,
        text: '接受完整检查',
        consequenceHint: '收益：无 | 风险：额外扣留 1 世界年份',
        effect: { yearDelta: 1 },
      },
    ],
  },
  {
    id: 'enc-smuggler-offer',
    type: 'detention',
    title: '走私者报价',
    description: '一艘无注册飞船向你发来加密报价，声称愿意共享一条灰色贸易情报，但你必须承担额外的嫌疑。',
    choices: [
      {
        choiceId: 1,
        text: '购买情报',
        consequenceHint: '收益：终止年份 +1 | 风险：通缉等级 +1',
        effect: { endYearDelta: 1, wantedLevelDelta: 1 },
      },
      {
        choiceId: 2,
        text: '拒绝并断开信道',
        consequenceHint: '收益：无 | 风险：无',
        effect: {},
      },
    ],
  },
];
