import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'

export type Lang = 'mr' | 'en'

export interface Strings {
  appName: string
  appSubtitle: string
  todayCollection: string
  tapToCollect: string
  totalAccounts: string
  collected: string
  todayAmount: string
  holdersList: string
  sortedByAccount: string
  accountNoShort: string
  totalCollection: string
  generatePdf: string
  pdfTitle: string
  dateLabel: string
  selectDate: string
  pastCollection: string
  dayAmount: string
  previousDay: string
  nextDay: string
  goToday: string
  futureDate: string
  srNo: string
  name: string
  accountNo: string
  amount: string
  accounts: string
  notesDetail: string
  notesTotal: string
  agentSign: string
  managerSign: string
  language: string
  markCollected: string
  unmarkCollected: string
  settings: string
  societyName: string
  address: string
  agentName: string
  managerName: string
  save: string
  cancel: string
  close: string
  theme: string
  dark: string
  light: string
  startingReceipt: string
  receiptNo: string
  receiptShort: string

  tabCollection: string
  tabHolders: string
  tabReports: string
  tabExport: string

  setupTitle: string
  setupSubtitle: string
  setupIntro: string
  setupStart: string
  setupDemo: string
  setupDemoHint: string
  setupLoading: string
  setupFailed: string

  add: string
  edit: string
  delete: string
  confirm: string
  done: string
  share: string
  pdf: string
  search: string
  filterLabel: string
  loading: string
  retry: string
  noData: string
  saved: string
  failed: string
  total: string

  holdersTitle: string
  holdersSubtitle: string
  addHolder: string
  editHolder: string
  holderName: string
  holderNameEn: string
  holderNameEnHint: string
  holderAccount: string
  holderAmount: string
  holderPhone: string
  holderActive: string
  holderInactive: string
  holderStatus: string
  holderActiveHint: string
  searchHolders: string
  filterActive: string
  filterInactive: string
  filterAll: string
  sortAccount: string
  sortName: string
  noHolders: string
  noHoldersHint: string
  deleteHolder: string
  deleteHolderConfirm: string
  holderSaved: string
  holderDeleted: string
  accountExists: string
  nameRequired: string
  accountRequired: string
  amountInvalid: string
  nextAccount: string
  activeCount: string
  totalCount: string

  collectionEmpty: string
  collectionEmptyHint: string
  goToHolders: string
  editAmount: string
  quickAmounts: string
  collectNow: string
  removeCollection: string
  amountSaved: string
  scanEntries: string
  scanTitle: string
  scanHint: string
  scanStart: string
  scanPreparing: string
  scanReading: string
  scanReview: string
  scanNotFound: string
  scanAlready: string
  scanDuplicate: string
  scanAdd: string
  scanExisting: string
  scanSave: string
  scanEmpty: string
  scanFailed: string
  scanReceiptInvalid: string
  scanReceiptUsed: string
  scanReceiptStart: string
  scanNativeOnly: string
  scanNoKey: string
  scanCloudFailed: string
  geminiKey: string
  geminiKeyHint: string
  paste: string
  clear: string
  showKey: string
  hideKey: string
  scanSaved: string
  scanFixUnknown: string
  scanFixAmount: string
  scanMatched: string
  scanRetry: string
  scanManual: string
  noEntries: string
  pdfSaved: string
  pdfFailed: string
  sharePdf: string
  shareTitle: string
  shareText: string
  sortReceipt: string
  sortPdfBy: string
  saveToDownloads: string
  shareToWhatsApp: string
  receiptAssigned: string
  uncollected: string
  startReceiptShort: string

  reportsTitle: string
  reportsSubtitle: string
  monthlyReport: string
  monthlyReportTitle: string
  monthlyTotal: string
  commission: string
  commissionRate: string
  commissionNote: string
  commissionHistory: string
  period: string
  days: string
  dailySheets: string
  regenerateSheet: string
  noReportData: string
  reportPdf: string
  reportShared: string
  prevMonth: string
  nextMonth: string
  currentMonth: string
  collectedDays: string

