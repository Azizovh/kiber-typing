import type { Token } from '../engine/types';
import { COMMAND_TOPICS, SYMBOLS, TERM_TOPICS, commandTokens, flowTokens } from './library';

export interface Lesson {
  id: string;
  group: string;
  title: string;
  desc: string;
  /** Keys this lesson focuses on (shown on the card). */
  keys?: string;
  build: () => Token[];
}

export interface LessonGroup {
  id: string;
  title: string;
  desc: string;
  lessons: Lesson[];
}

const words = (text: string): Token[] =>
  text
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => ({ text: t }));

const symbolIndex = new Map(SYMBOLS.map((s) => [s.text, s]));

/** Like `words`, but attaches the library's explanation when the symbol is known. */
const symbols = (text: string): Token[] =>
  words(text).map((t) => {
    const item = symbolIndex.get(t.text);
    return item ? { text: t.text, hint: { label: item.text, desc: item.desc } } : t;
  });

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  // Avoid a tiny last lesson: fold a short tail into the previous chunk.
  if (out.length > 1 && out[out.length - 1].length < size / 2) {
    out[out.length - 2].push(...out.pop()!);
  }
  return out;
}

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];

const keyboard: Lesson[] = [
  {
    id: 'kb-home',
    group: 'keyboard',
    title: 'Home row',
    desc: 'Index fingers on F and J. Every other key is reached from here.',
    keys: 'a s d f g h j k l ;',
    build: () =>
      words(
        'asdf jkl; asdf jkl; fdsa ;lkj fj dk sl a; gh hg fgh jhg ' +
          'sad lad ask dash flag hash glass flask salad shall half ' +
          'lash fall hall gas jag add all as has had ls; ls; da sh',
      ),
  },
  {
    id: 'kb-top',
    group: 'keyboard',
    title: 'Top row',
    desc: 'Reach up and come straight back to the home row.',
    keys: 'q w e r t y u i o p',
    build: () =>
      words(
        'qwer tyui op qp wo ei ru ty yt ' +
          'root user sudo port route write tree wire pipe ' +
          'your type top tty quiet power query output echo ' +
          'ruby perl iptables proxy typed reply error file kill shell data task ps who wget',
      ),
  },
  {
    id: 'kb-bottom',
    group: 'keyboard',
    title: 'Bottom row',
    desc: 'The row most people look down for. Do not.',
    keys: 'z x c v b n m , . /',
    build: () =>
      words(
        'zxcv bnm, ./ zx cv bn m, ./ ' +
          'nc vim zip bin mnt cmd xxd nmap cve vnc ' +
          'bash zsh cron exec scan mount binary vector backup ' +
          'ssh.conf main.c a.out lib.so mv, cp, cd.. /bin /mnt /var /boot bin/ zcat nvm',
      ),
  },
  {
    id: 'kb-numbers',
    group: 'keyboard',
    title: 'Number row',
    desc: 'Ports, IP addresses and permissions are all numbers.',
    keys: '1 2 3 4 5 6 7 8 9 0',
    build: () =>
      words(
        '22 80 443 21 25 53 110 139 445 3306 3389 8080 8443 5432 6379 ' +
          '127.0.0.1 10.10.10.5 192.168.1.1 172.16.0.1 10.0.0.254 ' +
          '755 644 600 777 400 4000 65535 1337 4444 9001 1024 2049 5900 27017',
      ),
  },
  {
    id: 'kb-shift',
    group: 'keyboard',
    title: 'Capitals & Shift',
    desc: 'Hold Shift with the opposite hand from the letter.',
    keys: 'Shift + letters',
    build: () =>
      words(
        'LHOST RHOSTS LPORT PATH HOME USER TERM PAYLOAD FUZZ ' +
          'GET POST PUT HEAD HTTP DNS TCP UDP SSH SMB XSS CSRF ' +
          'NetworkManager theHarvester Host: User-Agent: Content-Type: ' +
          'SELECT FROM WHERE UNION Kali Linux Nmap Metasploit Burp Wireshark',
      ),
  },
];

