export const DEMO_COLLECTED_COUNT = 12

const NAMES = [
  'रमेश शिवाजी पाटील',
  'सुनीता अनिल जाधव',
  'महादेव कृष्णा कदम',
  'अनिता सुरेश मोरे',
  'विठ्ठल दत्तात्रेय शिंदे',
  'प्रिया राजेश देशमुख',
  'गणेश तुकाराम भोसले',
  'सविता महेश कुलकर्णी',
]

const AMOUNTS = [50, 100, 150, 200]

export interface DemoHolder {
  name: string
  accountNo: string
  defaultAmount: number
}

export const DEMO_HOLDERS: DemoHolder[] = Array.from(
  { length: 42 },
  (_, i) => ({
    name: NAMES[i % NAMES.length],
    accountNo: String(i + 1).padStart(3, '0'),
    defaultAmount: AMOUNTS[i % AMOUNTS.length],
  }),
)