  back: string
  holderDetail: string
  holderHistory: string
  holderTotal: string
  firstCollection: string
  lastCollection: string
  noHistory: string
  statementPdf: string
  sendReport: string
  currentBalance: string
  openingBalance: string
  setOpeningBalance: string
  reduceBalance: string
  recordedOn: string
  balanceReductions: string
  balanceSaved: string
  noOpeningBalance: string
  balanceJournal: string
  balanceReduction: string
  collectionEntry: string
  callHolder: string
  reminder: string
  whatsapp: string
  sms: string
  sendReminder: string
  copy: string
  copied: string
  reminderNeedsPhone: string
  reminderTitle: string

  searchCollection: string
  filterPending: string
  filterCollected: string

  dataBackup: string
  notifications: string
  smsNotifications: string
  whatsappNotifications: string
  notificationsHint: string
  backupExport: string
  backupExportHint: string
  backupImport: string
  backupImportHint: string
  backupChooseFile: string
  backupPaste: string
  backupImported: string
  backupExported: string
  backupSavedTo: string
  backupInvalid: string
  backupEmpty: string
  backupRestoreConfirm: string

  exportTitle: string
  exportSubtitle: string
  exportRange: string
  rangeDay: string
  rangeWeek: string
  rangeMonth: string
  rangeCustom: string
  exportFrom: string
  exportTo: string
  exportRows: string
  exportDays: string
  exportTotal: string
  exportJson: string
  exportCsv: string
  exportSavedTo: string
  exportNoData: string
  exportImport: string
  exportImportHint: string
  exportImportChoose: string
  exportImportPreview: string
  exportImportConfirm: string
  exportImported: string
  exportSkipped: string
  exportInvalidFile: string
  exportRangeInvalid: string

  lockDay: string
  lockConfirm: string
  dayLocked: string
  unlockDay: string
  unlockHint: string
  masterPassword: string
  unlockWrong: string
  unlock: string
  dayUnlocked: string
  lockedBadge: string
  lockedNote: string
  dayLockedError: string
  entryLockTitle: string
  entryLockHint: string
}

