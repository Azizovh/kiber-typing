import type { Token } from '../engine/types';
import type { Level, StageScore } from '../store/onboarding';
import type { Lang } from '../store/settings';
import { createGenerator, type Rng } from './generate';

/**
 * Placement: how a newcomer's level is measured instead of asked.
 * Three short typing stages (plain words → symbols → command lines) and a
 * short knowledge quiz that runs from easy to hard.
 */

export type StageId = 'letters' | 'symbols' | 'commands';
export const STAGES: StageId[] = ['letters', 'symbols', 'commands'];
export const STAGE_SECONDS = 20;

/** Everyday words of the field, lowercase letters only — measures bare typing. */
const PLAIN_WORDS = (
  'user host port file root scan data code key hash login shell admin server client network ' +
  'packet system access secure attack defend threat target report script kernel memory process ' +
  'service socket router switch domain proxy tunnel cipher token cookie session header request ' +
  'response browser update backup restore monitor filter block allow trust verify detect patch ' +
  'exploit payload malware virus worm trojan phishing password account group owner read write ' +
  'execute search find list copy move delete create open close start stop status error warning ' +
  'input output source binary library module driver device disk mount path name size time date'
).split(' ');

function plainGenerator(rng: Rng) {
  let last = '';
  return (minWords: number): Token[] => {
    const out: Token[] = [];
    while (out.length < minWords) {
      const word = PLAIN_WORDS[Math.floor(rng() * PLAIN_WORDS.length)];
      if (word === last) continue;
      last = word;
      out.push({ text: word });
    }
    return out;
  };
}

/** Text source for one stage; call it again for more text. */
export function stageGenerator(stage: StageId, rng: Rng = Math.random) {
  if (stage === 'letters') return plainGenerator(rng);
  if (stage === 'symbols') return createGenerator({ category: 'symbols', topic: null }, rng);
  // Everyday shell commands: the stage measures typing, not tool knowledge.
  return createGenerator({ category: 'commands', topic: 'shell' }, rng);
}

/** [intermediate from, advanced from] in WPM — symbols and commands are slower by nature. */
const THRESHOLDS: Record<StageId, [number, number]> = {
  letters: [25, 45],
  symbols: [12, 25],
  commands: [15, 30],
};

export function scoreStage(stage: StageId, wpm: number, accuracy: number): StageScore {
  const [mid, high] = THRESHOLDS[stage];
  let rank = wpm >= high ? 2 : wpm >= mid ? 1 : 0;
  // Speed built on guessing is not a level: sloppy typing drops one step.
  if (accuracy < 90 && rank > 0) rank--;
  if (accuracy < 75) rank = 0;
  return { wpm, accuracy, level: (['beginner', 'intermediate', 'advanced'] as const)[rank] };
}

/** Overall typing level: plain typing leads, the terminal stages can pull it down a step. */
export function typingLevel(scores: Record<StageId, StageScore>): Level {
  const rank = (l: Level) => (l === 'beginner' ? 0 : l === 'intermediate' ? 1 : 2);
  const letters = rank(scores.letters.level);
  const terminal = Math.min(rank(scores.symbols.level), rank(scores.commands.level));
  const overall = Math.min(letters, terminal + 1);
  return (['beginner', 'intermediate', 'advanced'] as const)[overall];
}

export interface QuizQuestion {
  id: string;
  q: Record<Lang, string>;
  options: Record<Lang, string[]>;
  /** Index of the right option. */
  answer: number;
}

