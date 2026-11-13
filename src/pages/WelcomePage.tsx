import { useCallback, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Keyboard } from '../components/Keyboard';
import { TypingArea } from '../components/TypingArea';
import { countries } from '../content/countries';
import { findLesson } from '../content/lessons';
import {
  QUIZ,
  STAGES,
  STAGE_SECONDS,
  knowledgeLevel,
  recommendedLesson,
  scoreStage,
  stageGenerator,
  typingLevel,
  type StageId,
} from '../content/placement';
import { buildResult } from '../engine/metrics';
import { expectedChar } from '../engine/session';
import type { SessionState } from '../engine/types';
import { useTypingSession } from '../hooks/useTypingSession';
import { useT } from '../i18n';
import { syncOnboarding } from '../services/sync';
import { useData } from '../store/data';
import { useOnboarding, type Os, type StageScore } from '../store/onboarding';
import { useSettings } from '../store/settings';

type Step = 'intro' | 'profile' | 'typing' | 'quiz' | 'result';
const GOALS = [5, 10, 20, 30];
const OSES: Os[] = ['windows', 'linux', 'macos'];
const noop = () => {};

/** Render `backticked` parts of a question as code. */
const rich = (text: string) =>
  text.split('`').map((part, i) => (i % 2 === 1 ? <code key={i}>{part}</code> : part));

/** A physical keyboard is assumed unless the device only has a touch screen. */
const hasKeyboard = () =>
  typeof window === 'undefined' || !window.matchMedia || window.matchMedia('(any-pointer: fine)').matches;

function TypingStage({ stage, onDone }: { stage: StageId; onDone: (score: StageScore) => void }) {
  const t = useT();
  const fontSize = useSettings((s) => s.fontSize);
  const generate = useMemo(() => stageGenerator(stage), [stage]);
  const tokens = useMemo(() => generate(40), [generate]);

  const onFinish = useCallback(
    (session: SessionState) => {
      const result = buildResult(session, {
        kind: 'test',
        category: 'mixed',
        mode: 'time',
        length: STAGE_SECONDS,
        topic: null,
        strict: false,
      });
      // Placement runs are not results, but their keystrokes are the first
      // evidence of which keys this person struggles with.
      useData.getState().absorb(session.keyLog, result.missedWords);
      onDone(scoreStage(stage, result.wpm, result.accuracy));
    },
    [stage, onDone],
  );

  const { state, now } = useTypingSession({
    tokens,
    strict: false,
    timeLimit: STAGE_SECONDS,
    more: generate,
    enabled: true,
    onFinish,
    onRestart: noop,
  });

  const started = state.startedAt !== null;
  const elapsed = started ? (now - state.startedAt!) / 1000 : 0;
  return (
    <section className="runner" style={{ '--fs': `${fontSize}px` } as React.CSSProperties}>
      <div className="live">
        <span className="counter accent">{Math.max(0, Math.ceil(STAGE_SECONDS - elapsed))}</span>
        {!started && <span className="live-stat">{t('welcome.stageStart', { s: STAGE_SECONDS })}</span>}
      </div>
      <TypingArea state={state} idle={!started} />
      <Keyboard next={expectedChar(state)} />
    </section>
  );
}