export const STRINGS: Record<Lang, Strings> = {
  mr: {
    appName: 'वसुली सारांश',
    appSubtitle: 'दैनिक संकलन',
    todayCollection: 'आजची वसुली',
    tapToCollect: 'खातेदारावर टॅप करून वसुली नोंदवा.',
    totalAccounts: 'एकूण खाती',
    collected: 'वसुली झाली',
    todayAmount: 'आजची रक्कम',
    holdersList: 'खातेदार यादी',
    sortedByAccount: 'खाते क्रमांकानुसार',
    accountNoShort: 'खाते क्र.',
    totalCollection: 'एकूण वसुली',
    generatePdf: 'PDF तयार करा',
    pdfTitle: 'दैनिक पिग्मी वसुली पत्रक',
    dateLabel: 'दिनांक',
    selectDate: 'दिनांक निवडा',
    pastCollection: 'वसुली',
    dayAmount: 'त्या दिवसाची रक्कम',
    previousDay: 'मागील दिवस',
    nextDay: 'पुढील दिवस',
    goToday: 'आज',
    futureDate: 'भविष्यातील दिनांक नोंदवता येत नाही.',
    srNo: 'अ.क्र.',
    name: 'नाव',
    accountNo: 'खाते क्र.',
    amount: 'रक्कम',
    accounts: 'खाती',
    notesDetail: 'नोटांचा तपशील',
    notesTotal: 'नोटा एकूण',
    agentSign: 'एजंट सही',
    managerSign: 'स्टॅम्प व व्यवस्थापक सही',
    language: 'भाषा',
    markCollected: 'वसुली नोंदवा',
    unmarkCollected: 'वसुली रद्द करा',
    settings: 'सेटिंग्ज',
    societyName: 'संस्थेचे नाव',
    address: 'पत्ता',
    agentName: 'एजंटचे नाव',
    managerName: 'व्यवस्थापकाचे नाव',
    save: 'जतन करा',
    cancel: 'रद्द करा',
    close: 'बंद करा',
    theme: 'थीम',
    dark: 'गडद',
    light: 'फिकट',
    startingReceipt: 'आजचा सुरुवातीचा पावती क्रमांक',
    receiptNo: 'पावती क्रमांक',
    receiptShort: 'पावती',

    tabCollection: 'वसुली',
    tabHolders: 'खातेदार',
    tabReports: 'अहवाल',
    tabExport: 'डेटा',

    setupTitle: 'स्वागत आहे',
    setupSubtitle: 'पतसंस्था वसुली सुरू करा',
    setupIntro:
      'संस्थेची माहिती भरा. ही माहिती दैनिक व मासिक PDF पत्रकावर दिसेल.',
    setupStart: 'सुरू करा',
    setupDemo: 'डेमो डेटासह पहा',
    setupDemoHint:
      '४२ खातेदार व आजची १२ वसुली नमुना म्हणून भरली जाईल. नंतर बदलू शकता.',
    setupLoading: 'तयार होत आहे...',
    setupFailed: 'सेटअप जतन करता आला नाही.',

    add: 'जोडा',
    edit: 'बदला',
    delete: 'हटवा',
    confirm: 'खात्री आहे',
    done: 'झाले',
    share: 'शेअर',
    pdf: 'PDF',
    search: 'शोधा',
    filterLabel: 'फिल्टर',
    loading: 'लोड होत आहे...',
    retry: 'पुन्हा प्रयत्न करा',
    noData: 'माहिती नाही',
    saved: 'जतन झाले',
    failed: 'अयशस्वी',
    total: 'एकूण',

    holdersTitle: 'खातेदार',
    holdersSubtitle: 'खातेदार जोडा, बदला किंवा निष्क्रिय करा.',
    addHolder: 'नवीन खातेदार',
    editHolder: 'खातेदार बदला',
    holderName: 'नाव',
    holderNameEn: 'इंग्रजी नाव',
    holderNameEnHint: 'इंग्रजीमध्ये नाव (ऐच्छिक)',
    holderAccount: 'खाते क्रमांक',
    holderAmount: 'दैनिक रक्कम',
    holderPhone: 'मोबाइल (ऐच्छिक)',
    holderActive: 'सक्रिय',
    holderInactive: 'निष्क्रिय',
    holderStatus: 'स्थिती',
    holderActiveHint: 'निष्क्रिय खातेदार वसुली यादीत दिसणार नाही.',
    searchHolders: 'नाव किंवा खाते क्रमांक शोधा',
    filterActive: 'सक्रिय',
    filterInactive: 'निष्क्रिय',
    filterAll: 'सर्व',
    sortAccount: 'खाते क्र.',
    sortName: 'नाव',
    noHolders: 'अजून खातेदार नाहीत',
    noHoldersHint: 'सुरुवात करण्यासाठी पहिला खातेदार जोडा.',
    deleteHolder: 'खातेदार हटवा',
    deleteHolderConfirm:
      'हा खातेदार आणि त्याच्या सर्व वसुली नोंदी कायमच्या हटवायच्या?',
    holderSaved: 'खातेदार जतन झाला.',
    holderDeleted: 'खातेदार हटवला.',
    accountExists: 'हा खाते क्रमांक आधीच वापरात आहे.',
    nameRequired: 'नाव भरा.',
    accountRequired: 'खाते क्रमांक भरा.',
    amountInvalid: 'रक्कम ० किंवा जास्त असावी.',
    nextAccount: 'पुढील खाते क्र.',
    activeCount: 'सक्रिय',
    totalCount: 'एकूण',

    collectionEmpty: 'आजची वसुली सुरू करा',
    collectionEmptyHint: 'खातेदार जोडल्यानंतर ते येथे दिसतील.',
    goToHolders: 'खातेदार जोडा',
    editAmount: 'रक्कम बदला',
    quickAmounts: 'झटपट रक्कम',
    collectNow: 'वसुली नोंदवा',
    removeCollection: 'वसुली रद्द करा',
    amountSaved: 'रक्कम जतन झाली.',
    scanEntries: 'स्कॅन करा',
    scanTitle: 'पावती स्कॅन करा',
    scanHint:
      'पावतीचे पान कॅमेऱ्याने स्पष्ट काढा. खाते क्रमांक व रक्कम ओळखल्यानंतर तपासून जतन करा.',
    scanStart: 'कॅमेरा उघडा',
    scanPreparing: 'कॅमेरा उघडत आहे…',
    scanReading: 'पान वाचत आहे…',
    scanReview: 'स्कॅन केलेल्या नोंदी',
    scanNotFound: 'खाते सापडले नाही',
    scanAlready: 'आधीच नोंदवले',
    scanDuplicate: 'दुहेरी खाते',
    scanAdd: 'नोंद जोडा',
    scanExisting: 'आधीच नोंदवलेल्या नोंदी',
    scanSave: 'वसुलीत जोडा',
    scanEmpty: 'कोणत्याही नोंदी सापडल्या नाहीत. पुन्हा स्कॅन करा.',
    scanFailed: 'स्कॅन करता आला नाही.',
    scanReceiptInvalid: 'पावती क्रमांक चुकीचा आहे.',
    scanReceiptUsed: 'हा पावती क्रमांक आधीच वापरला आहे.',
    scanReceiptStart: 'पावती क्रमांक सुरुवात',
    scanNativeOnly: 'स्कॅनिंग फक्त Android अॅपमध्ये उपलब्ध आहे.',
    scanNoKey:
      'स्कॅनिंगसाठी सेटिंग्जमध्ये Gemini API की जोडा.',
    scanCloudFailed: 'पान ओळखता आले नाही:',
    geminiKey: 'Gemini API की',
    geminiKeyHint:
      'फक्त या डिव्हाइसवर साठवली जाते. स्कॅनिंगसाठी आवश्यक.',
    paste: 'पेस्ट करा',
    clear: 'साफ करा',
    showKey: 'की दाखवा',
    hideKey: 'की लपवा',
    scanSaved: 'नोंदी वसुलीत जोडल्या.',
    scanFixUnknown:
      'अपरिचित खाते क्रमांक दुरुस्त करा किंवा काढून टाका.',
    scanFixAmount: 'प्रत्येक नोंदीची रक्कम भरा.',
    scanMatched: 'जुळले',
    scanRetry: 'पुन्हा स्कॅन करा',
    scanManual: 'मॅन्युअली नोंदी भरा',
    noEntries: 'आज कोणतीही वसुली नोंदलेली नाही.',
    pdfSaved: 'PDF तयार झाला.',
    pdfFailed: 'PDF तयार करता आला नाही.',
    sharePdf: 'PDF शेअर करा',
    shareTitle: 'दैनिक वसुली पत्रक',
    shareText: 'आजचे वसुली पत्रक जोडले आहे.',
    sortReceipt: 'पावती क्र.',
    sortPdfBy: 'क्रमवारी',
    saveToDownloads: 'डाउनलोड्समध्ये सेव्ह करा',
    shareToWhatsApp: 'WhatsApp वर शेअर करा',
    receiptAssigned: 'पावती क्रमांक',
    uncollected: 'बाकी',
    startReceiptShort: 'सुरुवात',

    reportsTitle: 'अहवाल',
    reportsSubtitle: 'मासिक एकूण, ३% कमिशन आणि जुनी पत्रके.',
    monthlyReport: 'मासिक अहवाल',
    monthlyReportTitle: 'मासिक वसुली अहवाल',
    monthlyTotal: 'मासिक एकूण',
    commission: 'कमिशन',
    commissionRate: 'कमिशन दर: ३%',
    commissionNote: 'कमिशन ३% दराने, दोन दशांश स्थळांपर्यंत.',
    commissionHistory: 'कमिशन इतिहास',
    period: 'कालावधी',
    days: 'दिवस',
    dailySheets: 'दैनिक पत्रके',
    regenerateSheet: 'पत्रक पुन्हा तयार करा',
    noReportData: 'या कालावधीत वसुली नाही.',
    reportPdf: 'मासिक PDF',
    reportShared: 'अहवाल तयार झाला.',
    prevMonth: 'मागील महिना',
    nextMonth: 'पुढील महिना',
    currentMonth: 'चालू महिना',
    collectedDays: 'वसुलीचे दिवस',

    back: 'मागे',
    holderDetail: 'खातेदार',
    holderHistory: 'वसुली इतिहास',
    holderTotal: 'एकूण वसुली',
    firstCollection: 'पहिली',
    lastCollection: 'शेवटची',
    noHistory: 'अजून वसुली नोंदलेली नाही.',
    statementPdf: 'स्टेटमेंट PDF',
    sendReport: 'रिपोर्ट पाठवा',
    currentBalance: 'सध्याची शिल्लक',
    openingBalance: 'सुरुवातीची शिल्लक',
    setOpeningBalance: 'सुरुवातीची शिल्लक ठेवा',
    reduceBalance: 'शिल्लक कमी करा',
    recordedOn: 'नोंदणी दिनांक',
    balanceReductions: 'शिल्लक कपाती',
    balanceSaved: 'शिल्लक जतन झाली.',
    noOpeningBalance: 'सुरुवातीची शिल्लक सेट केलेली नाही.',
    balanceJournal: 'शिल्लक जर्नल',
    balanceReduction: 'शिल्लक कपात',
    collectionEntry: 'वसुली',
    callHolder: 'कॉल करा',
    reminder: 'रिमाइंडर',
    whatsapp: 'व्हॉट्सअ‍ॅप',
    sms: 'एसएमएस',
    sendReminder: 'रिमाइंडर पाठवा',
    copy: 'कॉपी',
    copied: 'कॉपी झाले.',
    reminderNeedsPhone: 'या खातेदाराचा मोबाइल क्रमांक नाही.',
    reminderTitle: 'वसुली रिमाइंडर',

    searchCollection: 'नाव किंवा खाते क्रमांक शोधा',
    filterPending: 'बाकी',
    filterCollected: 'वसुली झाली',

    dataBackup: 'डेटा व बॅकअप',
    notifications: 'सूचना',
    smsNotifications: 'SMS सूचना',
    whatsappNotifications: 'WhatsApp सूचना',
    notificationsHint:
      'वसुली नोंदवल्यावर खातेदाराला संदेश पाठवा. WhatsApp मध्ये संदेश तयार होईल; पाठवण्यासाठी Send दाबा.',
    backupExport: 'बॅकअप जतन करा',
    backupExportHint:
      'सर्व खातेदार व वसुली एका फाइलमध्ये जतन होते; ती जपून ठेवा किंवा दुसऱ्या फोनवर हलवा.',
    backupImport: 'बॅकअपमधून पुन्हा आणा',
    backupImportHint:
      'पुन्हा आणल्यास या फोनवरील सर्व सध्याची माहिती बदलली जाईल.',
    backupChooseFile: 'फाइल निवडा',
    backupPaste: 'किंवा बॅकअप मजकूर येथे पेस्ट करा',
    backupImported: 'बॅकअप पुन्हा आणला.',
    backupExported: 'बॅकअप फाइल तयार.',
    backupSavedTo: 'जतन केले:',
    backupInvalid: 'ही वैध बॅकअप फाइल वाटत नाही.',
    backupEmpty: 'अजून बॅकअपसाठी माहिती नाही.',
    backupRestoreConfirm: 'हा बॅकअप वापरून सर्व माहिती बदलायची?',

    exportTitle: 'डेटा निर्यात व बॅकअप',
    exportSubtitle: 'निवडलेल्या तारखांसाठी वसुलीचा डेटा निर्यात करा किंवा पुन्हा आणा.',
    exportRange: 'कालावधी',
    rangeDay: 'दिवस',
    rangeWeek: 'आठवडा',
    rangeMonth: 'महिना',
    rangeCustom: 'स्वतःचा',
    exportFrom: 'पासून',
    exportTo: 'पर्यंत',
    exportRows: 'नोंदी',
    exportDays: 'दिवस',
    exportTotal: 'एकूण वसुली',
    exportJson: 'JSON बॅकअप',
    exportCsv: 'CSV निर्यात',
    exportSavedTo: 'जतन केले:',
    exportNoData: 'या कालावधीत वसुली नाही.',
    exportImport: 'डेटा पुन्हा आणा',
    exportImportHint:
      'पूर्वी निर्यात केलेली JSON फाइल निवडा. फक्त त्या तारखांचा डेटा जोडला जाईल; लॉक असलेल्या तारखा वगळल्या जातील.',
    exportImportChoose: 'JSON फाइल निवडा',
    exportImportPreview: 'फाइलमध्ये',
    exportImportConfirm: 'जोडा व जतन करा',
    exportImported: 'यशस्वीरित्या जोडले.',
    exportSkipped: 'वगळले',
    exportInvalidFile: 'ही वैध निर्यात फाइल वाटत नाही.',
    exportRangeInvalid: 'कृपया वैध तारखा निवडा.',

    lockDay: 'दिवस लॉक करा',
    lockConfirm:
      'या दिवसाचा डेटा लॉक करायचा? लॉक केल्यावर बदल करता येणार नाहीत आणि केवळ मास्टर पासवर्डनेच उघडता येईल.',
    dayLocked: 'हा दिवस लॉक आहे',
    unlockDay: 'लॉक उघडा',
    unlockHint: 'लॉक उघडण्यासाठी मास्टर पासवर्ड टाका.',
    masterPassword: 'मास्टर पासवर्ड',
    unlockWrong: 'पासवर्ड चुकीचा आहे.',
    unlock: 'उघडा',
    dayUnlocked: 'दिवस अनलॉक झाला.',
    lockedBadge: 'लॉक',
    lockedNote: 'हा दिवस लॉक केलेला आहे. बदल करता येणार नाहीत.',
    dayLockedError: 'हा दिवस लॉक आहे.',
    entryLockTitle: 'बदलासाठी लॉक उघडा',
    entryLockHint:
      'ही रक्कम आधीच नोंदवली आहे. बदल किंवा काढण्यासाठी मास्टर पासवर्ड टाका.',
  },
  en: {
    appName: 'Collection Summary',
    appSubtitle: 'Daily collection',
    todayCollection: "Today's Collection",
    tapToCollect: 'Tap a holder to record the collection.',
    totalAccounts: 'Total Accounts',
    collected: 'Collected',
    todayAmount: "Today's Amount",
    holdersList: 'Account Holders',
    sortedByAccount: 'Sorted by account no.',
    accountNoShort: 'A/c No.',
    totalCollection: 'Total Collection',
    generatePdf: 'Generate PDF',
    pdfTitle: 'Daily Pigmy Collection Sheet',
    dateLabel: 'Date',
    selectDate: 'Select date',
    pastCollection: 'Collection',
    dayAmount: "Day's amount",
    previousDay: 'Previous day',
    nextDay: 'Next day',
    goToday: 'Today',
    futureDate: 'You cannot record a future date.',
    srNo: 'Sr.',
    name: 'Name',
    accountNo: 'A/c No.',
    amount: 'Amount',
    accounts: 'accounts',
    notesDetail: 'Note Details',
    notesTotal: 'Notes Total',
    agentSign: 'Agent Sign',
    managerSign: 'Stamp & Manager Sign',
    language: 'Language',
    markCollected: 'Mark collected',
    unmarkCollected: 'Unmark collected',
    settings: 'Settings',
    societyName: 'Society name',
    address: 'Address',
    agentName: 'Agent name',
    managerName: 'Manager name',
    save: 'Save',
    cancel: 'Cancel',
    close: 'Close',
    theme: 'Theme',
    dark: 'Dark',
    light: 'Light',
    startingReceipt: "Today's starting receipt no.",
    receiptNo: 'Receipt No.',
    receiptShort: 'Rcpt',

    tabCollection: 'Collection',
    tabHolders: 'Holders',
    tabReports: 'Reports',
    tabExport: 'Data',

    setupTitle: 'Welcome',
    setupSubtitle: 'Start your collection book',
    setupIntro:
      'Enter the society details. This information appears on daily and monthly PDFs.',
    setupStart: 'Get started',
    setupDemo: 'Try with demo data',
    setupDemoHint:
      '42 holders and 12 collections for today will be added as a sample. You can edit them later.',
    setupLoading: 'Preparing...',
    setupFailed: 'Could not save the setup.',

    add: 'Add',
    edit: 'Edit',
    delete: 'Delete',
    confirm: 'Confirm',
    done: 'Done',
    share: 'Share',
    pdf: 'PDF',
    search: 'Search',
    filterLabel: 'Filter',
    loading: 'Loading...',
    retry: 'Retry',
    noData: 'No data',
    saved: 'Saved',
    failed: 'Failed',
    total: 'Total',

    holdersTitle: 'Holders',
    holdersSubtitle: 'Add, edit, or deactivate account holders.',
    addHolder: 'New holder',
    editHolder: 'Edit holder',
    holderName: 'Name',
    holderNameEn: 'English name',
    holderNameEnHint: 'Name in English (optional)',
    holderAccount: 'Account no.',
    holderAmount: 'Daily amount',
    holderPhone: 'Phone (optional)',
    holderActive: 'Active',
    holderInactive: 'Inactive',
    holderStatus: 'Status',
    holderActiveHint: 'Inactive holders do not appear in the collection list.',
    searchHolders: 'Search name or account no.',
    filterActive: 'Active',
    filterInactive: 'Inactive',
    filterAll: 'All',
    sortAccount: 'Account no.',
    sortName: 'Name',
    noHolders: 'No holders yet',
    noHoldersHint: 'Add the first holder to get started.',
    deleteHolder: 'Delete holder',
    deleteHolderConfirm:
      'Delete this holder and all of their collection records permanently?',
    holderSaved: 'Holder saved.',
    holderDeleted: 'Holder deleted.',
    accountExists: 'This account number is already in use.',
    nameRequired: 'Enter a name.',
    accountRequired: 'Enter an account number.',
    amountInvalid: 'Amount must be 0 or more.',
    nextAccount: 'Next account no.',
    activeCount: 'Active',
    totalCount: 'Total',

    collectionEmpty: 'Start today’s collection',
    collectionEmptyHint: 'Holders will appear here once you add them.',
    goToHolders: 'Add holders',
    editAmount: 'Edit amount',
    quickAmounts: 'Quick amounts',
    collectNow: 'Record collection',
    removeCollection: 'Remove collection',
    amountSaved: 'Amount saved.',
    scanEntries: 'Scan',
    scanTitle: 'Scan collection sheet',
    scanHint:
      'Take a clear photo of the collection page. Review the detected account numbers and amounts before saving.',
    scanStart: 'Open camera',
    scanPreparing: 'Opening the camera…',
    scanReading: 'Reading the page…',
    scanReview: 'Scanned entries',
    scanNotFound: 'Account not found',
    scanAlready: 'Already collected',
    scanDuplicate: 'Duplicate account',
    scanAdd: 'Add entry',
    scanExisting: 'Already saved for this day',
    scanSave: 'Add to collection',
    scanEmpty: 'No entries were found. Try scanning again.',
    scanFailed: 'Could not scan the page.',
    scanReceiptInvalid: 'Enter a valid receipt number.',
    scanReceiptUsed: 'That receipt number is already used.',
    scanReceiptStart: 'Starting receipt number',
    scanNativeOnly: 'Scanning is available in the Android app only.',
    scanNoKey: 'Add a Gemini API key in Settings to scan.',
    scanCloudFailed: 'Could not recognize the page:',
    geminiKey: 'Gemini API key',
    geminiKeyHint: 'Stored only on this device. Required for scanning.',
    paste: 'Paste',
    clear: 'Clear',
    showKey: 'Show key',
    hideKey: 'Hide key',
    scanSaved: 'entries added.',
    scanFixUnknown: 'Fix or remove the unknown account numbers.',
    scanFixAmount: 'Enter an amount for every entry.',
    scanMatched: 'Matched',
    scanRetry: 'Scan again',
    scanManual: 'Enter manually',
    noEntries: 'No collections recorded today.',
    pdfSaved: 'PDF generated.',
    pdfFailed: 'Could not generate the PDF.',
    sharePdf: 'Share PDF',
    shareTitle: 'Daily collection sheet',
    shareText: 'The daily collection sheet is attached.',
    sortReceipt: 'Receipt no.',
    sortPdfBy: 'Sort by',
    saveToDownloads: 'Save to Downloads',
    shareToWhatsApp: 'Share on WhatsApp',
    receiptAssigned: 'Receipt no.',
    uncollected: 'Pending',
    startReceiptShort: 'Start',

    reportsTitle: 'Reports',
    reportsSubtitle: 'Monthly totals, 3% commission, and past sheets.',
    monthlyReport: 'Monthly report',
    monthlyReportTitle: 'Monthly Collection Report',
    monthlyTotal: 'Monthly total',
    commission: 'Commission',
    commissionRate: 'Commission rate: 3%',
    commissionNote: 'Commission at 3%, rounded to two decimal places.',
    commissionHistory: 'Commission history',
    period: 'Period',
    days: 'Days',
    dailySheets: 'Daily sheets',
    regenerateSheet: 'Regenerate sheet',
    noReportData: 'No collections in this period.',
    reportPdf: 'Monthly PDF',
    reportShared: 'Report generated.',
    prevMonth: 'Previous month',
    nextMonth: 'Next month',
    currentMonth: 'Current month',
    collectedDays: 'Collection days',

    back: 'Back',
    holderDetail: 'Holder',
    holderHistory: 'Collection history',
    holderTotal: 'Total collected',
    firstCollection: 'First',
    lastCollection: 'Last',
    noHistory: 'No collections recorded yet.',
    statementPdf: 'Statement PDF',
    sendReport: 'Send report',
    currentBalance: 'Current balance',
    openingBalance: 'Opening balance',
    setOpeningBalance: 'Set opening balance',
    reduceBalance: 'Reduce balance',
    recordedOn: 'Recorded on',
    balanceReductions: 'Balance reductions',
    balanceSaved: 'Balance saved.',
    noOpeningBalance: 'No opening balance set.',
    balanceJournal: 'Balance journal',
    balanceReduction: 'Balance reduction',
    collectionEntry: 'Collection',
    callHolder: 'Call',
    reminder: 'Reminder',
    whatsapp: 'WhatsApp',
    sms: 'SMS',
    sendReminder: 'Send reminder',
    copy: 'Copy',
    copied: 'Copied.',
    reminderNeedsPhone: 'This holder has no phone number.',
    reminderTitle: 'Collection reminder',

    searchCollection: 'Search name or account no.',
    filterPending: 'Pending',
    filterCollected: 'Collected',

    dataBackup: 'Data & backup',
    notifications: 'Notifications',
    smsNotifications: 'SMS notifications',
    whatsappNotifications: 'WhatsApp notifications',
    notificationsHint:
      'Send a message to the holder after a collection. WhatsApp opens with the message ready; tap Send.',
    backupExport: 'Save backup',
    backupExportHint:
      'Saves every holder and collection into one file you can keep safe or move to another phone.',
    backupImport: 'Restore from backup',
    backupImportHint:
      'Restoring replaces all current data on this phone.',
    backupChooseFile: 'Choose file',
    backupPaste: 'Or paste backup text here',
    backupImported: 'Backup restored.',
    backupExported: 'Backup file is ready.',
    backupSavedTo: 'Saved to',
    backupInvalid: 'That does not look like a valid backup file.',
    backupEmpty: 'There is nothing to back up yet.',
    backupRestoreConfirm: 'Replace all data with this backup?',

    exportTitle: 'Export & backup',
    exportSubtitle:
      'Export collection data for the selected dates, or bring it back later.',
    exportRange: 'Range',
    rangeDay: 'Day',
    rangeWeek: 'Week',
    rangeMonth: 'Month',
    rangeCustom: 'Custom',
    exportFrom: 'From',
    exportTo: 'To',
    exportRows: 'Rows',
    exportDays: 'Days',
    exportTotal: 'Total',
    exportJson: 'JSON backup',
    exportCsv: 'CSV export',
    exportSavedTo: 'Saved to',
    exportNoData: 'No collections in this range.',
    exportImport: 'Import data',
    exportImportHint:
      'Choose a previously exported JSON file. Only those dates are merged; locked dates are skipped.',
    exportImportChoose: 'Choose JSON file',
    exportImportPreview: 'File contains',
    exportImportConfirm: 'Merge & save',
    exportImported: 'Imported successfully.',
    exportSkipped: 'skipped',
    exportInvalidFile: 'That does not look like a valid export file.',
    exportRangeInvalid: 'Please pick a valid date range.',

    lockDay: 'Lock day',
    lockConfirm:
      'Lock this day? After locking, no edits are allowed and only a master password can unlock it.',
    dayLocked: 'This day is locked',
    unlockDay: 'Unlock',
    unlockHint: 'Enter the master password to unlock this day.',
    masterPassword: 'Master password',
    unlockWrong: 'Incorrect password.',
    unlock: 'Unlock',
    dayUnlocked: 'Day unlocked.',
    lockedBadge: 'LOCKED',
    lockedNote: 'This day is locked. No edits are allowed.',
    dayLockedError: 'This day is locked.',
    entryLockTitle: 'Unlock to edit',
    entryLockHint:
      'This amount is already collected. Enter the master password to edit or remove it.',
  },
}

const STORAGE_KEY = 'collection-summary.lang'

interface LanguageContextValue {
  lang: Lang
  setLang: (lang: Lang) => void
}

const LanguageContext = createContext<LanguageContextValue>({
  lang: 'mr',
  setLang: () => {},
})

function readInitialLang(): Lang {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'mr' || stored === 'en') return stored
  } catch {
    void 0
  }
  return 'mr'
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(readInitialLang)

  useEffect(() => {
    document.documentElement.lang = lang
    try {
      localStorage.setItem(STORAGE_KEY, lang)
    } catch {
      void 0
    }
  }, [lang])

  function setLang(next: Lang) {
    setLangState(next)
  }

  return (
    <LanguageContext.Provider value={{ lang, setLang }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  return useContext(LanguageContext)
}
