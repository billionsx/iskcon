/**
 * Демонстрационный набор стихов для прототипа ридера.
 *
 * Санскрит (деванагари) и транслитерация IAST — общественное достояние
 * (самим стихам тысячи лет). Пословный перевод, перевод и комментарий здесь —
 * МОИ ДЕМОНСТРАЦИОННЫЕ тексты (не перевод Шрилы Прабхупады, не материалы BBT):
 * они нужны только чтобы показать, как работают все пять слоёв карточки.
 *
 * Ридер использует эти данные ТОЛЬКО для пустых слоёв: если в D1 есть
 * настоящий текст издания, он имеет приоритет. Демо-перевод/комментарий
 * помечаются в интерфейсе плашкой «демо».
 */
export interface DemoVerse {
  devanagari: string;
  translit: string;
  tokens: { term: string; gloss: string }[];
  translation?: string;
  purport?: string;
}

export const DEMO_VERSES: Record<string, DemoVerse> = {
  "БГ 1.1": {
    devanagari:
      "धृतराष्ट्र उवाच\nधर्मक्षेत्रे कुरुक्षेत्रे समवेता युयुत्सवः।\nमामकाः पाण्डवाश्चैव किमकुर्वत सञ्जय॥",
    translit:
      "dhṛtarāṣṭra uvāca\ndharma-kṣetre kuru-kṣetre samavetā yuyutsavaḥ\nmāmakāḥ pāṇḍavāś caiva kim akurvata sañjaya",
    tokens: [
      { term: "dhṛtarāṣṭraḥ uvāca", gloss: "Дхритараштра сказал" },
      { term: "dharma-kṣetre", gloss: "в месте дхармы" },
      { term: "kuru-kṣetre", gloss: "на Курукшетре" },
      { term: "samavetāḥ", gloss: "собравшиеся" },
      { term: "yuyutsavaḥ", gloss: "желающие сражаться" },
      { term: "māmakāḥ", gloss: "мои сыновья" },
      { term: "pāṇḍavāḥ", gloss: "сыновья Панду" },
      { term: "ca eva", gloss: "и также" },
      { term: "kim akurvata", gloss: "что они сделали" },
      { term: "sañjaya", gloss: "о Санджая" },
    ],
  },
  "БГ 2.13": {
    devanagari:
      "देहिनोऽस्मिन्यथा देहे कौमारं यौवनं जरा।\nतथा देहान्तरप्राप्तिर्धीरस्तत्र न मुह्यति॥",
    translit:
      "dehino 'smin yathā dehe kaumāraṁ yauvanaṁ jarā\ntathā dehāntara-prāptir dhīras tatra na muhyati",
    tokens: [
      { term: "dehinaḥ", gloss: "воплощённого" },
      { term: "asmin", gloss: "в этом" },
      { term: "yathā", gloss: "как" },
      { term: "dehe", gloss: "в теле" },
      { term: "kaumāram", gloss: "детство" },
      { term: "yauvanam", gloss: "юность" },
      { term: "jarā", gloss: "старость" },
      { term: "tathā", gloss: "так же" },
      { term: "deha-antara", gloss: "другого тела" },
      { term: "prāptiḥ", gloss: "обретение" },
      { term: "dhīraḥ", gloss: "трезвомыслящий" },
      { term: "tatra", gloss: "при этом" },
      { term: "na muhyati", gloss: "не впадает в заблуждение" },
    ],
    translation:
      "Как воплощённая душа в этом теле проходит через детство, юность и старость, так же она переходит и в другое тело. Трезвомыслящего человека такая перемена не смущает.",
    purport:
      "Стих вводит ключевое для «Гиты» различение: вечная душа и временное тело. Смена тел сравнивается с естественной сменой возрастов — она не затрагивает самого носителя сознания. На этом строится дальнейший разговор о спокойствии перед лицом смерти.",
  },
  "БГ 2.47": {
    devanagari:
      "कर्मण्येवाधिकारस्ते मा फलेषु कदाचन।\nमा कर्मफलहेतुर्भूर्मा ते सङ्गोऽस्त्वकर्मणि॥",
    translit:
      "karmaṇy evādhikāras te mā phaleṣu kadācana\nmā karma-phala-hetur bhūr mā te saṅgo 'stv akarmaṇi",
    tokens: [
      { term: "karmaṇi", gloss: "в предписанном долге" },
      { term: "eva", gloss: "безусловно" },
      { term: "adhikāraḥ", gloss: "право" },
      { term: "te", gloss: "твоё" },
      { term: "mā", gloss: "никогда" },
      { term: "phaleṣu", gloss: "в плодах" },
      { term: "kadācana", gloss: "ни в какое время" },
      { term: "karma-phala", gloss: "результата действий" },
      { term: "hetuḥ", gloss: "причина" },
      { term: "bhūḥ", gloss: "будь" },
      { term: "saṅgaḥ", gloss: "привязанность" },
      { term: "astu", gloss: "пусть будет" },
      { term: "akarmaṇi", gloss: "в бездействии" },
    ],
    translation:
      "Твоё право — лишь на само действие, но никогда на его плоды. Не действуй ради награды, но и к бездействию не привязывайся.",
    purport:
      "Здесь сформулирован принцип действия без корысти (нишкама-карма). Внимание переносится с результата на качество самого труда и на чистоту побуждения. Так действие перестаёт порабощать и становится формой внутренней дисциплины.",
  },
  "БГ 4.7": {
    devanagari:
      "यदा यदा हि धर्मस्य ग्लानिर्भवति भारत।\nअभ्युत्थानमधर्मस्य तदात्मानं सृजाम्यहम्॥",
    translit:
      "yadā yadā hi dharmasya glānir bhavati bhārata\nabhyutthānam adharmasya tadātmānaṁ sṛjāmy aham",
    tokens: [
      { term: "yadā yadā", gloss: "всякий раз, когда" },
      { term: "hi", gloss: "поистине" },
      { term: "dharmasya", gloss: "дхармы" },
      { term: "glāniḥ", gloss: "упадок" },
      { term: "bhavati", gloss: "наступает" },
      { term: "bhārata", gloss: "о Бхарата" },
      { term: "abhyutthānam", gloss: "подъём" },
      { term: "adharmasya", gloss: "беззакония" },
      { term: "tadā", gloss: "тогда" },
      { term: "ātmānam", gloss: "Себя" },
      { term: "sṛjāmi aham", gloss: "Я являю" },
    ],
    translation:
      "Всякий раз, когда приходит в упадок дхарма и поднимается беззаконие, о Бхарата, Я являю Себя.",
    purport:
      "Стих говорит о нисхождении Бога в мир ради восстановления равновесия. Упадок дхармы — это знак, а не приговор: за ним следует обновление. Так задаётся тема следующего стиха о цели такого прихода.",
  },
  "БГ 9.26": {
    devanagari:
      "पत्रं पुष्पं फलं तोयं यो मे भक्त्या प्रयच्छति।\nतदहं भक्त्युपहृतमश्नामि प्रयतात्मनः॥",
    translit:
      "patraṁ puṣpaṁ phalaṁ toyaṁ yo me bhaktyā prayacchati\ntad ahaṁ bhakty-upahṛtam aśnāmi prayatātmanaḥ",
    tokens: [
      { term: "patram", gloss: "листок" },
      { term: "puṣpam", gloss: "цветок" },
      { term: "phalam", gloss: "плод" },
      { term: "toyam", gloss: "воду" },
      { term: "yaḥ", gloss: "кто" },
      { term: "me", gloss: "Мне" },
      { term: "bhaktyā", gloss: "с преданностью" },
      { term: "prayacchati", gloss: "подносит" },
      { term: "tat", gloss: "то" },
      { term: "aham", gloss: "Я" },
      { term: "bhakti-upahṛtam", gloss: "поднесённое с любовью" },
      { term: "aśnāmi", gloss: "принимаю" },
      { term: "prayata-ātmanaḥ", gloss: "от чистого сердцем" },
    ],
    translation:
      "Если человек с любовью поднесёт Мне листок, цветок, плод или воду — этот дар чистого сердца Я приму.",
    purport:
      "Подчёркивается, что важна не ценность подношения, а любовь и чистота намерения. Путь доступен каждому: достаточно листа или глотка воды. Преданность измеряется сердцем, а не богатством.",
  },
  "БГ 18.66": {
    devanagari:
      "सर्वधर्मान्परित्यज्य मामेकं शरणं व्रज।\nअहं त्वां सर्वपापेभ्यो मोक्षयिष्यामि मा शुचः॥",
    translit:
      "sarva-dharmān parityajya mām ekaṁ śaraṇaṁ vraja\nahaṁ tvāṁ sarva-pāpebhyo mokṣayiṣyāmi mā śucaḥ",
    tokens: [
      { term: "sarva-dharmān", gloss: "все виды долга" },
      { term: "parityajya", gloss: "оставив" },
      { term: "mām", gloss: "Мне" },
      { term: "ekam", gloss: "одному" },
      { term: "śaraṇam", gloss: "как прибежищу" },
      { term: "vraja", gloss: "предайся" },
      { term: "aham", gloss: "Я" },
      { term: "tvām", gloss: "тебя" },
      { term: "sarva-pāpebhyaḥ", gloss: "от всех грехов" },
      { term: "mokṣayiṣyāmi", gloss: "освобожу" },
      { term: "mā śucaḥ", gloss: "не бойся" },
    ],
    translation:
      "Оставив все прочие обязанности, найди прибежище во Мне одном. Я освобожу тебя от всех последствий грехов — не бойся.",
    purport:
      "Завершающее наставление «Гиты» — о полном предании. С человека снимается груз тревоги о собственной праведности. Прибежище заменяет страх доверием — этим итогом и подытоживается вся беседа.",
  },
};

/** Порядок демо-стихов для удобной навигации/«стиха дня». */
export const DEMO_REFS = Object.keys(DEMO_VERSES);