export function WelcomePage() {
  const t = useT();
  const navigate = useNavigate();
  const lang = useSettings((s) => s.lang);
  const saved = useOnboarding();
  const [step, setStep] = useState<Step>(saved.status === 'done' ? 'result' : 'intro');

  const [name, setName] = useState(saved.name);
  const [country, setCountry] = useState(saved.country);
  const [os, setOs] = useState<Os | ''>(saved.os);
  const [goal, setGoal] = useState(saved.dailyGoal);

  const [stageIndex, setStageIndex] = useState(0);
  const [scores, setScores] = useState<Partial<Record<StageId, StageScore>>>({});
  const [lastScore, setLastScore] = useState<StageScore | null>(null);

  const [question, setQuestion] = useState(0);
  const [correct, setCorrect] = useState(0);

  const countryList = useMemo(() => countries(lang), [lang]);
  const canType = useMemo(hasKeyboard, []);
  const stage = STAGES[stageIndex];

  const skip = () => {
    saved.set({ status: 'skipped' });
    navigate('/');
  };

  const finish = (right: number) => {
    const typing =
      scores.letters && scores.symbols && scores.commands
        ? { letters: scores.letters, symbols: scores.symbols, commands: scores.commands }
        : null;
    saved.set({
      status: 'done',
      name: name.trim(),
      country,
      os,
      dailyGoal: goal,
      typing,
      typingLevel: typing ? typingLevel(typing) : null,
      knowledge: { correct: right, total: QUIZ.length, level: knowledgeLevel(right, QUIZ.length) },
      at: Date.now(),
    });
    void syncOnboarding();
    setStep('result');
  };

  const onStageDone = useCallback(
    (score: StageScore) => {
      setScores((s) => ({ ...s, [STAGES[stageIndex]]: score }));
      setLastScore(score);
    },
    [stageIndex],
  );

  const nextStage = () => {
    setLastScore(null);
    if (stageIndex + 1 < STAGES.length) setStageIndex(stageIndex + 1);
    else setStep('quiz');
  };

  const answer = (index: number | null) => {
    const right = correct + (index === QUIZ[question].answer ? 1 : 0);
    setCorrect(right);
    if (question + 1 < QUIZ.length) setQuestion(question + 1);
    else finish(right);
  };

  const stepNumber = { intro: 0, profile: 1, typing: 2, quiz: 3, result: 4 }[step];

  return (
    <div className="page welcome">
      {step !== 'intro' && step !== 'result' && (
        <div className="welcome-progress">
          <span className="muted small">{t('welcome.step', { n: stepNumber, total: 3 })}</span>
          <div className="progress">
            <div className="progress-bar" style={{ width: `${(stepNumber / 4) * 100}%` }} />
          </div>
        </div>
      )}

      {step === 'intro' && (
        <section className="welcome-card">
          <h1>{t('welcome.title')}</h1>
          <p className="muted">{t('welcome.intro')}</p>
          <ul className="welcome-points">
            <li>{t('welcome.point1')}</li>
            <li>{t('welcome.point2')}</li>
            <li>{t('welcome.point3')}</li>
          </ul>
          <div className="actions">
            <button className="btn primary big" autoFocus onClick={() => setStep('profile')}>
              {t('welcome.begin')}
            </button>
            <button className="btn" onClick={skip}>
              {t('welcome.skip')}
            </button>
          </div>
        </section>
      )}

      {step === 'profile' && (
        <form
          className="welcome-card"
          onSubmit={(e) => {
            e.preventDefault();
            setStep(canType ? 'typing' : 'quiz');
          }}
        >
          <h1>{t('welcome.profileTitle')}</h1>
          <label className="field">
            <span>
              {t('welcome.name')} <i className="muted">({t('welcome.optional')})</i>
            </span>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} autoFocus />
          </label>
          <label className="field">
            <span>
              {t('welcome.country')} <i className="muted">({t('welcome.optional')})</i>
            </span>
            <select value={country} onChange={(e) => setCountry(e.target.value)}>
              <option value="">{t('welcome.countryNone')}</option>
              {countryList.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <div className="field">
            <span>{t('welcome.os')}</span>
            <div className="seg">
              {OSES.map((o) => (
                <button type="button" key={o} className={os === o ? 'on' : ''} onClick={() => setOs(o)}>
                  {o}
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <span>{t('welcome.goal')}</span>
            <div className="seg">
              {GOALS.map((g) => (
                <button type="button" key={g} className={goal === g ? 'on' : ''} onClick={() => setGoal(g)}>
                  {t('welcome.goalUnit', { n: g })}
                </button>
              ))}
            </div>
          </div>
          {!canType && <p className="notice">{t('welcome.noKeyboard')}</p>}
          <div className="actions">
            <button className="btn primary">{t('welcome.next')}</button>
          </div>
        </form>
      )}

      {step === 'typing' && (
        <section className="welcome-stage">
          <header className="lesson-head">
            <h1>{t(`welcome.stage.${stage}`)}</h1>
            <p className="muted">{t(`welcome.stageHelp.${stage}`)}</p>
          </header>
          {lastScore ? (
            <div className="welcome-card">
              <p>
                {t('welcome.stageDone', {
                  wpm: Math.round(lastScore.wpm),
                  acc: Math.floor(lastScore.accuracy),
                })}
              </p>
              <div className="actions">
                <button className="btn primary" autoFocus onClick={nextStage}>
                  {t('welcome.next')}
                </button>
              </div>
            </div>
          ) : (
            <TypingStage key={stage} stage={stage} onDone={onStageDone} />
          )}
        </section>
      )}

      {step === 'quiz' && (
        <section className="welcome-card">
          <span className="muted small">{t('welcome.question', { n: question + 1, total: QUIZ.length })}</span>
          <h1 className="quiz-question">{rich(QUIZ[question].q[lang])}</h1>
          <p className="muted small">{t('welcome.quizHelp')}</p>
          <div className="quiz-options">
            {QUIZ[question].options[lang].map((option, i) => (
              <button key={`${question}-${i}`} className="btn" onClick={() => answer(i)}>
                {option}
              </button>
            ))}
            <button key={`${question}-none`} className="btn ghost" onClick={() => answer(null)}>
              {t('welcome.dontKnow')}
            </button>
          </div>
        </section>
      )}

      {step === 'result' && (
        <section className="welcome-card wide">
          <h1>{t('welcome.resultTitle')}</h1>
          <div className="tiles">
            <div className="tile">
              <span className="label">{t('welcome.typingLevel')}</span>
              <span className="value accent">
                {saved.typingLevel ? t(`level.${saved.typingLevel}`) : t('welcome.notMeasured')}
              </span>
            </div>
            <div className="tile">
              <span className="label">{t('welcome.knowledgeLevel')}</span>
              <span className="value accent">
                {saved.knowledge ? t(`level.${saved.knowledge.level}`) : t('welcome.notMeasured')}
              </span>
              {saved.knowledge && (
                <span className="muted small">
                  {t('welcome.quizScore', { n: saved.knowledge.correct, total: saved.knowledge.total })}
                </span>
              )}
            </div>
          </div>
          {saved.typing && (
            <div className="tiles small">
              {STAGES.map((id) => (
                <div className="tile" key={id}>
                  <span className="label">{t(`welcome.stageName.${id}`)}</span>
                  <span className="value">{Math.round(saved.typing![id].wpm)} wpm</span>
                  <span className="muted small">
                    {Math.floor(saved.typing![id].accuracy)}% · {t(`level.${saved.typing![id].level}`)}
                  </span>
                </div>
              ))}
            </div>
          )}
          <p className="notice">
            {saved.typingLevel === 'beginner' ? t('welcome.handsOn') : t('welcome.handsOff')}
          </p>
          <div className="actions">
            <Link className="btn primary big" to={`/lessons/${recommendedLesson(saved.typingLevel)}`}>
              {t('welcome.startLesson', {
                lesson: t.opt(
                  `lesson.${recommendedLesson(saved.typingLevel)}.title`,
                  findLesson(recommendedLesson(saved.typingLevel))?.title ?? '',
                ),
              })}
            </Link>
            <Link className="btn" to="/">
              {t('welcome.toTest')}
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