const symbolLessons: Lesson[] = [
  {
    id: 'sym-paths',
    group: 'symbols',
    title: 'Paths',
    desc: 'Slash, tilde, dot and dash — you type these in almost every command.',
    keys: '/ ~ . - _',
    build: () =>
      symbols(
        '/ ~ ~/ ./ ../ /etc/ /tmp/ /var/log/ ~/.ssh/ ../../ /dev/null ' +
          '/bin/bash /etc/passwd ~/.bashrc /opt/ /root/ /home/kali/ ' +
          '-la -sV -p- -oN --help --version --batch id_rsa known_hosts ' +
          './exploit.sh ../config.php ~/tools/ /usr/share/wordlists/ /proc/ -h -v -r',
      ),
  },
  {
    id: 'sym-pipes',
    group: 'symbols',
    title: 'Pipes & redirects',
    desc: 'Chain commands together and decide where their output goes.',
    keys: '| > < & ;',
    build: () =>
      symbols(
        '| || & && ; > >> < << <<< 2> 2>&1 2>/dev/null &>/dev/null >&2 ' +
          '| grep | sort | uniq | wc | tee > out.txt >> log.txt < in.txt ' +
          '&& echo || exit ; ls ; id 0>&1 >& | less | head | tail && cd .. ; pwd',
      ),
  },
  {
    id: 'sym-vars',
    group: 'symbols',
    title: 'Variables & quotes',
    desc: 'Dollar signs, quotes and backticks decide what the shell expands.',
    keys: '$ " \' ` \\',
    build: () =>
      symbols(
        '$ $HOME $PATH $USER $? $! $$ $0 $1 $@ $# $(id) $(whoami) $(pwd) ' +
          '${PATH} ${HOME}/ `id` "$1" "$@" \'$1\' \\ \\n \\t \\\\ \\x90 ' +
          '"admin" \'root\' "$USER" \'$HOME\' `pwd` $(date) "" \'\' LHOST= LPORT= key=value',
      ),
  },
  {
    id: 'sym-brackets',
    group: 'symbols',
    title: 'Brackets & globs',
    desc: 'Wildcards, character classes and brace expansion.',
    keys: '* ? [ ] { } ( )',
    build: () =>
      symbols(
        '* *.txt *.conf ? [0-9] [a-z] [A-Z] [^0-9] {1..10} {a,b,c} file.{txt,bak} ' +
          '() {} [] <> [[ ]] (a|b) .* \\d+ ^root {{7*7}} uid=0(root) ' +
          '*.log *.php *.bak [0-9]* {80,443} $(ls) (id) [ok] {1..255} ?id=1 *.py',
      ),
  },
  {
    id: 'sym-net',
    group: 'symbols',
    title: 'Addresses & URLs',
    desc: 'Colons, at-signs, percent-encoding and the rest of the network alphabet.',
    keys: ': @ % # ! = +',
    build: () =>
      symbols(
        'user@host root@kali kali@kali:~$ root@kali:~# 127.0.0.1:8080 0.0.0.0:4444 ' +
          ':80 :443 :22 ::1 http:// https:// ftp:// smb:// ssh:// file:/// ' +
          '?id=1 &page=2 %20 %27 %00 #!/bin/bash !! !$ == != 0x41 0x00 ' +
          'AA:BB:CC:DD:EE:FF 10.0.0.0/8 192.168.1.0/24 + = % @ # :',
      ),
  },
];

const commandLessons: Lesson[] = COMMAND_TOPICS.flatMap((topic) =>
  chunk(topic.items, 10).map((items, i, all) => ({
    id: `cmd-${topic.id}-${i + 1}`,
    group: 'commands',
    title: all.length > 1 ? `${topic.title} ${ROMAN[i]}` : topic.title,
    desc: `${items.length} real command lines. Finish each one with Enter.`,
    build: () => items.flatMap(commandTokens),
  })),
);

const termLessons: Lesson[] = TERM_TOPICS.flatMap((topic) =>
  chunk(topic.items, 20).map((items, i, all) => ({
    id: `term-${topic.id}-${i + 1}`,
    group: 'terms',
    title: all.length > 1 ? `${topic.title} ${ROMAN[i]}` : topic.title,
    desc: `${items.length} terms, each explained while you type it.`,
    build: () => items.flatMap(flowTokens),
  })),
);

export const LESSON_GROUPS: LessonGroup[] = [
  {
    id: 'keyboard',
    title: 'Keyboard basics',
    desc: 'Ten fingers, no looking down. Skip ahead if you already touch-type.',
    lessons: keyboard,
  },
  {
    id: 'symbols',
    title: 'Terminal symbols',
    desc: 'The characters that separate a terminal user from everybody else.',
    lessons: symbolLessons,
  },
  {
    id: 'commands',
    title: 'Commands',
    desc: 'From everyday Linux to the Kali toolbox, one topic at a time.',
    lessons: commandLessons,
  },
  {
    id: 'terms',
    title: 'Vocabulary',
    desc: 'The language of the field, with a one-line definition for every term.',
    lessons: termLessons,
  },
];

export const LESSONS: Lesson[] = LESSON_GROUPS.flatMap((g) => g.lessons);

export function findLesson(id: string): Lesson | undefined {
  return LESSONS.find((l) => l.id === id);
}

/** 0–3 stars. Accuracy first: speed without accuracy is useless in a terminal. */
export function starsFor(accuracy: number): number {
  if (accuracy >= 98) return 3;
  if (accuracy >= 95) return 2;
  if (accuracy >= 90) return 1;
  return 0;
}