/** Ordered from easy to hard. */
export const QUIZ: QuizQuestion[] = [
  {
    id: 'ip',
    q: {
      en: 'What is an IP address?',
      uz: 'IP manzil nima?',
      ru: 'Что такое IP-адрес?',
    },
    options: {
      en: ['The password of a Wi-Fi network', 'A number that identifies a device on a network', 'The name of a website', 'A type of virus'],
      uz: ['Wi-Fi tarmog\'ining paroli', 'Tarmoqdagi qurilmani aniqlaydigan raqam', 'Veb-sayt nomi', 'Virus turi'],
      ru: ['Пароль от сети Wi-Fi', 'Число, которое идентифицирует устройство в сети', 'Название сайта', 'Разновидность вируса'],
    },
    answer: 1,
  },
  {
    id: 'phishing',
    q: {
      en: 'What is phishing?',
      uz: 'Phishing nima?',
      ru: 'Что такое фишинг?',
    },
    options: {
      en: ['Scanning a network for open ports', 'Encrypting files and demanding money', 'Tricking people into revealing secrets with fake messages', 'Guessing a password by trying every combination'],
      uz: ['Tarmoqdagi ochiq portlarni skanerlash', 'Fayllarni shifrlab, pul talab qilish', 'Soxta xabarlar bilan odamlardan maxfiy ma\'lumot olish', 'Barcha kombinatsiyalarni sinab parol topish'],
      ru: ['Сканирование сети на открытые порты', 'Шифрование файлов с требованием выкупа', 'Выманивание секретов с помощью поддельных сообщений', 'Подбор пароля перебором всех комбинаций'],
    },
    answer: 2,
  },
  {
    id: 'ls',
    q: {
      en: 'What does the command `ls -la` do?',
      uz: '`ls -la` buyrug\'i nima qiladi?',
      ru: 'Что делает команда `ls -la`?',
    },
    options: {
      en: ['Deletes all files', 'Lists all files, hidden ones included, with details', 'Shows the current directory', 'Logs in as another user'],
      uz: ['Barcha fayllarni o\'chiradi', 'Barcha fayllarni, yashirinlarini ham, tafsilotlari bilan ko\'rsatadi', 'Joriy katalogni ko\'rsatadi', 'Boshqa foydalanuvchi sifatida kiradi'],
      ru: ['Удаляет все файлы', 'Показывает все файлы, включая скрытые, с подробностями', 'Показывает текущий каталог', 'Входит под другим пользователем'],
    },
    answer: 1,
  },
  {
    id: 'port',
    q: {
      en: 'Which port does SSH use by default?',
      uz: 'SSH odatda qaysi portdan foydalanadi?',
      ru: 'Какой порт SSH использует по умолчанию?',
    },
    options: { en: ['21', '22', '80', '443'], uz: ['21', '22', '80', '443'], ru: ['21', '22', '80', '443'] },
    answer: 1,
  },
  {
    id: 'pipe',
    q: {
      en: 'In a shell, what does the `|` symbol do?',
      uz: 'Shell\'da `|` belgisi nima qiladi?',
      ru: 'Что делает символ `|` в командной оболочке?',
    },
    options: {
      en: ['Runs a command in the background', 'Writes output to a file', 'Sends the output of one command into the next', 'Comments out the rest of the line'],
      uz: ['Buyruqni fonda ishga tushiradi', 'Natijani faylga yozadi', 'Bir buyruq natijasini keyingisiga uzatadi', 'Qatorning qolganini izohga aylantiradi'],
      ru: ['Запускает команду в фоне', 'Записывает вывод в файл', 'Передаёт вывод одной команды на вход следующей', 'Превращает остаток строки в комментарий'],
    },
    answer: 2,
  },
  {
    id: 'nmap',
    q: {
      en: 'What is nmap mainly used for?',
      uz: 'nmap asosan nima uchun ishlatiladi?',
      ru: 'Для чего в основном используют nmap?',
    },
    options: {
      en: ['Cracking password hashes', 'Discovering hosts and open ports on a network', 'Intercepting web requests in a browser', 'Writing exploits'],
      uz: ['Parol hashlarini buzish', 'Tarmoqdagi xostlar va ochiq portlarni aniqlash', 'Brauzerdagi veb-so\'rovlarni ushlab qolish', 'Eksploit yozish'],
      ru: ['Взлом хешей паролей', 'Поиск хостов и открытых портов в сети', 'Перехват веб-запросов в браузере', 'Написание эксплойтов'],
    },
    answer: 1,
  },
  {
    id: 'sqli',
    q: {
      en: 'What makes SQL injection possible?',
      uz: 'SQL injection nima sababdan mumkin bo\'ladi?',
      ru: 'Из-за чего становится возможной SQL-инъекция?',
    },
    options: {
      en: ['A weak Wi-Fi password', 'User input placed into a database query without being handled safely', 'An expired TLS certificate', 'Too many open ports'],
      uz: ['Zaif Wi-Fi paroli', 'Foydalanuvchi kiritgan ma\'lumot xavfsiz ishlov berilmasdan baza so\'roviga qo\'yilishi', 'Muddati o\'tgan TLS sertifikati', 'Juda ko\'p ochiq portlar'],
      ru: ['Слабый пароль Wi-Fi', 'Пользовательский ввод попадает в запрос к базе без безопасной обработки', 'Просроченный TLS-сертификат', 'Слишком много открытых портов'],
    },
    answer: 1,
  },
  {
    id: 'suid',
    q: {
      en: 'Why does a pentester run `find / -perm -4000 2>/dev/null`?',
      uz: 'Pentester `find / -perm -4000 2>/dev/null` buyrug\'ini nima uchun ishlatadi?',
      ru: 'Зачем пентестер запускает `find / -perm -4000 2>/dev/null`?',
    },
    options: {
      en: ['To find files larger than 4000 bytes', 'To list the 4000 most recent files', 'To find SUID binaries that may allow privilege escalation', 'To delete temporary files'],
      uz: ['4000 baytdan katta fayllarni topish uchun', 'Eng so\'nggi 4000 ta faylni ko\'rish uchun', 'Huquqlarni oshirishga imkon berishi mumkin bo\'lgan SUID fayllarni topish uchun', 'Vaqtinchalik fayllarni o\'chirish uchun'],
      ru: ['Чтобы найти файлы больше 4000 байт', 'Чтобы вывести 4000 последних файлов', 'Чтобы найти SUID-файлы, пригодные для повышения привилегий', 'Чтобы удалить временные файлы'],
    },
    answer: 2,
  },
];

export function knowledgeLevel(correct: number, total: number): Level {
  const share = total === 0 ? 0 : correct / total;
  if (share >= 0.85) return 'advanced';
  if (share >= 0.5) return 'intermediate';
  return 'beginner';
}

/** Where to send someone after placement. */
export function recommendedLesson(level: Level | null): string {
  if (level === 'advanced') return 'cmd-shell-1';
  if (level === 'intermediate') return 'sym-paths';
  return 'kb-home';
}
